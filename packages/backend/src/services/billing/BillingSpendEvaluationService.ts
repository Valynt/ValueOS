import { EventEmitter } from 'node:events';

import type { SupabaseClient } from '@supabase/supabase-js';

import { logger } from '../../lib/logger.js';
import { MessageBus } from '../realtime/MessageBus.js';

import { TenantExecutionStateService } from './TenantExecutionStateService.js';

interface LlmSpendingLimitsConfig {
  dailyLimit?: number;
  dailySpend?: number;
  alertThreshold?: number;
  monthlyHardCap?: number;
  monthlySoftCap?: number;
  perRequestLimit?: number;
  alertRecipients?: string[];
  organizationId?: string;
}

export interface SpendThresholdEvent {
  organizationId: string;
  dailyLimit: number;
  dailySpend: number;
  usagePercent: number;
  threshold: 'warning' | 'critical';
  occurredAt: string;
}

export class BillingSpendEvaluationService extends EventEmitter {
  private readonly messageBus: MessageBus;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly executionStateService: TenantExecutionStateService,
  ) {
    super();
    this.messageBus = new MessageBus();
  }

  async evaluateAllTenantsDailySpend(): Promise<SpendThresholdEvent[]> {
    const { data, error } = await this.supabase
      .from('organization_configurations')
      .select('organization_id,llm_spending_limits');

    if (error) {
      throw new Error(`Failed to fetch spending policies: ${error.message}`);
    }

    const events: SpendThresholdEvent[] = [];
    for (const configRow of data ?? []) {
      const orgId = String((configRow as Record<string, unknown>).organization_id ?? '');
      if (!orgId) {
        continue;
      }

      const event = await this.evaluateTenantDailySpend(orgId);
      if (event) {
        events.push(event);
      }
    }

    return events;
  }

  async evaluateTenantDailySpend(organizationId: string): Promise<SpendThresholdEvent | null> {
    const policy = await this.getTenantPolicy(organizationId);
    const dailyLimit = Number(policy.dailyLimit ?? 0);

    if (dailyLimit <= 0) {
      return null;
    }

    const dailySpend = await this.computeDailySpend(organizationId);
    await this.updatePolicySpend(organizationId, policy, dailySpend);

    const usagePercent = (dailySpend / dailyLimit) * 100;
    const alertThreshold = Number(policy.alertThreshold ?? 80);

    if (usagePercent >= 100) {
      const event = await this.emitThresholdEvent(organizationId, dailyLimit, dailySpend, usagePercent, 'critical');
      await this.executionStateService.pauseTenantExecution(
        organizationId,
        `Daily spend limit exceeded (${dailySpend.toFixed(2)} / ${dailyLimit.toFixed(2)} USD)`,
        { actorId: 'system:billing-spend-evaluator', actorType: 'system' },
        { dailyLimit, dailySpend, usagePercent },
      );
      return event;
    }

    if (usagePercent >= alertThreshold) {
      return this.emitThresholdEvent(organizationId, dailyLimit, dailySpend, usagePercent, 'warning');
    }

    return null;
  }

  private async getTenantPolicy(organizationId: string): Promise<LlmSpendingLimitsConfig> {
    const { data, error } = await this.supabase
      .from('organization_configurations')
      .select('llm_spending_limits')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch spending policy: ${error.message}`);
    }

    return ((data as { llm_spending_limits?: LlmSpendingLimitsConfig } | null)?.llm_spending_limits ?? {}) as LlmSpendingLimitsConfig;
  }

  private async computeDailySpend(organizationId: string): Promise<number> {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    const { data, error } = await this.supabase
      .from('rated_ledger')
      .select('amount,tenant_id,rated_at')
      .eq('tenant_id', organizationId)
      .gte('rated_at', start.toISOString())
      .lt('rated_at', end.toISOString());

    if (error) {
      throw new Error(`Failed to compute daily spend: ${error.message}`);
    }

    return (data ?? []).reduce((sum, row) => {
      const amount = Number((row as Record<string, unknown>).amount ?? 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
  }

  private async updatePolicySpend(
    organizationId: string,
    policy: LlmSpendingLimitsConfig,
    dailySpend: number,
  ): Promise<void> {
    const nextPolicy: LlmSpendingLimitsConfig = {
      ...policy,
      dailySpend,
    };

    const { error } = await this.supabase
      .from('organization_configurations')
      .update({
        llm_spending_limits: nextPolicy,
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', organizationId);

    if (error) {
      throw new Error(`Failed to persist daily spend: ${error.message}`);
    }
  }

  private async emitThresholdEvent(
    organizationId: string,
    dailyLimit: number,
    dailySpend: number,
    usagePercent: number,
    threshold: 'warning' | 'critical',
  ): Promise<SpendThresholdEvent> {
    const event: SpendThresholdEvent = {
      organizationId,
      dailyLimit,
      dailySpend,
      usagePercent,
      threshold,
      occurredAt: new Date().toISOString(),
    };

    this.emit('billing.daily_spend.threshold', event);

    await this.messageBus.publishMessage('billing.daily_spend.threshold', {
      event_type: 'alert',
      sender_id: 'billing-spend-evaluator',
      recipient_ids: ['billing-monitor'],
      recipient_agent: 'billing-monitor',
      message_type: 'status_update',
      tenant_id: organizationId,
      organization_id: organizationId,
      content: `Daily spend ${threshold} threshold reached`,
      payload: event,
      metadata: {
        priority: threshold === 'critical' ? 'high' : 'medium',
      },
    });

    logger.warn('Billing spend threshold event emitted', event);
    return event;
  }
}

export class BillingSpendEvaluationJob {
  constructor(private readonly spendEvaluationService: BillingSpendEvaluationService) {}

  async run(): Promise<SpendThresholdEvent[]> {
    return this.spendEvaluationService.evaluateAllTenantsDailySpend();
  }
}
