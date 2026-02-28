import type { SupabaseClient } from '@supabase/supabase-js';

import { auditLogService } from '../AuditLogService.js';

import { TenantExecutionStateService } from './TenantExecutionStateService.js';

interface LlmSpendingLimitsConfig {
  dailyLimit?: number;
  dailySpend?: number;
  organizationId?: string;
  monthlyHardCap?: number;
  monthlySoftCap?: number;
  perRequestLimit?: number;
  alertThreshold?: number;
  alertRecipients?: string[];
}

export class BillingExecutionControlService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly executionStateService: TenantExecutionStateService,
  ) {}

  async clearPauseWithOverride(params: {
    organizationId: string;
    actorUserId: string;
    actorEmail: string;
    reason: string;
  }): Promise<void> {
    await this.executionStateService.clearPauseState(
      params.organizationId,
      { actorId: params.actorUserId, actorType: 'admin' },
      params.reason,
      { action: 'manual_override' },
    );

    await auditLogService.logAudit({
      userId: params.actorUserId,
      userName: params.actorEmail,
      userEmail: params.actorEmail,
      action: 'tenant_execution_resume_override',
      resourceType: 'tenant_execution_state',
      resourceId: params.organizationId,
      details: { reason: params.reason },
      status: 'success',
    });
  }

  async topUpAndResume(params: {
    organizationId: string;
    actorUserId: string;
    actorEmail: string;
    topUpAmount: number;
    reason: string;
  }): Promise<void> {
    const { data, error } = await this.supabase
      .from('organization_configurations')
      .select('llm_spending_limits')
      .eq('organization_id', params.organizationId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load billing policy: ${error.message}`);
    }

    const currentPolicy = ((data as { llm_spending_limits?: LlmSpendingLimitsConfig } | null)?.llm_spending_limits ?? {}) as LlmSpendingLimitsConfig;
    const nextPolicy: LlmSpendingLimitsConfig = {
      ...currentPolicy,
      dailyLimit: Number(currentPolicy.dailyLimit ?? 0) + params.topUpAmount,
    };

    const { error: updateError } = await this.supabase
      .from('organization_configurations')
      .update({
        llm_spending_limits: nextPolicy,
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', params.organizationId);

    if (updateError) {
      throw new Error(`Failed to apply top-up: ${updateError.message}`);
    }

    await this.executionStateService.clearPauseState(
      params.organizationId,
      { actorId: params.actorUserId, actorType: 'admin' },
      params.reason,
      { action: 'top_up', topUpAmount: params.topUpAmount },
    );

    await auditLogService.logAudit({
      userId: params.actorUserId,
      userName: params.actorEmail,
      userEmail: params.actorEmail,
      action: 'tenant_execution_resume_top_up',
      resourceType: 'tenant_execution_state',
      resourceId: params.organizationId,
      details: { reason: params.reason, topUpAmount: params.topUpAmount, nextDailyLimit: nextPolicy.dailyLimit },
      status: 'success',
    });
  }
}
