/**
 * Usage Emitter
 * Emits usage events from services to metering queue.
 */

import { type SupabaseClient } from '@supabase/supabase-js';

import { BillingMetric } from '../../config/billing.js';
import { createLogger } from '../../lib/logger.js';

import { UsageQueueProducer } from './UsageQueueProducer.js';

const logger = createLogger({ component: 'UsageEmitter' });

export class UsageEmitter {
  private readonly queueProducer: UsageQueueProducer;

  constructor(_supabase?: SupabaseClient, queueProducer: UsageQueueProducer = new UsageQueueProducer()) {
    this.queueProducer = queueProducer;
  }

  async emitUsage(
    tenantId: string,
    metric: BillingMetric,
    amount: number,
    requestId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.queueProducer.publishUsageEvent({
        tenantId,
        metric,
        amount,
        requestId,
        metadata,
        idempotencyKey: requestId,
      });
    } catch (error) {
      logger.error('Failed to enqueue usage event', error as Error, {
        tenantId,
        metric,
        requestId,
      });
    }
  }

  async emitLLMTokens(tenantId: string, tokens: number, requestId: string, model?: string): Promise<void> {
    await this.emitUsage(tenantId, 'llm_tokens', tokens, requestId, { model });
  }

  async emitAgentExecution(tenantId: string, requestId: string, agentType?: string): Promise<void> {
    await this.emitUsage(tenantId, 'agent_executions', 1, requestId, { agentType });
  }

  async emitAPICall(tenantId: string, requestId: string, endpoint?: string): Promise<void> {
    await this.emitUsage(tenantId, 'api_calls', 1, requestId, { endpoint });
  }

  async emitStorageUsage(tenantId: string, sizeGB: number, requestId: string): Promise<void> {
    await this.emitUsage(tenantId, 'storage_gb', sizeGB, requestId);
  }

  async emitUserSeats(tenantId: string, userCount: number, requestId: string): Promise<void> {
    await this.emitUsage(tenantId, 'user_seats', userCount, requestId);
  }
}

export const usageEmitter = new UsageEmitter();

export default usageEmitter;
