import { logger } from "../../lib/logger.js"
import { sanitizeForLogging } from "../lib/piiFilter.js"
import { captureMessage } from "../lib/sentry";
import { createServerSupabaseClient } from "../../lib/supabase.js"
import {
  RequiredAuditPayload,
  mapAuditPayloadToLegacyShape,
  requiredAuditPayloadSchema,
} from "../security/auditPayloadContract.js";

import { BaseService } from "../BaseService.js"


export interface RequestAuditEvent {
  correlation_id: string;
  userId?: string;
  actor: string;
  action_type: string;
  resource_type: string;
  resource_id: string;
  request_path: string;
  ip_address: string;
  user_agent: string;
  outcome: "success" | "failed";
  status_code: number;
  timestamp: string;
  severity?: "low" | "medium" | "high" | "critical";
  eventType?: string;
  eventData?: Record<string, unknown>;
}

// Serialized form ready for DB insert
interface AuditPayload {
  request_id: string;
  user_id: string | null;
  actor: string;
  action: string;
  resource: string;
  request_path: string;
  event_type: string;
  event_data: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  severity: string;
  status_code: number | null;
}

// ── Dead-letter buffer ──────────────────────────────────────────────────────
// When the primary write fails, events are buffered in memory and retried.
// This prevents silent event loss during transient Supabase outages.

const MAX_DLQ_SIZE = 500;
const RETRY_INTERVAL_MS = 30_000; // 30 seconds
const MAX_RETRIES_PER_EVENT = 5;

interface DlqEntry {
  payload: AuditPayload;
  retries: number;
  firstFailedAt: string;
}

class SecurityAuditService extends BaseService {
  private _supabase: any = null;
  private dlq: DlqEntry[] = [];
  private retryTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super("SecurityAuditService");
  }

  private override get supabase() {
    if (!this._supabase) {
      this._supabase = createServerSupabaseClient();
    }
    return this._supabase;
  }

  /**
   * Start the background retry loop. Called once at server startup.
   */
  startRetryLoop(): void {
    if (this.retryTimer) return;
    this.retryTimer = setInterval(() => this.flushDlq(), RETRY_INTERVAL_MS);
    this.retryTimer.unref(); // don't block process exit
  }

  /**
   * Stop the retry loop (for graceful shutdown).
   */
  stopRetryLoop(): void {
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }
  }

  /** Number of events currently in the dead-letter buffer. */
  get dlqSize(): number {
    return this.dlq.length;
  }

  async logRequestEvent(event: RequestAuditEvent): Promise<void> {
    const contractPayload: RequiredAuditPayload = requiredAuditPayloadSchema.parse({
      actor: event.actor,
      action_type: event.action_type,
      resource_type: event.resource_type,
      resource_id: event.resource_id,
      request_path: event.request_path,
      ip_address: event.ip_address,
      user_agent: event.user_agent,
      outcome: event.outcome,
      status_code: event.status_code,
      timestamp: event.timestamp,
      correlation_id: event.correlation_id,
    });

    const sanitizedDetails = event.eventData
      ? (sanitizeForLogging(event.eventData) as Record<string, unknown>)
      : {};
    const {
      ip_address: _ignoreIpAddress,
      user_agent: _ignoreUserAgent,
      request_path: _ignoreRequestPath,
      status_code: _ignoreStatusCode,
      outcome: _ignoreOutcome,
      correlation_id: _ignoreCorrelationId,
      ...detailsWithoutCanonicalDuplicates
    } = sanitizedDetails;

    const payload: AuditPayload = {
      request_id: contractPayload.correlation_id,
      user_id: event.userId || null,
      actor: contractPayload.actor,
      action: contractPayload.action_type,
      resource: contractPayload.resource_type,
      request_path: contractPayload.request_path,
      event_type: event.eventType || "http_request",
      event_data: {
        ...detailsWithoutCanonicalDuplicates,
        legacy: mapAuditPayloadToLegacyShape(contractPayload),
      },
      ip_address: contractPayload.ip_address,
      user_agent: contractPayload.user_agent,
      severity: event.severity || "medium",
      status_code: contractPayload.status_code,
    };

    try {
      await this.writePayload(payload);
    } catch {
      // Primary write failed — buffer for retry instead of dropping
      this.enqueueDlq(payload);
    }
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async writePayload(payload: AuditPayload): Promise<void> {
    await this.executeRequest(
      async () => {
        const { error } = await this.supabase
          .from("security_audit_log" as any)
          .insert(payload as any);

        if (error) {
          logger.error("Failed to write security audit event", error, {
            requestId: payload.request_id,
            action: payload.action,
          });
          captureMessage("Security audit write failed", {
            level: "error",
            extra: {
              requestId: payload.request_id,
              action: payload.action,
              resource: payload.resource,
            },
          });
          throw error;
        }
      },
      { skipCache: true },
    );
  }

  private enqueueDlq(payload: AuditPayload): void {
    if (this.dlq.length >= MAX_DLQ_SIZE) {
      // Evict oldest entry to make room — last resort
      const evicted = this.dlq.shift();
      logger.error("Audit DLQ full, evicting oldest event", {
        evictedRequestId: evicted?.payload.request_id,
        dlqSize: this.dlq.length,
      });
      captureMessage("Audit DLQ overflow — event permanently lost", {
        level: "fatal",
        extra: { evictedRequestId: evicted?.payload.request_id },
      });
    }

    this.dlq.push({
      payload,
      retries: 0,
      firstFailedAt: new Date().toISOString(),
    });

    logger.warn("Audit event buffered in DLQ", {
      requestId: payload.request_id,
      dlqSize: this.dlq.length,
    });
  }

  private async flushDlq(): Promise<void> {
    if (this.dlq.length === 0) return;

    const batch = this.dlq.splice(0, this.dlq.length);
    const stillFailing: DlqEntry[] = [];

    for (const entry of batch) {
      try {
        await this.writePayload(entry.payload);
        logger.info("Audit DLQ event recovered", {
          requestId: entry.payload.request_id,
          retries: entry.retries,
        });
      } catch {
        entry.retries += 1;
        if (entry.retries < MAX_RETRIES_PER_EVENT) {
          stillFailing.push(entry);
        } else {
          logger.error("Audit event exhausted retries, permanently lost", {
            requestId: entry.payload.request_id,
            retries: entry.retries,
            firstFailedAt: entry.firstFailedAt,
          });
          captureMessage("Audit event permanently lost after max retries", {
            level: "fatal",
            extra: {
              requestId: entry.payload.request_id,
              action: entry.payload.action,
              firstFailedAt: entry.firstFailedAt,
            },
          });
        }
      }
    }

    // Re-enqueue events that still need retrying
    this.dlq.push(...stillFailing);

    if (stillFailing.length > 0) {
      logger.warn("Audit DLQ flush incomplete", {
        remaining: stillFailing.length,
        recovered: batch.length - stillFailing.length,
      });
    }
  }
}

export const securityAuditService = new SecurityAuditService();
