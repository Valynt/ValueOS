/**
 * CRM Sync Service
 *
 * Handles delta sync of opportunities from CRM providers,
 * upserts into internal tables, maintains object maps and provenance,
 * and triggers ValueCase scaffolding when stage triggers match.
 */

import { createHash } from 'node:crypto';

import { createLogger } from '../../lib/logger.js';
// service-role:justified worker/service requires elevated DB access for background processing
import { createServerSupabaseClient } from '../../lib/supabase.js';
import { auditLogService } from '../AuditLogService.js';
import {
  CRM_INTEGRATION_EVENTS,
  recordCrmIntegrationEvent,
  runCrmOperation,
  setCrmQueueLagSeconds,
} from './CrmIntegrationObservability.js';

import { crmConnectionService } from './CrmConnectionService.js';
import { getCrmProvider } from './CrmProviderRegistry.js';
import type {
  CanonicalOpportunity,
  CrmProvider,
  ProvenanceInput,
  WebhookEventRow,
} from './types.js';

const logger = createLogger({ component: 'CrmSyncService' });
const DELTA_SYNC_BATCH_SIZE = 10;

/**
 * Compute a deterministic hash of the canonical CRM fields.
 * Used to detect no-op updates and skip unnecessary provenance writes.
 */
function computeSyncHash(opp: CanonicalOpportunity): string {
  const fields = {
    name: opp.name,
    amount: opp.amount,
    stage: opp.stage,
    probability: opp.probability,
    closeDate: opp.closeDate,
    currency: opp.currency,
    ownerName: opp.ownerName,
    companyName: opp.companyName,
    companyId: opp.companyId,
  };
  return createHash('sha256').update(JSON.stringify(fields)).digest('hex').slice(0, 32);
}

/**
 * CRM-mapped fields that are overwritten by sync.
 * Internal-only fields (e.g., value_case_id, metadata) are never touched.
 */
const CRM_OWNED_FIELDS = [
  'name', 'amount', 'crm_stage', 'probability', 'close_date',
  'currency', 'owner_name', 'company_name', 'company_id',
  'crm_properties', 'external_last_modified_at', 'crm_sync_hash',
  'last_crm_sync_at',
] as const;

/**
 * Allowlisted CRM property keys to store. Strips everything else
 * to enforce least-privilege data storage.
 */
const ALLOWED_CRM_PROPERTIES = new Set([
  // Salesforce
  'Id', 'Name', 'Amount', 'StageName', 'Probability', 'CloseDate',
  'CurrencyIsoCode', 'OwnerId', 'AccountId', 'LastModifiedDate',
  'SystemModstamp', 'CreatedDate', 'Type', 'LeadSource', 'ForecastCategory',
  'IsClosed', 'IsWon', 'FiscalYear', 'FiscalQuarter',
  // HubSpot
  'dealname', 'amount', 'dealstage', 'closedate', 'hubspot_owner_id',
  'hs_lastmodifieddate', 'createdate', 'pipeline', 'deal_currency_code',
  'hs_deal_stage_probability',
]);

function stripCrmProperties(raw: Record<string, unknown>): Record<string, unknown> {
  const stripped: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    if (ALLOWED_CRM_PROPERTIES.has(key)) {
      stripped[key] = raw[key];
    }
  }
  // Always include nested Owner.Name and Account.Name
  if (raw.Owner && typeof raw.Owner === 'object') {
    stripped.Owner = { Name: (raw.Owner as Record<string, unknown>).Name };
  }
  if (raw.Account && typeof raw.Account === 'object') {
    stripped.Account = { Name: (raw.Account as Record<string, unknown>).Name };
  }
  return stripped;
}

export class CrmSyncService {
  private supabase = createServerSupabaseClient();

