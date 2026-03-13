import { SpanStatusCode, type Span } from "@opentelemetry/api";

import { getTracer } from "../config/telemetry.js";

export interface TelemetrySpanContext {
  service: string;
  tenant_id: string;
  trace_id: string;
  env?: string;
  attributes?: Record<string, string | number | boolean>;
}

const DEFAULT_ENV = process.env.NODE_ENV || "development";

export function runInTelemetrySpan<T>(
  name: string,
  spanContext: TelemetrySpanContext,
  operation: (span: Span) => T,
): T {
  const tracer = getTracer();
  return tracer.startActiveSpan(name, {
    attributes: {
      service: spanContext.service,
      env: spanContext.env ?? DEFAULT_ENV,
      tenant_id: spanContext.tenant_id,
      trace_id: spanContext.trace_id,
      ...(spanContext.attributes ?? {}),
    },
  }, (span: Span) => {
    try {
      const result = operation(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof Error) {
        span.recordException(error);
      }
      throw error;
    } finally {
      span.end();
    }
  });
}

export async function runInTelemetrySpanAsync<T>(
  name: string,
  spanContext: TelemetrySpanContext,
  operation: (span: Span) => Promise<T>,
): Promise<T> {
  const tracer = getTracer();
  return tracer.startActiveSpan(name, {
    attributes: {
      service: spanContext.service,
      env: spanContext.env ?? DEFAULT_ENV,
      tenant_id: spanContext.tenant_id,
      trace_id: spanContext.trace_id,
      ...(spanContext.attributes ?? {}),
    },
  }, async (span: Span) => {
    try {
      const result = await operation(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof Error) {
        span.recordException(error);
      }
      throw error;
    } finally {
      span.end();
    }
  });
}
