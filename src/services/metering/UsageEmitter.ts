/**
 * Usage Emitter
 * Emits usage events from services to database queue
 */

import { createClient } from '@supabase/supabase-js';
import { BillingMetric } from '../../config/billing';
import { createLogger } from '../../lib/logger';

const logger = createLogger({ component: 'UsageEmitter' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

class UsageEmitter {
  /**
   * Emit usage event (non-blocking)
   */
  async emitUsage(
    tenantId: string,
    metric: BillingMetric,
    amount: number,
    requestId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // Non-blocking insert
      const { error } = await supabase
        .from('usage_events')
        .insert({
          tenant_id: tenantId,
          metric,
          amount,
          request_id: requestId,
          metadata: metadata || {},
          processed: false,
          timestamp: new Date().toISOString(),
        });

      if (error) {
        logger.error('Failed to emit usage event', error, {
          tenantId,
          metric,
          amount,
        });
        // Don't throw - usage tracking shouldn't block requests
      } else {
        logger.debug('Usage event emitted', { tenantId, metric, amount });
      }
    } catch (error) {
      logger.error('Error emitting usage', error as Error);
      // Silently fail to not impact user requests
    }
  }

  /**
   * Emit LLM token usage
   */
  async emitLLMTokens(
    tenantId: string,
    tokens: number,
    requestId: string,
    model?: string
  ): Promise<void> {
    await this.emitUsage(tenantId, 'llm_tokens', tokens, requestId, { model });
  }

  /**
   * Emit agent execution
   */
  async emitAgentExecution(
    tenantId: string,
    requestId: string,
    agentType?: string
  ): Promise<void> {
    await this.emitUsage(tenantId, 'agent_executions', 1, requestId, { agentType });
  }

  /**
   * Emit API call
   */
  async emitAPICall(
    tenantId: string,
    requestId: string,
    endpoint?: string
  ): Promise<void> {
    await this.emitUsage(tenantId, 'api_calls', 1, requestId, { endpoint });
  }

  /**
   * Emit storage usage (current size)
   */
  async emitStorageUsage(
    tenantId: string,
    sizeGB: number,
    requestId: string
  ): Promise<void> {
    await this.emitUsage(tenantId, 'storage_gb', sizeGB, requestId);
  }

  /**
   * Emit user seat count (active users)
   */
  async emitUserSeats(
    tenantId: string,
    userCount: number,
    requestId: string
  ): Promise<void> {
    await this.emitUsage(tenantId, 'user_seats', userCount, requestId);
  }
}

export default new UsageEmitter();
