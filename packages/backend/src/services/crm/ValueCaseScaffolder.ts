/**
 * ValueCase Scaffolder
 *
 * Creates a ValueCase from a CRM opportunity using tenant templates,
 * initializes the ValueCaseSaga in INITIATED state, and triggers
 * the agent pre-fetch job.
 */

import { createLogger } from '../../lib/logger.js';
import { createServerSupabaseClient } from '../../lib/supabase.js';
import { getPrefetchQueue } from '../../workers/crmWorker.js';
import { auditLogService } from '../AuditLogService.js';

import type { CanonicalOpportunity, CrmProvider } from './types.js';

const logger = createLogger({ component: 'ValueCaseScaffolder' });

export class ValueCaseScaffolder {
  private supabase = createServerSupabaseClient();

  /**
   * Scaffold a ValueCase from a CRM opportunity.
   *
   * 1. Load tenant template (or use defaults)
   * 2. Create value_cases row
   * 3. Create crm_object_maps entry linking opportunity → value_case
   * 4. Initialize value_case_sagas row in INITIATED state
   * 5. Write provenance
   * 6. Emit audit logs
   * 7. Enqueue agent pre-fetch job
   */
  async scaffold(
    tenantId: string,
    provider: CrmProvider,
    opp: CanonicalOpportunity,
    opportunityId: string,
  ): Promise<string> {
    // 1. Load tenant template
    const template = await this.getTemplate(tenantId);

    // 2. Create ValueCase
    const caseName = opp.name || `${opp.companyName || 'Unknown'} - Value Case`;
    const metadata = {
      ...template.template_data,
      crmProvider: provider,
      crmDealId: opp.externalId,
      dealValue: opp.amount,
      dealCurrency: opp.currency,
      closeDate: opp.closeDate,
      crmStage: opp.stage,
      companyName: opp.companyName,
      ownerName: opp.ownerName,
    };

    const { data: valueCase, error: vcError } = await this.supabase
      .from('value_cases')
      .insert({
        tenant_id: tenantId,
        name: caseName,
        description: `Auto-scaffolded from ${provider} opportunity: ${opp.name}`,
        status: 'draft',
        metadata,
      })
      .select('id')
      .single();

    if (vcError) {
      logger.error('Failed to create ValueCase', vcError, { tenantId, opp: opp.externalId });
      throw vcError;
    }

    const valueCaseId = valueCase.id;

    // 3. Link opportunity to value case
    await this.supabase
      .from('opportunities')
      .update({ value_case_id: valueCaseId })
      .eq('id', opportunityId);

    // 4. Create object map for value_case
    await this.supabase
      .from('crm_object_maps')
      .insert({
        tenant_id: tenantId,
        provider,
        object_type: 'value_case',
        external_id: opp.externalId,
        internal_table: 'value_cases',
        internal_id: valueCaseId,
      });

    // 5. Initialize saga in INITIATED state
    const { error: sagaError } = await this.supabase
      .from('value_case_sagas')
      .insert({
        tenant_id: tenantId,
        value_case_id: valueCaseId,
        state: 'INITIATED',
        version: 1,
        context: {
          opportunityId,
          crmProvider: provider,
          crmExternalId: opp.externalId,
          prefetchStatus: 'pending',
        },
      });

    if (sagaError) {
      logger.error('Failed to create ValueCaseSaga', sagaError, { valueCaseId });
      // Non-fatal — the value case still exists
    }

    // 6. Write provenance
    await this.supabase
      .from('provenance_records')
      .insert({
        tenant_id: tenantId,
        source_type: 'crm',
        source_provider: provider,
        source_provenance: 'crm',
        evidence_tier: 'gold',
        external_object_type: 'opportunity',
        external_object_id: opp.externalId,
        internal_table: 'value_cases',
        internal_id: valueCaseId,
        metadata: { scaffoldedFrom: 'stage_trigger', stage: opp.stage },
      });

    // 7. Audit logs
    await auditLogService.logAudit({
      userId: 'system',
      userName: 'System',
      userEmail: 'system@valueos.io',
      action: 'value_case_scaffolded',
      resourceType: 'value_case',
      resourceId: valueCaseId,
      details: {
        tenantId,
        provider,
        opportunityId,
        crmExternalId: opp.externalId,
        stage: opp.stage,
      },
    });

    await auditLogService.logAudit({
      userId: 'system',
      userName: 'System',
      userEmail: 'system@valueos.io',
      action: 'saga_started',
      resourceType: 'value_case_saga',
      resourceId: valueCaseId,
      details: {
        tenantId,
        initialState: 'INITIATED',
        valueCaseId,
      },
    });

    // 8. Enqueue agent pre-fetch
    const prefetchQueue = getPrefetchQueue();
    await prefetchQueue.add('valuecase:prefetch_context', {
      valueCaseId,
      tenantId,
      provider,
      opportunityExternalId: opp.externalId,
      accountExternalId: opp.companyId,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    logger.info('ValueCase scaffolded', {
      tenantId,
      valueCaseId,
      provider,
      externalId: opp.externalId,
    });

    return valueCaseId;
  }

  /**
   * Get the tenant's default template, or a fallback.
   */
  private async getTemplate(tenantId: string): Promise<{
    template_data: Record<string, unknown>;
  }> {
    const { data } = await this.supabase
      .from('value_case_templates')
      .select('template_data')
      .eq('tenant_id', tenantId)
      .eq('is_default', true)
      .maybeSingle();

    if (data) return data;

    // Fallback default template
    return {
      template_data: {
        sections: ['executive_summary', 'value_drivers', 'financial_model', 'risk_assessment'],
        defaultStage: 'opportunity',
      },
    };
  }
}

export const valueCaseScaffolder = new ValueCaseScaffolder();