  /**
   * Run a delta sync for a tenant+provider.
   * Fetches changed opportunities since last cursor, upserts them,
   * and triggers ValueCase scaffolding where applicable.
   */
  async runDeltaSync(tenantId: string, provider: CrmProvider): Promise<{
    processed: number;
    errors: number;
  }> {
    return runCrmOperation(
      {
        provider,
        tenantId,
        operation: 'sync.delta',
        correlationId: `${provider}:${tenantId}:${Date.now()}`,
      },
      async () => {
        const tokens = await crmConnectionService.getTokens(tenantId, provider);
        if (!tokens) {
          recordCrmIntegrationEvent(CRM_INTEGRATION_EVENTS.REAUTH_REQUIRED, {
            provider,
            tenantId,
            operation: 'sync.delta',
            correlationId: `${provider}:${tenantId}`,
          });
          throw new Error(`No valid tokens for ${provider} on tenant ${tenantId}`);
        }

        const conn = await crmConnectionService.getConnection(tenantId, provider);
        const cursor = conn?.sync_cursor || null;
        setCrmQueueLagSeconds(
          tenantId,
          provider,
          'sync',
          conn?.last_sync_at
            ? Math.max(0, Math.floor((Date.now() - new Date(conn.last_sync_at).getTime()) / 1000))
            : 0
        );

        const impl = getCrmProvider(provider);
        let totalProcessed = 0;
        let totalErrors = 0;
        let currentCursor = cursor;
        let hasMore = true;

      while (hasMore) {
        const result = await impl.fetchDeltaOpportunities(tokens, currentCursor);

        for (let i = 0; i < result.opportunities.length; i += DELTA_SYNC_BATCH_SIZE) {
          const batch = result.opportunities.slice(i, i + DELTA_SYNC_BATCH_SIZE);
          const settledBatch = await Promise.allSettled(
            batch.map((opp) => this.upsertOpportunity(tenantId, provider, opp)),
          );

          for (const [index, settled] of settledBatch.entries()) {
            if (settled.status === 'fulfilled') {
              totalProcessed++;
              continue;
            }

            logger.error(
              'Failed to upsert opportunity',
              settled.reason instanceof Error ? settled.reason : undefined,
              {
                tenantId,
                provider,
                externalId: batch[index]?.externalId,
              },
            );
            totalErrors++;
          }
        }

        currentCursor = result.nextCursor;
        hasMore = result.hasMore;
      }

        // Update cursor
        if (currentCursor) {
          await crmConnectionService.updateSyncCursor(tenantId, provider, currentCursor, true);
        }

        // Audit log
        await auditLogService.logAudit({
          tenantId,
          userId: 'system',
          userName: 'System',
          userEmail: 'system@valueos.io',
          action: 'crm_sync_completed',
          resourceType: 'crm_connection',
          resourceId: provider,
          details: {
            tenantId,
            provider,
            processed: totalProcessed,
            errors: totalErrors,
            outcome: 'success',
          },
        });
        if (totalErrors > 0) {
          recordCrmIntegrationEvent(CRM_INTEGRATION_EVENTS.SYNC_DEGRADED, {
            provider,
            tenantId,
            operation: 'sync.delta',
            correlationId: `${provider}:${tenantId}`,
          }, { processed: totalProcessed, errors: totalErrors });
        } else {
          recordCrmIntegrationEvent(CRM_INTEGRATION_EVENTS.SYNC_RECOVERED, {
            provider,
            tenantId,
            operation: 'sync.delta',
            correlationId: `${provider}:${tenantId}`,
          }, { processed: totalProcessed });
        }

        logger.info('Delta sync completed', { tenantId, provider, totalProcessed, totalErrors });
        return { processed: totalProcessed, errors: totalErrors };
      }
    ).catch(async (err) => {
      await crmConnectionService.recordSyncError(tenantId, provider, err instanceof Error ? err : new Error(String(err)));

      await auditLogService.logAudit({
        tenantId,
        userId: 'system',
        userName: 'System',
        userEmail: 'system@valueos.io',
        action: 'crm_sync_failed',
        resourceType: 'crm_connection',
        resourceId: provider,
        details: {
          tenantId,
          provider,
          error: err instanceof Error ? err.message : String(err),
          outcome: 'failed',
        },
        status: 'failed',
      });
      recordCrmIntegrationEvent(CRM_INTEGRATION_EVENTS.SYNC_DEGRADED, {
        provider,
        tenantId,
        operation: 'sync.delta',
        correlationId: `${provider}:${tenantId}`,
      }, { error: err instanceof Error ? err.message : String(err) });

      throw err;
    });
  }

