import { context, trace } from "@opentelemetry/api";
import { structuredLogSchema, type StructuredLogSeverity } from "@shared/observability/logSchema";

import { sanitizeStructuredLog } from "./secureSerialization.js";

type LogLevel = "debug" | "info" | "warn" | "error";

type LogOutcome = "success" | "failure" | "unknown";

interface LoggerMeta {
  tenant_id?: string;
  trace_id?: string;
  span_id?: string;
  event?: string;
  outcome?: LogOutcome;
  [key: string]: unknown;
}

function levelToSeverity(level: LogLevel): StructuredLogSeverity {
  if (level === "debug") return "DEBUG";
  if (level === "info") return "INFO";
  if (level === "warn") return "WARN";
  return "ERROR";
}

function getTraceContext(): { trace_id?: string; span_id?: string } {
  const span = trace.getSpan(context.active());
  if (!span) return {};
  const spanContext = span.spanContext();
  if (!spanContext || spanContext.traceId === "00000000000000000000000000000000") return {};
  return { trace_id: spanContext.traceId, span_id: spanContext.spanId };
}

function createEntry(level: LogLevel, event: string, meta?: LoggerMeta): Record<string, unknown> {
  const sanitizedMeta = meta ? (sanitizeStructuredLog(meta) as LoggerMeta) : {};
  const traceContext = getTraceContext();
  const tenantId = typeof sanitizedMeta.tenant_id === "string" ? sanitizedMeta.tenant_id : "unknown";

  const entry = {
    timestamp: new Date().toISOString(),
    severity: levelToSeverity(level),
    service: process.env.OTEL_SERVICE_NAME || "valueos-backend",
    env: process.env.NODE_ENV || "development",
    tenant_id: tenantId,
    trace_id: (typeof sanitizedMeta.trace_id === "string" ? sanitizedMeta.trace_id : traceContext.trace_id) ?? "unknown",
    span_id: (typeof sanitizedMeta.span_id === "string" ? sanitizedMeta.span_id : traceContext.span_id) ?? "unknown",
    event,
    outcome: sanitizedMeta.outcome ?? (level === "error" ? "failure" : "unknown"),
    ...sanitizedMeta,
  };

  const parsed = structuredLogSchema.safeParse(entry);
  if (!parsed.success) {
    return {
      timestamp: new Date().toISOString(),
      severity: "ERROR",
      service: process.env.OTEL_SERVICE_NAME || "valueos-backend",
      env: process.env.NODE_ENV || "development",
      tenant_id: tenantId,
      trace_id: traceContext.trace_id ?? "unknown",
      span_id: traceContext.span_id ?? "unknown",
      event: "logger.schema_validation_failed",
      outcome: "failure",
      schema_issues: parsed.error.issues.map((issue) => issue.message),
      original_event: event,
      original_meta: sanitizedMeta,
    };
  }

  return parsed.data;
}

function output(level: LogLevel, event: string, meta?: LoggerMeta): void {
  const json = JSON.stringify(createEntry(level, event, meta));
  if (level === "error") {
    console.error(json);
    return;
  }
  if (level === "warn") {
    console.warn(json);
    return;
  }
  console.log(json);
}

export const logger = {
  debug(event: string, meta?: LoggerMeta): void {
    if (process.env.LOG_LEVEL === "debug") {
      output("debug", event, meta);
    }
  },

  info(event: string, meta?: LoggerMeta): void {
    output("info", event, meta);
  },

  warn(event: string, meta?: LoggerMeta): void {
    output("warn", event, meta);
  },

  error(event: string, error?: unknown, meta?: LoggerMeta): void {
    // Backward-compatibility: callers that pre-date the (event, error?, meta?) signature
    // often pass a plain object as the second argument intending it as meta, e.g.:
    //   logger.error('msg', { error: e.message, jobId })
    // Detect this pattern and promote the object to meta so structured fields are preserved.
    let resolvedError: unknown = error;
    let resolvedMeta: LoggerMeta | undefined = meta;
    if (
      error !== null &&
      error !== undefined &&
      typeof error === "object" &&
      !(error instanceof Error)
    ) {
      resolvedMeta = { ...(error as LoggerMeta), ...meta };
      resolvedError = undefined;
    }

    const errorMeta =
      resolvedError instanceof Error
        ? { error_name: resolvedError.name, error_message: resolvedError.message, stack: resolvedError.stack }
        : resolvedError
          ? { error: String(resolvedError) }
          : {};
    output("error", event, { ...errorMeta, ...resolvedMeta, outcome: "failure" });
  },

  cache(operation: string, key: string, meta?: LoggerMeta): void {
    output("debug", `cache.${operation}`, { cache_key: key, ...meta });
  },
};

export function createLogger(options: { component: string }) {
  return {
    debug(event: string, meta?: LoggerMeta): void {
      logger.debug(event, { component: options.component, ...meta });
    },
    info(event: string, meta?: LoggerMeta): void {
      logger.info(event, { component: options.component, ...meta });
    },
    warn(event: string, meta?: LoggerMeta): void {
      logger.warn(event, { component: options.component, ...meta });
    },
    error(event: string, error?: unknown, meta?: LoggerMeta): void {
      logger.error(event, error, { component: options.component, ...meta });
    },

  };
}

export { logger as log };

export default logger;
