import { SpanStatusCode } from "@opentelemetry/api";

import { getTracer } from "../../config/telemetry.js";
import { createCounter, createHistogram, createObservableGauge } from "../../lib/observability/index.js";
import { createLogger } from "../../lib/logger.js";

import type { CrmProvider } from "./types.js";

export const CRM_INTEGRATION_EVENTS = {
  CONNECT_STARTED: "connect_started",
  CONNECT_SUCCEEDED: "connect_succeeded",
  CONNECT_FAILED: "connect_failed",
  WEBHOOK_REJECTED: "webhook_rejected",
  SYNC_DEGRADED: "sync_degraded",
  SYNC_RECOVERED: "sync_recovered",
  REAUTH_REQUIRED: "reauth_required",
} as const;

export type CrmIntegrationEvent =
  (typeof CRM_INTEGRATION_EVENTS)[keyof typeof CRM_INTEGRATION_EVENTS];

interface CrmTelemetryContext {
  provider: CrmProvider;
  tenantId: string;
  operation: string;
  correlationId: string;
}

const logger = createLogger({ component: "CrmIntegrationObservability" });

const operationSuccessCounter = createCounter(
  "crm_integration_operation_success_total",
  "CRM integration operation success count",
  ["provider", "tenant_id", "operation"]
);

const operationFailureCounter = createCounter(
  "crm_integration_operation_failure_total",
  "CRM integration operation failure count",
  ["provider", "tenant_id", "operation", "error_code"]
);

const operationLatencyHistogram = createHistogram(
  "crm_integration_operation_latency_ms",
  "CRM integration operation latency in milliseconds",
  [25, 50, 100, 250, 500, 1000, 2000, 5000, 10000],
  ["provider", "tenant_id", "operation"]
);

const retryCounter = createCounter(
  "crm_integration_retry_total",
  "CRM integration retry attempts",
  ["provider", "tenant_id", "operation"]
);

const webhookBacklogGauge = createObservableGauge(
  "crm_webhook_backlog",
  "CRM webhook backlog by tenant and provider",
  ["provider", "tenant_id"]
);

const queueLagGauge = createObservableGauge(
  "crm_queue_lag_seconds",
  "CRM queue lag in seconds by tenant and provider",
  ["provider", "tenant_id", "queue"]
);

function attributes(ctx: CrmTelemetryContext) {
  return {
    provider: ctx.provider,
    tenant_id: ctx.tenantId,
    operation: ctx.operation,
    correlation_id: ctx.correlationId,
  };
}

export async function runCrmOperation<T>(
  ctx: CrmTelemetryContext,
  fn: () => Promise<T>
): Promise<T> {
  const tracer = getTracer();
  const start = Date.now();

  return tracer.startActiveSpan(
    `crm.${ctx.operation}`,
    {
      attributes: attributes(ctx),
    },
    async (span) => {
      try {
        const result = await fn();
        operationSuccessCounter.inc(
          {
            provider: ctx.provider,
            tenant_id: ctx.tenantId,
            operation: ctx.operation,
          },
          1
        );

        logger.info("crm_operation", {
          ...attributes(ctx),
          event: "crm_operation",
          outcome: "success",
          latency_ms: Date.now() - start,
        });

        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        const errorCode = error instanceof Error ? error.name : "unknown_error";

        operationFailureCounter.inc(
          {
            provider: ctx.provider,
            tenant_id: ctx.tenantId,
            operation: ctx.operation,
            error_code: errorCode,
          },
          1
        );

        logger.error("crm_operation", error, {
          ...attributes(ctx),
          event: "crm_operation",
          outcome: "failure",
          error_code: errorCode,
          latency_ms: Date.now() - start,
        });

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        if (error instanceof Error) {
          span.recordException(error);
        }
        throw error;
      } finally {
        operationLatencyHistogram.observe(
          {
            provider: ctx.provider,
            tenant_id: ctx.tenantId,
            operation: ctx.operation,
          },
          Date.now() - start
        );
        span.end();
      }
    }
  );
}

export function recordCrmIntegrationEvent(
  event: CrmIntegrationEvent,
  ctx: CrmTelemetryContext,
  extra: Record<string, unknown> = {}
): void {
  logger.info("crm_integration_event", {
    ...attributes(ctx),
    event: "crm_integration_event",
    integration_event: event,
    outcome: "unknown",
    ...extra,
  });
}

export function recordCrmRetry(ctx: CrmTelemetryContext): void {
  retryCounter.inc(
    {
      provider: ctx.provider,
      tenant_id: ctx.tenantId,
      operation: ctx.operation,
    },
    1
  );
}

export function setCrmWebhookBacklog(tenantId: string, provider: CrmProvider, backlog: number): void {
  webhookBacklogGauge.set({ tenant_id: tenantId, provider }, backlog);
}

export function setCrmQueueLagSeconds(
  tenantId: string,
  provider: CrmProvider,
  queue: "sync" | "webhook",
  lagSeconds: number
): void {
  queueLagGauge.set({ tenant_id: tenantId, provider, queue }, lagSeconds);
}
