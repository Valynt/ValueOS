/* eslint-disable no-console */
/**
 * Structured JSON Logger
 *
 * Production-grade logging with correlation IDs and safe metadata.
 * Automatically injects trace_id and span_id from the active OTel span
 * to enable Loki → Tempo correlation.
 */

import { redactSensitiveData } from "./redaction.js";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

/**
 * Attempt to get trace context from OTel. Returns empty object if unavailable.
 * Uses dynamic import to avoid hard dependency on telemetry module.
 */
function getTraceContext(): Record<string, string> {
  try {
    // Inline require-style access to avoid circular dependency with telemetry.ts
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const api = require("@opentelemetry/api");
    const span = api.trace.getActiveSpan?.();
    if (!span) return {};
    const ctx = span.spanContext();
    if (!ctx || ctx.traceId === "00000000000000000000000000000000") return {};
    return { traceId: ctx.traceId, spanId: ctx.spanId };
  } catch {
    return {};
  }
}

/**
 * Create a log entry
 */
function createEntry(level: LogLevel, message: string, meta?: Record<string, unknown>): LogEntry {
  const traceCtx = getTraceContext();
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...traceCtx,
    ...(meta ? (redactSensitiveData(meta) as Record<string, unknown>) : {}),
  };
}

/**
 * Output log entry
 */
function output(entry: LogEntry): void {
  const json = JSON.stringify(entry);

  if (entry.level === "error") {
    console.error(json);
  } else if (entry.level === "warn") {
    console.warn(json);
  } else {
    console.log(json);
  }
}

/**
 * Logger instance
 */
export const logger = {
  debug(message: string, meta?: Record<string, unknown>): void {
    if (process.env.LOG_LEVEL === "debug") {
      output(createEntry("debug", message, meta));
    }
  },

  info(message: string, meta?: Record<string, unknown>): void {
    output(createEntry("info", message, meta));
  },

  warn(message: string, meta?: Record<string, unknown>): void {
    output(createEntry("warn", message, meta));
  },

  error(message: string, error?: unknown, meta?: Record<string, unknown>): void {
    const errorMeta =
      error instanceof Error
        ? { errorType: error.name, errorMessage: error.message, stack: error.stack }
        : error
          ? { error: String(error) }
          : {};

    output(createEntry("error", message, { ...errorMeta, ...meta }));
  },

  cache(operation: string, key: string, meta?: Record<string, unknown>): void {
    output(createEntry("debug", `cache:${operation}`, { cacheKey: key, ...meta }));
  },
};

/**
 * Create a component-specific logger
 */
export function createLogger(options: { component: string }) {
  return {
    debug(message: string, meta?: Record<string, unknown>): void {
      logger.debug(message, { component: options.component, ...meta });
    },
    info(message: string, meta?: Record<string, unknown>): void {
      logger.info(message, { component: options.component, ...meta });
    },
    warn(message: string, meta?: Record<string, unknown>): void {
      logger.warn(message, { component: options.component, ...meta });
    },
    error(message: string, error?: unknown, meta?: Record<string, unknown>): void {
      logger.error(message, error, { component: options.component, ...meta });
    },
  };
}

export { logger as log };
export default logger;
