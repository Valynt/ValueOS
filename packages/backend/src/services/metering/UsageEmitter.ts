/**
 * Usage Emitter
 * Emits usage events from services to database queue and billing usage ledger.
 */

import { type SupabaseClient } from "@supabase/supabase-js";

import { BillingMetric } from "../../config/billing.js";
import { createLogger } from "../../lib/logger.js";
import { UsageLedgerIngestionService } from "../billing/UsageLedgerIngestionService.js";

const logger = createLogger({ component: "UsageEmitter" });

interface BillableContext {
  evidenceLink?: string;
  agentId?: string;
}

// In-memory buffer for failed events (dead-letter queue)
interface FailedUsageEvent {
  tenantId: string;
  metric: BillingMetric;
  amount: number;
  requestId: string;
  metadata?: Record<string, unknown>;
  retryCount: number;
  lastError: string;
  timestamp: string;
}

const MAX_RETRY_COUNT = 3;
const failedEventsBuffer: FailedUsageEvent[] = [];

class UsageEmitter {
  private readonly usageLedgerIngestionService: UsageLedgerIngestionService;

  constructor(private readonly supabase: SupabaseClient) {
    this.usageLedgerIngestionService = new UsageLedgerIngestionService(supabase);
  }

  private resolveEvidenceLink(requestId: string, context?: BillableContext): string {
    return context?.evidenceLink ?? `trace://usage/${requestId}`;
  }

  private resolveAgentId(metric: BillingMetric, context?: BillableContext): string {
    return context?.agentId ?? metric;
  }

  /**
   * Emit usage event (non-blocking)
   */
  async emitUsage(
    tenantId: string,
    metric: BillingMetric,
    amount: number,
    requestId: string,
    metadata?: Record<string, unknown>,
    context?: BillableContext
  ): Promise<void> {
    try {
      const { error } = await this.supabase.from("usage_events").insert({
        tenant_id: tenantId,
        metric,
        amount,
        request_id: requestId,
        metadata: metadata || {},
        processed: false,
        timestamp: new Date().toISOString(),
      });

      if (error) {
        logger.error("Failed to emit usage event", error, { tenantId, metric, amount });
        this.addToDeadLetterQueue(tenantId, metric, amount, requestId, metadata, error.message);
      }

      await this.usageLedgerIngestionService.ingest({
        tenantId,
        agentId: this.resolveAgentId(metric, context),
        valueUnits: amount,
        requestId,
        evidenceLink: this.resolveEvidenceLink(requestId, context),
      });
    } catch (error) {
      logger.error("Error emitting usage", error as Error);
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

  private addToDeadLetterQueue(
    tenantId: string,
    metric: BillingMetric,
    amount: number,
    requestId: string,
    metadata: Record<string, unknown> | undefined,
    errorMessage: string
  ): void {
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
  }

  async retryFailedEvents(): Promise<{ retried: number; failed: number; dropped: number }> {
    const results = { retried: 0, failed: 0, dropped: 0 };
    const eventsToRetry = [...failedEventsBuffer];
    failedEventsBuffer.length = 0;

    for (const event of eventsToRetry) {
      if (event.retryCount >= MAX_RETRY_COUNT) {
        await this.persistToDeadLetterTable(event);
        results.dropped++;
        continue;
      }

      try {
        const { error } = await this.supabase.from("usage_events").insert({
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

    return results;
  }

  private async persistToDeadLetterTable(event: FailedUsageEvent): Promise<void> {
    try {
      await this.supabase.from("dead_letter_events").insert({
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
    } catch (err) {
      logger.error("Failed to persist to dead-letter table", err as Error);
    }
  }

  getDeadLetterQueueSize(): number {
    return failedEventsBuffer.length;
  }

  async emitLLMTokens(
    tenantId: string,
    tokens: number,
    requestId: string,
    model?: string,
    evidenceLink?: string
  ): Promise<void> {
    await this.emitUsage(
      tenantId,
      "llm_tokens",
      tokens,
      requestId,
      { model },
      { evidenceLink, agentId: "llm" }
    );
  }

  async emitAgentExecution(
    tenantId: string,
    requestId: string,
    agentType?: string,
    evidenceLink?: string
  ): Promise<void> {
    await this.emitUsage(
      tenantId,
      "agent_executions",
      1,
      requestId,
      { agentType },
      { evidenceLink, agentId: agentType ?? "agent_execution" }
    );
  }

  async emitAPICall(
    tenantId: string,
    requestId: string,
    endpoint?: string,
    evidenceLink?: string
  ): Promise<void> {
    await this.emitUsage(
      tenantId,
      "api_calls",
      1,
      requestId,
      { endpoint },
      { evidenceLink, agentId: "api" }
    );
  }

  async emitStorageUsage(
    tenantId: string,
    sizeGB: number,
    requestId: string,
    evidenceLink?: string
  ): Promise<void> {
    await this.emitUsage(
      tenantId,
      "storage_gb",
      sizeGB,
      requestId,
      undefined,
      { evidenceLink, agentId: "storage" }
    );
  }

  async emitUserSeats(
    tenantId: string,
    userCount: number,
    requestId: string,
    evidenceLink?: string
  ): Promise<void> {
    await this.emitUsage(
      tenantId,
      "user_seats",
      userCount,
      requestId,
      undefined,
      { evidenceLink, agentId: "user_seats" }
    );
  }
}

export default UsageEmitter;
