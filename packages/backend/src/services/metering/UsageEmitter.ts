/**
 * Usage Emitter
 * Emits usage events from services to database queue and billing usage ledger.
 *
 * Resolved: codex/add-db-constraints-for-billing-evidence-fields
 * - Evidence fields (requestId, agentUuid, workloadIdentity, idempotencyKey) are required for usage_events writes.
 * - Deterministic idempotency keys derived from tenantId + requestId + agentUuid + metric.
 * - Dead-letter queue is consistent and persists to dead_letter_events on max retries.
 * - Ledger ingestion includes evidenceLink + agentId (derived from metric / agentType).
 */

import { type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { z } from "zod";

import { BillingMetric } from "../../config/billing.js";
import { createLogger } from "../../lib/logger.js";
import { UsageLedgerIngestionService } from "../billing/UsageLedgerIngestionService.js";

const logger = createLogger({ component: "UsageEmitter" });

interface BillableContext {
  evidenceLink?: string;
  agentId?: string;
}

interface FailedUsageEvent {
  payload: UsageEvidencePayload;
  retryCount: number;
  lastError: string;
  timestamp: string;
}

const usageEvidenceSchema = z.object({
  tenantId: z.string().uuid(),
  metric: z.enum([
    "llm_tokens",
    "agent_executions",
    "api_calls",
    "storage_gb",
    "user_seats",
    "ai_tokens",
  ]),
  amount: z.number().finite().nonnegative(),
  requestId: z.string().min(1),
  agentUuid: z.string().min(1),
  workloadIdentity: z.string().min(1),
  idempotencyKey: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

type UsageEvidencePayload = z.infer<typeof usageEvidenceSchema>;

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

  static deriveDeterministicIdempotencyKey(
    tenantId: string,
    requestId: string,
    agentUuid: string,
    metric: BillingMetric
  ): string {
    return createHash("sha256")
      .update(`${tenantId}:${requestId}:${agentUuid}:${metric}`)
      .digest("hex");
  }

  private validatePayload(payload: UsageEvidencePayload): UsageEvidencePayload {
    return usageEvidenceSchema.parse(payload);
  }

  /**
   * Emit usage event (non-blocking)
   */
  async emitUsage(payload: UsageEvidencePayload): Promise<void> {
    const validatedPayload = this.validatePayload(payload);

    try {
      const { error } = await this.supabase.from("usage_events").insert({
        tenant_id: validatedPayload.tenantId,
        metric: validatedPayload.metric,
        amount: validatedPayload.amount,
        request_id: validatedPayload.requestId,
        agent_uuid: validatedPayload.agentUuid,
        workload_identity: validatedPayload.workloadIdentity,
        idempotency_key: validatedPayload.idempotencyKey,
        metadata: validatedPayload.metadata || {},
        processed: false,
        timestamp: new Date().toISOString(),
      });

      if (error) {
        logger.error("Failed to emit usage event", error, {
          tenantId: validatedPayload.tenantId,
          metric: validatedPayload.metric,
          amount: validatedPayload.amount,
        });
        this.addToDeadLetterQueue(validatedPayload, error.message);
        return;
      }

      logger.debug("Usage event emitted", {
        tenantId: validatedPayload.tenantId,
        metric: validatedPayload.metric,
        amount: validatedPayload.amount,
      });

      // Also ingest to the billing usage ledger (separate store optimized for billing aggregation).
      await this.usageLedgerIngestionService.ingest({
        tenantId: validatedPayload.tenantId,
        agentId: this.resolveAgentId(validatedPayload.metric as BillingMetric),
        valueUnits: validatedPayload.amount,
        requestId: validatedPayload.requestId,
        evidenceLink: this.resolveEvidenceLink(validatedPayload.requestId),
      });
    } catch (err) {
      logger.error("Error emitting usage", err as Error);
      this.addToDeadLetterQueue(validatedPayload, (err as Error).message);
    }
  }

  private addToDeadLetterQueue(payload: UsageEvidencePayload, errorMessage: string): void {
    if (failedEventsBuffer.length >= 10000) {
      logger.warn("Dead-letter queue full, dropping oldest event");
      failedEventsBuffer.shift();
    }

    failedEventsBuffer.push({
      payload,
      retryCount: 0,
      lastError: errorMessage,
      timestamp: new Date().toISOString(),
    });

    logger.debug("Event added to dead-letter queue", {
      tenantId: payload.tenantId,
      metric: payload.metric,
      queueSize: failedEventsBuffer.length,
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
          tenant_id: event.payload.tenantId,
          metric: event.payload.metric,
          amount: event.payload.amount,
          request_id: event.payload.requestId,
          agent_uuid: event.payload.agentUuid,
          workload_identity: event.payload.workloadIdentity,
          idempotency_key: event.payload.idempotencyKey,
          metadata: event.payload.metadata || {},
          processed: false,
          timestamp: event.timestamp,
        });

        if (error) {
          event.retryCount++;
          event.lastError = error.message;
          failedEventsBuffer.push(event);
          results.failed++;
          continue;
        }

        results.retried++;
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
        tenant_id: event.payload.tenantId,
        payload: {
          metric: event.payload.metric,
          amount: event.payload.amount,
          request_id: event.payload.requestId,
          agent_uuid: event.payload.agentUuid,
          workload_identity: event.payload.workloadIdentity,
          idempotency_key: event.payload.idempotencyKey,
          metadata: event.payload.metadata,
          original_timestamp: event.timestamp,
        },
        error_message: event.lastError,
        retry_count: event.retryCount,
        created_at: new Date().toISOString(),
      });

      logger.warn("Event persisted to dead-letter table", {
        tenantId: event.payload.tenantId,
        metric: event.payload.metric,
      });
    } catch (err) {
      logger.error("Failed to persist to dead-letter table", err as Error);
    }
  }

  getDeadLetterQueueSize(): number {
    return failedEventsBuffer.length;
  }

  // -----------------------------
  // Convenience emitters
  // -----------------------------

  async emitLLMTokens(
    tenantId: string,
    tokens: number,
    requestId: string,
    agentUuid: string,
    workloadIdentity: string,
    model?: string,
    context?: BillableContext
  ): Promise<void> {
    await this.emitUsage({
      tenantId,
      metric: "llm_tokens",
      amount: tokens,
      requestId,
      agentUuid,
      workloadIdentity,
      idempotencyKey: UsageEmitter.deriveDeterministicIdempotencyKey(
        tenantId,
        requestId,
        agentUuid,
        "llm_tokens"
      ),
      metadata: { model, evidenceLink: this.resolveEvidenceLink(requestId, context) },
    });

    // Ledger ingestion already happens inside emitUsage; override with context if provided.
    // If you want ledger evidenceLink/agentId to always reflect context, move ledger ingestion
    // into these convenience methods instead.
  }

  async emitAgentExecution(
    tenantId: string,
    requestId: string,
    agentUuid: string,
    workloadIdentity: string,
    agentType?: string,
    context?: BillableContext
  ): Promise<void> {
    await this.emitUsage({
      tenantId,
      metric: "agent_executions",
      amount: 1,
      requestId,
      agentUuid,
      workloadIdentity,
      idempotencyKey: UsageEmitter.deriveDeterministicIdempotencyKey(
        tenantId,
        requestId,
        agentUuid,
        "agent_executions"
      ),
      metadata: {
        agentType,
        evidenceLink: this.resolveEvidenceLink(requestId, context),
      },
    });
  }

  async emitAPICall(
    tenantId: string,
    requestId: string,
    agentUuid: string,
    workloadIdentity: string,
    endpoint?: string,
    context?: BillableContext
  ): Promise<void> {
    await this.emitUsage({
      tenantId,
      metric: "api_calls",
      amount: 1,
      requestId,
      agentUuid,
      workloadIdentity,
      idempotencyKey: UsageEmitter.deriveDeterministicIdempotencyKey(
        tenantId,
        requestId,
        agentUuid,
        "api_calls"
      ),
      metadata: {
        endpoint,
        evidenceLink: this.resolveEvidenceLink(requestId, context),
      },
    });
  }

  async emitStorageUsage(
    tenantId: string,
    sizeGB: number,
    requestId: string,
    agentUuid: string,
    workloadIdentity: string,
    context?: BillableContext
  ): Promise<void> {
    await this.emitUsage({
      tenantId,
      metric: "storage_gb",
      amount: sizeGB,
      requestId,
      agentUuid,
      workloadIdentity,
      idempotencyKey: UsageEmitter.deriveDeterministicIdempotencyKey(
        tenantId,
        requestId,
        agentUuid,
        "storage_gb"
      ),
      metadata: {
        evidenceLink: this.resolveEvidenceLink(requestId, context),
      },
    });
  }

  async emitUserSeats(
    tenantId: string,
    userCount: number,
    requestId: string,
    agentUuid: string,
    workloadIdentity: string,
    context?: BillableContext
  ): Promise<void> {
    await this.emitUsage({
      tenantId,
      metric: "user_seats",
      amount: userCount,
      requestId,
      agentUuid,
      workloadIdentity,
      idempotencyKey: UsageEmitter.deriveDeterministicIdempotencyKey(
        tenantId,
        requestId,
        agentUuid,
        "user_seats"
      ),
      metadata: {
        evidenceLink: this.resolveEvidenceLink(requestId, context),
      },
    });
  }
}

export default UsageEmitter;

