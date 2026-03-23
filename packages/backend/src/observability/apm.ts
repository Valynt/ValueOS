import { SpanStatusCode } from "@opentelemetry/api";

import { getTracer } from "../config/telemetry.js";
import { logger } from "../lib/logger.js";

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
      logger.debug("business.transaction", {
        transaction: context.transactionName,
        tenant_id: context.tenantId,
        workflow_id: context.workflowId,
        trace_id: context.traceId,
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
          logger.error("Business transaction failed", error, {
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
  logger.info(`release.health.marker:${release}`, {
    release,
    environment,
    started_at: new Date().toISOString(),
  });
}
