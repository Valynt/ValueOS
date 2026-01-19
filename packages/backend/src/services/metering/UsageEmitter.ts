/**
 * Usage Emitter
 * Emits usage events from services to database queue
 */

import { createClient } from "@supabase/supabase-js";
import { BillingMetric } from "../../config/billing";
import { createLogger } from "../../lib/logger";

const logger = createLogger({ component: "UsageEmitter" });

// Server-only Supabase client
const supabase =
  typeof window === "undefined"
    ? createClient(
        import.meta.env?.VITE_SUPABASE_URL || "",
        import.meta.env?.SUPABASE_SERVICE_ROLE_KEY || ""
      )
    : (null as any);

// In-memory buffer for failed events (dead-letter queue)
interface FailedUsageEvent {
  tenantId: string;
  metric: BillingMetric;
  amount: number;
  requestId: string;
  metadata?: Record<string, any>;
  retryCount: number;
  lastError: string;
  timestamp: string;
}

const MAX_RETRY_COUNT = 3;
const RETRY_DELAY_MS = 5000;
const failedEventsBuffer: FailedUsageEvent[] = [];

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
      const { error } = await supabase.from("usage_events").insert({
        tenant_id: tenantId,
        metric,
        amount,
        request_id: requestId,
        metadata: metadata || {},
        processed: false,
        timestamp: new Date().toISOString(),
      });

      if (error) {
        logger.error("Failed to emit usage event", error, {
          tenantId,
          metric,
          amount,
        });
        // Add to dead-letter queue for retry
        this.addToDeadLetterQueue(
          tenantId,
          metric,
          amount,
          requestId,
          metadata,
          error.message
        );
      } else {
        logger.debug("Usage event emitted", { tenantId, metric, amount });
      }
    } catch (error) {
      logger.error("Error emitting usage", error as Error);
      // Add to dead-letter queue for retry
      this.addToDeadLetterQueue(
        tenantId,
        metric,
        amount,
        requestId,
        metadata,
        (error as Error).message
      );
    }
  }

  /**
   * Add failed event to dead-letter queue for retry
   */
  private addToDeadLetterQueue(
    tenantId: string,
    metric: BillingMetric,
    amount: number,
    requestId: string,
    metadata: Record<string, any> | undefined,
    errorMessage: string
  ): void {
    // Prevent unbounded growth - cap at 10000 events
    if (failedEventsBuffer.length >= 10000) {
      logger.warn("Dead-letter queue full, dropping oldest event");
      failedEventsBuffer.shift();
    }

    failedEventsBuffer.push({
      tenantId,
      metric,
      amount,
      requestId,
      metadata,
      retryCount: 0,
      lastError: errorMessage,
      timestamp: new Date().toISOString(),
    });

    logger.debug("Event added to dead-letter queue", {
      tenantId,
      metric,
      queueSize: failedEventsBuffer.length,
    });
  }

  /**
   * Retry failed events from dead-letter queue
   * Should be called periodically by a background job
   */
  async retryFailedEvents(): Promise<{
    retried: number;
    failed: number;
    dropped: number;
  }> {
    const results = { retried: 0, failed: 0, dropped: 0 };
    const eventsToRetry = [...failedEventsBuffer];
    failedEventsBuffer.length = 0; // Clear the buffer

    for (const event of eventsToRetry) {
      if (event.retryCount >= MAX_RETRY_COUNT) {
        // Store in dead_letter_events table for manual review
        await this.persistToDeadLetterTable(event);
        results.dropped++;
        continue;
      }

      try {
        const { error } = await supabase.from("usage_events").insert({
          tenant_id: event.tenantId,
          metric: event.metric,
          amount: event.amount,
          request_id: event.requestId,
          metadata: event.metadata || {},
          processed: false,
          timestamp: event.timestamp,
        });

        if (error) {
          event.retryCount++;
          event.lastError = error.message;
          failedEventsBuffer.push(event);
          results.failed++;
        } else {
          results.retried++;
        }
      } catch (err) {
        event.retryCount++;
        event.lastError = (err as Error).message;
        failedEventsBuffer.push(event);
        results.failed++;
      }
    }

    if (results.retried > 0 || results.dropped > 0) {
      logger.info("Retry results", results);
    }

    return results;
  }

  /**
   * Persist permanently failed events to database for manual review
   */
  private async persistToDeadLetterTable(
    event: FailedUsageEvent
  ): Promise<void> {
    try {
      await supabase.from("dead_letter_events").insert({
        event_type: "usage_event",
        tenant_id: event.tenantId,
        payload: {
          metric: event.metric,
          amount: event.amount,
          request_id: event.requestId,
          metadata: event.metadata,
          original_timestamp: event.timestamp,
        },
        error_message: event.lastError,
        retry_count: event.retryCount,
        created_at: new Date().toISOString(),
      });
      logger.warn("Event persisted to dead-letter table", {
        tenantId: event.tenantId,
        metric: event.metric,
      });
    } catch (err) {
      logger.error("Failed to persist to dead-letter table", err as Error);
    }
  }

  /**
   * Get current dead-letter queue size
   */
  getDeadLetterQueueSize(): number {
    return failedEventsBuffer.length;
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
    await this.emitUsage(tenantId, "llm_tokens", tokens, requestId, { model });
  }

  /**
   * Emit agent execution
   */
  async emitAgentExecution(
    tenantId: string,
    requestId: string,
    agentType?: string
  ): Promise<void> {
    await this.emitUsage(tenantId, "agent_executions", 1, requestId, {
      agentType,
    });
  }

  /**
   * Emit API call
   */
  async emitAPICall(
    tenantId: string,
    requestId: string,
    endpoint?: string
  ): Promise<void> {
    await this.emitUsage(tenantId, "api_calls", 1, requestId, { endpoint });
  }

  /**
   * Emit storage usage (current size)
   */
  async emitStorageUsage(
    tenantId: string,
    sizeGB: number,
    requestId: string
  ): Promise<void> {
    await this.emitUsage(tenantId, "storage_gb", sizeGB, requestId);
  }

  /**
   * Emit user seat count (active users)
   */
  async emitUserSeats(
    tenantId: string,
    userCount: number,
    requestId: string
  ): Promise<void> {
    await this.emitUsage(tenantId, "user_seats", userCount, requestId);
  }
}

export default new UsageEmitter();
