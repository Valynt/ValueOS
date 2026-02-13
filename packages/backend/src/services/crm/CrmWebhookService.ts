/**
 * CRM Webhook Service
 *
 * Handles webhook ingestion with idempotency guarantees.
 * Stores events, deduplicates, and enqueues for async processing.
 */

import type { Request } from 'express';
import { z } from 'zod';
import { createServerSupabaseClient } from '../../lib/supabase.js';
import { createLogger } from '../../lib/logger.js';
import { getCrmProvider } from './CrmProviderRegistry.js';
import { getCrmWebhookQueue } from '../../workers/crmWorker.js';
import { redactSecrets } from './secretsRedaction.js';
import type { CrmProvider, WebhookEventRow } from './types.js';

const logger = createLogger({ component: 'CrmWebhookService' });

/**
 * Zod schema for webhook payload validation at ingress.
 * Rejects payloads that are too large or structurally invalid.
 */
const WebhookPayloadSchema = z.record(z.unknown()).refine(
  (val) => JSON.stringify(val).length <= 512_000, // 512KB max
  { message: 'Webhook payload exceeds maximum size (512KB)' },
);

/**
 * Allowlisted event types per provider. Unknown types are rejected.
 */
const ALLOWED_EVENT_TYPES: Record<CrmProvider, Set<string>> = {
  salesforce: new Set([
    'Opportunity',
    'Account',
    'Contact',
    'OpportunityContactRole',
    'updated',
    'created',
    'deleted',
    'undeleted',
    'unknown', // fallback for unrecognized but signed events
  ]),
  hubspot: new Set([
    'deal.creation',
    'deal.propertyChange',
    'deal.deletion',
    'company.creation',
    'company.propertyChange',
    'contact.creation',
    'contact.propertyChange',
    'unknown',
  ]),
};

export interface WebhookIngestResult {
  accepted: boolean;
  duplicate: boolean;
  eventId?: string;
}

export class CrmWebhookService {
  private supabase = createServerSupabaseClient();

  /**
   * Ingest a webhook event:
   * 1. Verify signature
   * 2. Extract idempotency key
   * 3. Check for duplicates
   * 4. Store event
   * 5. Enqueue for processing
   */
  async ingestWebhook(
    provider: CrmProvider,
    req: Request,
  ): Promise<WebhookIngestResult> {
    const impl = getCrmProvider(provider);

    // 1. Verify signature
    const verification = await impl.verifyWebhookSignature(req);
    if (!verification.valid) {
      logger.warn('Webhook signature verification failed', { provider });
      return { accepted: false, duplicate: false };
    }

    // 2. Validate payload structure and size
    const payloadResult = WebhookPayloadSchema.safeParse(req.body);
    if (!payloadResult.success) {
      logger.warn('Webhook payload validation failed', {
        provider,
        error: payloadResult.error.message,
      });
      return { accepted: false, duplicate: false };
    }
    const payload = payloadResult.data;

    // 3. Extract idempotency key
    const idempotencyKey = impl.extractIdempotencyKey(payload);

    // 4. Check for duplicate
    const { data: existing } = await this.supabase
      .from('crm_webhook_events')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existing) {
      logger.info('Duplicate webhook event, skipping', { provider, idempotencyKey });
      return { accepted: false, duplicate: true, eventId: existing.id };
    }

    // 5. Determine tenant_id from webhook payload or connection lookup
    const tenantId = await this.resolveTenantId(provider, payload, verification.tenantId);
    if (!tenantId) {
      logger.warn('Could not resolve tenant for webhook', { provider, idempotencyKey });
      return { accepted: false, duplicate: false };
    }

    // 6. Validate event type against allowlist
    const eventType = this.extractEventType(provider, payload);
    const allowed = ALLOWED_EVENT_TYPES[provider];
    if (allowed && !allowed.has(eventType)) {
      logger.warn('Webhook event type not in allowlist', { provider, eventType });
      return { accepted: false, duplicate: false };
    }

    // 7. Strip sensitive fields from payload before storage
    const sanitizedPayload = redactSecrets(payload) as Record<string, unknown>;

    const { data: event, error } = await this.supabase
      .from('crm_webhook_events')
      .insert({
        tenant_id: tenantId,
        provider,
        idempotency_key: idempotencyKey,
        event_type: eventType,
        payload: sanitizedPayload,
        process_status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      // Unique constraint violation = duplicate (race condition)
      if (error.code === '23505') {
        return { accepted: false, duplicate: true };
      }
      logger.error('Failed to store webhook event', error, { provider });
      throw error;
    }

    // 8. Enqueue for async processing
    const queue = getCrmWebhookQueue();
    await queue.add('crm:webhook:process', {
      eventId: event.id,
      tenantId,
      provider,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
    });

    logger.info('Webhook event ingested', {
      provider,
      eventId: event.id,
      eventType,
      tenantId,
    });

    return { accepted: true, duplicate: false, eventId: event.id };
  }

  /**
   * Process a stored webhook event (called by the worker).
   */
  async processEvent(eventId: string): Promise<void> {
    const { data: event, error } = await this.supabase
      .from('crm_webhook_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (error || !event) {
      logger.error('Webhook event not found', error, { eventId });
      throw new Error(`Webhook event not found: ${eventId}`);
    }

    const row = event as WebhookEventRow;

    // Skip already-processed events (idempotent)
    if (row.process_status === 'processed') {
      logger.info('Webhook event already processed', { eventId });
      return;
    }

    try {
      // Delegate to the sync service for actual processing
      const { crmSyncService } = await import('./CrmSyncService.js');
      await crmSyncService.processWebhookEvent(row);

      // Mark as processed
      await this.supabase
        .from('crm_webhook_events')
        .update({
          process_status: 'processed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', eventId);

      logger.info('Webhook event processed', { eventId, eventType: row.event_type });
    } catch (err) {
      // Mark as failed
      await this.supabase
        .from('crm_webhook_events')
        .update({
          process_status: 'failed',
          last_error: {
            message: err instanceof Error ? err.message : String(err),
            timestamp: new Date().toISOString(),
          },
        })
        .eq('id', eventId);

      throw err;
    }
  }

  // ---- Private helpers ----

  /**
   * Resolve tenant_id from webhook data or by looking up the CRM org ID.
   */
  private async resolveTenantId(
    provider: CrmProvider,
    payload: Record<string, unknown>,
    verificationTenantId?: string,
  ): Promise<string | null> {
    if (verificationTenantId) {
      // Look up by external_org_id
      const { data } = await this.supabase
        .from('crm_connections')
        .select('tenant_id')
        .eq('provider', provider)
        .eq('external_org_id', verificationTenantId)
        .eq('status', 'connected')
        .maybeSingle();

      if (data) return data.tenant_id;
    }

    // Try to extract org ID from payload
    const orgId = payload.organizationId || payload.portalId;
    if (orgId) {
      const { data } = await this.supabase
        .from('crm_connections')
        .select('tenant_id')
        .eq('provider', provider)
        .eq('external_org_id', String(orgId))
        .eq('status', 'connected')
        .maybeSingle();

      if (data) return data.tenant_id;
    }

    return null;
  }

  private extractEventType(
    provider: CrmProvider,
    payload: Record<string, unknown>,
  ): string {
    if (provider === 'salesforce') {
      return (payload.eventType as string) || (payload.sobjectType as string) || 'unknown';
    }
    // HubSpot
    return (payload.subscriptionType as string) || 'unknown';
  }
}

export const crmWebhookService = new CrmWebhookService();