  /**
   * Process a single webhook event (called by CrmWebhookService).
   */
  async processWebhookEvent(event: WebhookEventRow): Promise<void> {
    const { tenant_id: tenantId, provider, payload } = event;

    // Extract opportunity data from webhook payload
    const impl = getCrmProvider(provider);
    const tokens = await crmConnectionService.getTokens(tenantId, provider);

    if (!tokens) {
      throw new Error(`No valid tokens for webhook processing: ${provider}/${tenantId}`);
    }

    // For Salesforce, the webhook may contain the full record or just an ID
    const externalId = (payload.Id || payload.externalId || payload.opportunityId) as string;
    if (!externalId) {
      logger.warn('Webhook event has no identifiable opportunity ID', {
        eventId: event.id,
        eventType: event.event_type,
      });
      return;
    }

    // Fetch the full opportunity from CRM
    const opp = await impl.fetchOpportunityById(tokens, externalId);
    if (!opp) {
      logger.warn('Opportunity not found in CRM', { externalId, provider });
      return;
    }

    await this.upsertOpportunity(tenantId, provider, opp, 'webhook', event.id);
  }

  /**
   * Upsert an opportunity into the internal table, maintain object map,
   * write provenance, and check stage triggers.
   *
   * Out-of-order protection: compares external_last_modified_at to reject stale updates.
   * Sync hash: skips provenance writes when CRM-owned fields haven't changed.
   */
  async upsertOpportunity(
    tenantId: string,
    provider: CrmProvider,
    opp: CanonicalOpportunity,
    ingestionMethod: 'delta_sync' | 'webhook' | 'manual' = 'delta_sync',
    correlationId?: string,
  ): Promise<string> {
    // 1. Check if we already have a mapping for this external ID
    const { data: existingMap } = await this.supabase
      .from('crm_object_maps')
      .select('internal_id')
      .eq('tenant_id', tenantId)
      .eq('provider', provider)
      .eq('object_type', 'opportunity')
      .eq('external_id', opp.externalId)
      .maybeSingle();

    let internalId: string;
    const now = new Date().toISOString();
    const syncHash = computeSyncHash(opp);
    // Salesforce uses SystemModstamp/LastModifiedDate, HubSpot uses hs_lastmodifieddate
    const externalModified = (opp.properties?.SystemModstamp as string)
      || (opp.properties?.LastModifiedDate as string)
      || (opp.properties?.hs_lastmodifieddate as string)
      || null;

    if (existingMap) {
      internalId = existingMap.internal_id;

      // Out-of-order protection: fetch current external_last_modified_at
      if (externalModified) {
        const { data: current } = await this.supabase
          .from('opportunities')
          .select('external_last_modified_at, crm_sync_hash')
          .eq('id', internalId)
          .single();

        if (current?.external_last_modified_at) {
          const incomingTime = new Date(externalModified).getTime();
          const existingTime = new Date(current.external_last_modified_at).getTime();
          if (incomingTime <= existingTime) {
            logger.info('Skipping stale CRM update (out-of-order)', {
              externalId: opp.externalId,
              incoming: externalModified,
              existing: current.external_last_modified_at,
            });
            return internalId;
          }
        }

        // Sync hash: skip if CRM-owned fields haven't changed
        if (current?.crm_sync_hash === syncHash) {
          logger.debug('Skipping no-op CRM update (hash match)', {
            externalId: opp.externalId,
          });
          // Still update last_crm_sync_at
          await this.supabase
            .from('opportunities')
            .update({ last_crm_sync_at: now })
            .eq('id', internalId);
          return internalId;
        }
      }

      // Update only CRM-owned fields — never overwrite internal-only fields
      await this.supabase
        .from('opportunities')
        .update({
          name: opp.name,
          amount: opp.amount,
          status: opp.stage,
          crm_stage: opp.stage,
          probability: opp.probability,
          close_date: opp.closeDate,
          currency: opp.currency,
          owner_name: opp.ownerName,
          company_name: opp.companyName,
          company_id: opp.companyId,
          crm_properties: stripCrmProperties(opp.properties),
          external_last_modified_at: externalModified,
          crm_sync_hash: syncHash,
          last_crm_sync_at: now,
          updated_at: now,
        })
        .eq('id', internalId);

      // Update last_seen_at on the object map
      await this.supabase
        .from('crm_object_maps')
        .update({ last_seen_at: now, updated_at: now })
        .eq('tenant_id', tenantId)
        .eq('provider', provider)
        .eq('object_type', 'opportunity')
        .eq('external_id', opp.externalId);
    } else {
      // Insert new opportunity
      const { data: newOpp, error } = await this.supabase
        .from('opportunities')
        .insert({
          tenant_id: tenantId,
          name: opp.name,
          amount: opp.amount,
          status: opp.stage,
          external_crm_id: opp.externalId,
          crm_provider: provider,
          crm_stage: opp.stage,
          probability: opp.probability,
          close_date: opp.closeDate,
          currency: opp.currency,
          owner_name: opp.ownerName,
          company_name: opp.companyName,
          company_id: opp.companyId,
          crm_properties: stripCrmProperties(opp.properties),
          external_last_modified_at: externalModified,
          crm_sync_hash: syncHash,
          last_crm_sync_at: now,
        })
        .select('id')
        .single();

      if (error) throw error;
      internalId = newOpp.id;

      // Create object map
      await this.supabase
        .from('crm_object_maps')
        .insert({
          tenant_id: tenantId,
          provider,
          object_type: 'opportunity',
          external_id: opp.externalId,
          internal_table: 'opportunities',
          internal_id: internalId,
        });
    }

    // 3. Write provenance record with ingestion method and correlation
    await this.writeProvenance({
      tenantId,
      sourceType: 'crm',
      sourceProvider: provider,
      sourceProvenance: 'crm',
      evidenceTier: 'gold',
      externalObjectType: 'opportunity',
      externalObjectId: opp.externalId,
      internalTable: 'opportunities',
      internalId,
      metadata: {
        ingestionMethod,
        correlationId,
        syncHash,
      },
    });

    // 4. Check stage triggers for ValueCase scaffolding
    await this.checkStageTriggers(tenantId, provider, opp, internalId);

    return internalId;
  }

