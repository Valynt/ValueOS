import { SpanStatusCode } from "@opentelemetry/api";
import { getTracer } from "../config/telemetry.js";
import {
  addBreadcrumb,
  captureException,
  captureMessage,
} from "../lib/sentry.js";

export interface BusinessTraceContext {
  transactionName: string;
  tenantId: string;
  workflowId?: string;
  traceId?: string;
  attributes?: Record<string, string | number | boolean | undefined>;
}

export async function withBusinessTransaction<T>(
  context: BusinessTraceContext,
  operation: () => Promise<T>
): Promise<T> {
  const tracer = getTracer();

  return tracer.startActiveSpan(
    context.transactionName,
    {
      attributes: {
        "business.transaction": context.transactionName,
        tenant_id: context.tenantId,
        workflow_id: context.workflowId ?? "unknown",
        trace_id: context.traceId ?? "unknown",
        ...Object.fromEntries(
          Object.entries(context.attributes ?? {}).filter(
            (entry): entry is [string, string | number | boolean] =>
              entry[1] !== undefined
          )
        ),
      },
    },
    async span => {
      addBreadcrumb({
        category: "business.transaction",
        level: "info",
        message: context.transactionName,
        data: {
          tenant_id: context.tenantId,
          workflow_id: context.workflowId,
          trace_id: context.traceId,
        },
      });

      try {
        const result = await operation();
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message:
            error instanceof Error
              ? error.message
              : "business transaction failed",
        });
        span.recordException(error as Error);

        if (error instanceof Error) {
          captureException(error, {
            tenant_id: context.tenantId,
            workflow_id: context.workflowId,
            trace_id: context.traceId,
            transaction_name: context.transactionName,
          });
        }

        throw error;
      } finally {
        span.end();
      }
    }
  );
}

export function markReleaseHealth(release: string, environment: string): void {
  captureMessage(`release.health.marker:${release}`, "info");
  addBreadcrumb({
    category: "release.health",
    level: "info",
    message: "release-started",
    data: {
      release,
      environment,
      started_at: new Date().toISOString(),
    },
  });
}
