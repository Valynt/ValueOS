/**
 * Usage Emitter
 * Emits usage events from services to:
 *  1) metering queue (authoritative async processing path)
 *  2) usage_events table (append-only evidence / audit trail)
 *  3) billing usage ledger (aggregation-optimized store)
 *
 * Resolved: codex/add-db-constraints-for-billing-evidence-fields
 * - Evidence fields (requestId, agentUuid, workloadIdentity, idempotencyKey) are required.
 * - Deterministic idempotency keys derived from tenantId + requestId + agentUuid + metric.
 * - Dead-letter queue is consistent and persists to dead_letter_events on max retries.
 *
 * Resolved: codex/add-queue-integration-module-for-metering
 * - Publishes the same evidence payload to UsageQueueProducer (queue-first).
 */

import { createHash } from "crypto";

import { type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { BillingMetric } from "../../config/billing.js";
import { createLogger } from "../../lib/logger.js";
import { UsageLedgerIngestionService } from "../billing/UsageLedgerIngestionService.js";

import { UsageQueueProducer } from "./UsageQueueProducer.js";

const logger = createLogger({ component: "UsageEmitter" });

interface BillableContext {
  evidenceLink?: string;
  agentId?: string; // logical agent identifier for ledger aggregation (e.g., "llm" or agentType)
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

interface FailedUsageEvent {
  id?: string;
  payload: UsageEvidencePayload;
  retryCount: number;
  lastError: string;
  timestamp: string;
}

const MAX_RETRY_COUNT = 3;
const MAX_RETRY_BATCH_SIZE = 100;
const REPLAY_COMPLETED_MARKER = "__replay_completed__";
const REPLAY_EVENT_TYPE = "usage_event_replay";
const failedEventsBuffer: FailedUsageEvent[] = [];

class UsageEmitter {
  private readonly usageLedgerIngestionService: UsageLedgerIngestionService;
  private readonly queueProducer: UsageQueueProducer;

  constructor(
    private readonly supabase: SupabaseClient,
    queueProducer: UsageQueueProducer = new UsageQueueProducer()
  ) {
    this.usageLedgerIngestionService = new UsageLedgerIngestionService(supabase);
    this.queueProducer = queueProducer;
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
   *
   * Behavior:
   * - Queue publish first (authoritative async processor)
   * - Append to usage_events (evidence trail)
   * - Ingest to usage ledger (billing aggregation)
   *
   * Any failures go to in-memory DLQ and can be retried/persisted.
   */
  async emitUsage(payload: UsageEvidencePayload, context?: BillableContext): Promise<void> {
    const validatedPayload = this.validatePayload(payload);
    const nowIso = new Date().toISOString();

    try {
      // 1) Publish to queue
      await this.queueProducer.publishUsageEvent({
        tenantId: validatedPayload.tenantId,
        metric: validatedPayload.metric as BillingMetric,
        amount: validatedPayload.amount,
        requestId: validatedPayload.requestId,
        metadata: validatedPayload.metadata,
        idempotencyKey: validatedPayload.idempotencyKey,
        agentUuid: validatedPayload.agentUuid,
        workloadIdentity: validatedPayload.workloadIdentity,
        evidenceLink: this.resolveEvidenceLink(validatedPayload.requestId, context),
      });

      // 2) Append to evidence table (best-effort but strongly preferred)
      const { error: insertError } = await this.supabase.from("usage_events").insert({
        tenant_id: validatedPayload.tenantId,
        metric: validatedPayload.metric,
        amount: validatedPayload.amount,
        request_id: validatedPayload.requestId,
        agent_uuid: validatedPayload.agentUuid,
        workload_identity: validatedPayload.workloadIdentity,
        idempotency_key: validatedPayload.idempotencyKey,
        metadata: validatedPayload.metadata || {},
        processed: false,
        timestamp: nowIso,
      });

      if (insertError) {
        logger.error("Failed to append usage evidence (usage_events)", insertError, {
          tenantId: validatedPayload.tenantId,
          metric: validatedPayload.metric,
          amount: validatedPayload.amount,
        });
        await this.addToDeadLetterQueue(validatedPayload, insertError.message);
        // continue: ledger ingestion can still proceed
      }

      // 3) Ingest into ledger (aggregation-optimized)
      await this.usageLedgerIngestionService.ingest({
        tenantId: validatedPayload.tenantId,
        agentId: this.resolveAgentId(validatedPayload.metric as BillingMetric, context),
        valueUnits: validatedPayload.amount,
        requestId: validatedPayload.requestId,
        evidenceLink: this.resolveEvidenceLink(validatedPayload.requestId, context),
      });

      logger.debug("Usage emitted", {
        tenantId: validatedPayload.tenantId,
        metric: validatedPayload.metric,
        amount: validatedPayload.amount,
      });
    } catch (err) {
      logger.error("Error emitting usage", err as Error, {
        tenantId: validatedPayload.tenantId,
        metric: validatedPayload.metric,
        amount: validatedPayload.amount,
      });
      await this.addToDeadLetterQueue(validatedPayload, (err as Error).message);
    }
  }

  private async addToDeadLetterQueue(payload: UsageEvidencePayload, errorMessage: string): Promise<void> {
    await this.persistToDeadLetterTable({
      payload,
      retryCount: 0,
      lastError: errorMessage,
      timestamp: new Date().toISOString(),
    });

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

  getDeadLetterQueueSize(): number {
    return failedEventsBuffer.length;
  }

  async retryFailedEvents(): Promise<{ retried: number; failed: number; dropped: number }> {
    const results = { retried: 0, failed: 0, dropped: 0 };

    const durableEvents = await this.fetchRetriableDeadLetterEvents();
    const eventsToRetry = [...durableEvents, ...failedEventsBuffer];
    const seenIdempotencyKeys = new Set<string>();
    failedEventsBuffer.length = 0;

    const dedupedEventsToRetry = eventsToRetry.filter((event) => {
      if (seenIdempotencyKeys.has(event.payload.idempotencyKey)) {
        return false;
      }

      seenIdempotencyKeys.add(event.payload.idempotencyKey);
      return true;
    });


    for (const event of dedupedEventsToRetry) {
      if (await this.hasReplayBeenCompleted(event)) {
        await this.markDeadLetterReplayComplete(event);
        results.dropped++;
        continue;
      }

      if (event.retryCount >= MAX_RETRY_COUNT) {
        results.dropped++;
        continue;
      }

      try {
        // Re-run full emit pipeline (queue + evidence + ledger)
        await this.emitUsage(event.payload);
        await this.recordReplayCompletion(event);
        await this.markDeadLetterReplayComplete(event);

        results.retried++;
      } catch (err) {
        event.retryCount++;
        event.lastError = (err as Error).message;
        await this.persistRetryAttempt(event);

        if (failedEventsBuffer.length < 10000) {
          failedEventsBuffer.push(event);
        }

        results.failed++;
      }
    }

    return results;
  }

  private async fetchRetriableDeadLetterEvents(): Promise<FailedUsageEvent[]> {
    const query = this.supabase
      .from("dead_letter_events")
      .select("id, tenant_id, payload, retry_count, error_message, created_at")
      .eq("event_type", "usage_event")
      .lt("retry_count", MAX_RETRY_COUNT)
      .neq("error_message", REPLAY_COMPLETED_MARKER)
      .order("created_at", { ascending: true })
      .limit(MAX_RETRY_BATCH_SIZE);

    const { data, error } = await query;

    if (error) {
      logger.error("Failed to fetch dead-letter events for retry", error);
      return [];
    }

    if (!Array.isArray(data)) {
      return [];
    }

    const parsedEvents: FailedUsageEvent[] = [];

    for (const row of data) {
      const candidatePayload =
        typeof row.payload === "object" && row.payload !== null
          ? (row.payload as Record<string, unknown>)
          : {};

      const parsedPayload = usageEvidenceSchema.safeParse({
        tenantId: String(row.tenant_id ?? candidatePayload.tenant_id ?? ""),
        metric: candidatePayload.metric,
        amount: candidatePayload.amount,
        requestId: candidatePayload.request_id,
        agentUuid: candidatePayload.agent_uuid,
        workloadIdentity: candidatePayload.workload_identity,
        idempotencyKey: candidatePayload.idempotency_key,
        metadata: candidatePayload.metadata,
      });

      if (!parsedPayload.success) {
        logger.warn("Skipping malformed dead-letter usage payload", {
          deadLetterId: row.id,
        });
        continue;
      }

      parsedEvents.push({
        id: typeof row.id === "string" ? row.id : undefined,
        payload: parsedPayload.data,
        retryCount: typeof row.retry_count === "number" ? row.retry_count : 0,
        lastError: typeof row.error_message === "string" ? row.error_message : "",
        timestamp: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
      });
    }

    return parsedEvents;
  }

  private async hasReplayBeenCompleted(event: FailedUsageEvent): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("dead_letter_events")
      .select("id")
      .eq("event_type", REPLAY_EVENT_TYPE)
      .eq("tenant_id", event.payload.tenantId)
      .contains("payload", {
        idempotency_key: event.payload.idempotencyKey,
        status: "completed",
      })
      .limit(1);

    if (error) {
      logger.error("Failed to evaluate replay idempotency", error, {
        tenantId: event.payload.tenantId,
        idempotencyKey: event.payload.idempotencyKey,
      });
      return false;
    }

    return Array.isArray(data) && data.length > 0;
  }

  private async recordReplayCompletion(event: FailedUsageEvent): Promise<void> {
    const nowIso = new Date().toISOString();
    const { error } = await this.supabase.from("dead_letter_events").insert({
      event_type: REPLAY_EVENT_TYPE,
      tenant_id: event.payload.tenantId,
      payload: {
        idempotency_key: event.payload.idempotencyKey,
        request_id: event.payload.requestId,
        original_dead_letter_id: event.id,
        status: "completed",
      },
      error_message: "replay_completed",
      retry_count: event.retryCount,
      created_at: nowIso,
    });

    if (error) {
      logger.error("Failed to persist replay completion marker", error, {
        tenantId: event.payload.tenantId,
        idempotencyKey: event.payload.idempotencyKey,
      });
    }
  }

  private async markDeadLetterReplayComplete(event: FailedUsageEvent): Promise<void> {
    if (!event.id) {
      return;
    }

    const { error } = await this.supabase
      .from("dead_letter_events")
      .update({
        retry_count: MAX_RETRY_COUNT,
        error_message: REPLAY_COMPLETED_MARKER,
      })
      .eq("id", event.id);

    if (error) {
      logger.error("Failed to mark dead-letter row as replayed", error, {
        deadLetterId: event.id,
      });
    }
  }

  private async persistRetryAttempt(event: FailedUsageEvent): Promise<void> {
    if (event.id) {
      const { error } = await this.supabase
        .from("dead_letter_events")
        .update({
          retry_count: event.retryCount,
          error_message: event.lastError,
          payload: {
            metric: event.payload.metric,
            amount: event.payload.amount,
            request_id: event.payload.requestId,
            agent_uuid: event.payload.agentUuid,
            workload_identity: event.payload.workloadIdentity,
            idempotency_key: event.payload.idempotencyKey,
            metadata: event.payload.metadata,
            original_timestamp: event.timestamp,
            retry_metadata: {
              retry_count: event.retryCount,
              last_error: event.lastError,
              updated_at: new Date().toISOString(),
            },
          },
        })
        .eq("id", event.id);

      if (!error) {
        return;
      }

      logger.error("Failed to update dead-letter retry metadata", error, {
        deadLetterId: event.id,
      });
    }

    await this.persistToDeadLetterTable(event);
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
          retry_metadata: {
            retry_count: event.retryCount,
            last_error: event.lastError,
            updated_at: new Date().toISOString(),
          },
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
    await this.emitUsage(
      {
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
        metadata: { model },
      },
      { ...context, agentId: context?.agentId ?? "llm" }
    );
  }

  async emitAgentExecution(
    tenantId: string,
    requestId: string,
    agentUuid: string,
    workloadIdentity: string,
    agentType?: string,
    context?: BillableContext
  ): Promise<void> {
    await this.emitUsage(
      {
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
        metadata: { agentType },
      },
      { ...context, agentId: context?.agentId ?? (agentType ?? "agent_execution") }
    );
  }

  async emitAPICall(
    tenantId: string,
    requestId: string,
    agentUuid: string,
    workloadIdentity: string,
    endpoint?: string,
    context?: BillableContext
  ): Promise<void> {
    await this.emitUsage(
      {
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
        metadata: { endpoint },
      },
      { ...context, agentId: context?.agentId ?? "api" }
    );
  }

  async emitStorageUsage(
    tenantId: string,
    sizeGB: number,
    requestId: string,
    agentUuid: string,
    workloadIdentity: string,
    context?: BillableContext
  ): Promise<void> {
    await this.emitUsage(
      {
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
      },
      { ...context, agentId: context?.agentId ?? "storage" }
    );
  }

  async emitUserSeats(
    tenantId: string,
    userCount: number,
    requestId: string,
    agentUuid: string,
    workloadIdentity: string,
    context?: BillableContext
  ): Promise<void> {
    await this.emitUsage(
      {
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
      },
      { ...context, agentId: context?.agentId ?? "user_seats" }
    );
  }
}

export default UsageEmitter;
