/**
 * Structured JSON Logger
 *
 * Production-grade logging with correlation IDs and safe metadata.
 */

import { redactSensitiveData } from "./redaction";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

/**
 * Create a log entry
 */
function createEntry(level: LogLevel, message: string, meta?: Record<string, unknown>): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
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
};

export default logger;