  /**
   * Check if the opportunity's stage matches a configured trigger.
   * If so, scaffold a ValueCase (if one doesn't already exist).
   */
  private async checkStageTriggers(
    tenantId: string,
    provider: CrmProvider,
    opp: CanonicalOpportunity,
    opportunityId: string,
  ): Promise<void> {
    // Check if there's a trigger for this stage
    const { data: trigger } = await this.supabase
      .from('crm_stage_triggers')
      .select('id, action')
      .eq('tenant_id', tenantId)
      .eq('provider', provider)
      .eq('stage_name', opp.stage)
      .eq('enabled', true)
      .maybeSingle();

    if (!trigger) return;

    // Check if a ValueCase already exists for this opportunity
    const { data: existingCase } = await this.supabase
      .from('crm_object_maps')
      .select('internal_id')
      .eq('tenant_id', tenantId)
      .eq('provider', provider)
      .eq('object_type', 'value_case')
      .eq('external_id', opp.externalId)
      .maybeSingle();

    if (existingCase) {
      logger.info('ValueCase already exists for opportunity', {
        tenantId,
        externalId: opp.externalId,
        valueCaseId: existingCase.internal_id,
      });
      return;
    }

    // Scaffold ValueCase
    const { valueCaseScaffolder } = await import('./ValueCaseScaffolder.js');
    await valueCaseScaffolder.scaffold(tenantId, provider, opp, opportunityId);
  }

  /**
   * Write a provenance record for a CRM-derived entity.
   */
  private async writeProvenance(input: ProvenanceInput): Promise<void> {
    const meta = (input.metadata || {}) as Record<string, unknown>;
    const { error } = await this.supabase
      .from('provenance_records')
      .insert({
        tenant_id: input.tenantId,
        source_type: input.sourceType,
        source_provider: input.sourceProvider,
        source_provenance: input.sourceProvenance,
        evidence_tier: input.evidenceTier,
        external_object_type: input.externalObjectType,
        external_object_id: input.externalObjectId,
        internal_table: input.internalTable,
        internal_id: input.internalId,
        field_name: input.fieldName,
        confidence_data_quality: input.confidenceDataQuality,
        confidence_assumption_stability: input.confidenceAssumptionStability,
        confidence_historical_alignment: input.confidenceHistoricalAlignment,
        ingestion_method: (meta.ingestionMethod as string) || 'delta_sync',
        correlation_id: (meta.correlationId as string) || undefined,
        job_id: (meta.jobId as string) || undefined,
        metadata: input.metadata || {},
      });

    if (error) {
      logger.warn('Failed to write provenance record', { error: error.message });
    }
  }
}

export const crmSyncService = new CrmSyncService();
