/* eslint-disable no-console */
/**
 * Structured Logging Utility with PII Protection
 *
 * SEC-004: Production-ready logger with automatic PII sanitization
 *
 * Provides consistent, environment-aware logging across the application.
 * Replaces console.log/error with structured logging that:
 * - Automatically sanitizes PII (GDPR/SOC 2 compliant)
 * - Filters by environment
 * - Sends to monitoring services
 * - Formats consistently
 * - Prevents sensitive data leakage
 *
 * USAGE:
 *   import { logger } from '@/lib/logger';
 *   logger.info('User action', { userId: '123', action: 'login' });
 *   logger.error('Operation failed', error, { context: data });
 */

import { isDevelopment, isProduction, isTest } from "../config/environment";
import { getTraceContextForLogging } from "../config/telemetry";

import { getContext } from "./context";
import {
  sanitizeError,
  sanitizeForLogging,
  sanitizeRequest,
  sanitizeUser,
  validateLogMessage,
} from "./piiFilter";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  // Optional fields below
  component?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: Error;
}

class Logger {
  private minLevel: LogLevel;
  private listeners: Array<(entry: LogEntry) => void> = [];

  constructor() {
    // Set minimum log level based on environment
    if (isProduction()) {
      this.minLevel = "warn";
    } else if (isTest()) {
      this.minLevel = "error";
    } else {
      this.minLevel = "debug";
    }
  }

  /**
   * Add a listener for log entries (e.g., for sending to monitoring service)
   */
  addListener(listener: (entry: LogEntry) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Log a debug message (with automatic PII sanitization)
   */
  debug(message: string, context?: LogContext): void {
    validateLogMessage(message, context);
    const sanitizedContext = context ? (sanitizeForLogging(context) as LogContext) : undefined;
    this.log("debug", message, sanitizedContext);
  }

  /**
   * Log an info message (with automatic PII sanitization)
   */
  info(message: string, context?: LogContext): void {
    validateLogMessage(message, context);
    const sanitizedContext = context ? (sanitizeForLogging(context) as LogContext) : undefined;
    this.log("info", message, sanitizedContext);
  }

  /**
   * Log a warning message (with automatic PII sanitization)
   */
  warn(message: string, contextOrError?: LogContext | Error): void {
    const context = contextOrError instanceof Error
      ? { error: contextOrError.message, stack: contextOrError.stack } as LogContext
      : contextOrError;
    validateLogMessage(message, context);
    const sanitizedContext = context ? (sanitizeForLogging(context) as LogContext) : undefined;
    this.log("warn", message, sanitizedContext);
  }

  /**
   * Log an error message (with automatic PII sanitization)
   */
  error(message: string, errorOrContext?: Error | LogContext, context?: LogContext): void {
    const actualError = errorOrContext instanceof Error ? errorOrContext : undefined;
    const actualContext = errorOrContext instanceof Error ? context : (errorOrContext as LogContext | undefined);
    validateLogMessage(message, actualContext);
    const sanitizedContext = actualContext ? (sanitizeForLogging(actualContext) as LogContext) : undefined;
    const sanitizedError = actualError ? sanitizeError(actualError) : undefined;
    this.log("error", message, {
      ...sanitizedContext,
      error: sanitizedError as any,
    });
  }

  /** Log a cache operation at debug level. */
  cache(operation: string, key: string, meta?: LogContext): void {
    this.debug(`cache:${operation}`, { cacheKey: key, ...meta });
  }

  /** Log an LLM operation at debug level. */
  llm(operation: string, meta?: LogContext): void {
    this.debug(`llm:${operation}`, meta);
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: LogContext & { error?: Error }): void {
    if (!this.shouldLog(level)) {
      return;
    }

    // Merge with AsyncLocalStorage context if available
    const requestContext = getContext();
    const mergedContext = {
      ...requestContext,
      ...context,
    };

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
    };

    // Only add context if there are meaningful keys (excluding error)
    const contextWithoutError = { ...mergedContext };
    delete (contextWithoutError as Record<string, unknown>).error;
    if (Object.keys(contextWithoutError).length > 0) {
      entry.context = contextWithoutError;
    }

    // Only add error if it exists
    if (context?.error) {
      entry.error = context.error;
    }

    // Notify listeners (for monitoring services)
    this.listeners.forEach((listener) => {
      try {
        listener(entry);
      } catch (err) {
        // Don't let listener errors break logging
        // Use console.error to avoid recursion and type issues

        console.error("Logger listener error:", err);
      }
    });

    // Output to console in development
    if (isDevelopment() || isTest()) {
      this.consoleOutput(entry);
    }

    // In production, only log errors to console
    if (isProduction() && level === "error") {
      this.consoleOutput(entry);
    }
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    const minIndex = levels.indexOf(this.minLevel);
    const levelIndex = levels.indexOf(level);
    return levelIndex >= minIndex;
  }

  /**
   * Output log entry to console
   */
  private consoleOutput(entry: LogEntry): void {
    // In production, output structured JSON for log ingestion
    if (isProduction()) {
      console.log(
        JSON.stringify({
          timestamp: entry.timestamp,
          level: entry.level,
          message: entry.message,
          component: entry.context?.component,
          action: entry.context?.action,
          userId: entry.context?.userId,
          sessionId: entry.context?.sessionId,
          ...entry.context,
          ...(entry.error && {
            error: {
              name: entry.error.name,
              message: entry.error.message,
              stack: entry.error.stack,
            },
          }),
        })
      );
      return;
    }

    // Development/Test: formatted output
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : "";
    const fullMessage = `${prefix} ${entry.message}${contextStr}`;

    switch (entry.level) {
      case "debug":
        console.debug(fullMessage);
        break;
      case "info":
        console.info(fullMessage);
        break;
      case "warn":
        console.warn(fullMessage);
        break;
      case "error":
        console.error(fullMessage, entry.error);
        break;
    }
  }

  /**
   * Set minimum log level (useful for testing)
   */
  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Create a child logger with default context merged into every log call.
   */
  withContext(defaultContext: LogContext) {
    return createLogger(defaultContext);
  }
}

export type { Logger };

// Export singleton instance
export const logger = new Logger();

// Export convenience functions
export const log = {
  debug: (message: string, context?: LogContext) => logger.debug(message, context),
  info: (message: string, context?: LogContext) => logger.info(message, context),
  warn: (message: string, contextOrError?: LogContext | Error) => logger.warn(message, contextOrError),
  error: (message: string, errorOrContext?: Error | LogContext, context?: LogContext) =>
    logger.error(
      message,
      errorOrContext instanceof Error ? errorOrContext : undefined,
      errorOrContext instanceof Error ? context : (errorOrContext as LogContext | undefined),
    ),
};

/**
 * Create a logger with default context (automatically sanitized)
 */
export function createLogger(defaultContext: LogContext) {
  const sanitizedDefault = sanitizeForLogging(defaultContext) as LogContext;
  return {
    debug: (message: string, context?: LogContext) =>
      logger.debug(message, { ...sanitizedDefault, ...context }),
    info: (message: string, context?: LogContext) =>
      logger.info(message, { ...sanitizedDefault, ...context }),
    warn: (message: string, contextOrError?: LogContext | Error) =>
      logger.warn(message, contextOrError instanceof Error ? contextOrError : { ...sanitizedDefault, ...contextOrError }),
    error: (message: string, errorOrContext?: Error | LogContext, context?: LogContext) =>
      logger.error(
        message,
        errorOrContext instanceof Error ? errorOrContext : undefined,
        { ...sanitizedDefault, ...(errorOrContext instanceof Error ? context : (errorOrContext as LogContext | undefined)) },
      ),
  };
}

/**
 * Specialized loggers for common use cases
 */
export const secureLog = {
  /**
   * Log user-related actions (automatically sanitizes user objects)
   */
  user: (message: string, user: any, context?: LogContext) => {
    logger.info(message, { ...sanitizeUser(user), ...context });
  },

  /**
   * Log request-related actions (automatically sanitizes requests)
   */
  request: (message: string, req: any, context?: LogContext) => {
    logger.info(message, { ...sanitizeRequest(req), ...context });
  },

  /**
   * Log errors with automatic sanitization
   */
  error: (message: string, error: unknown, context?: LogContext) => {
    const sanitizedError = error instanceof Error ? error : new Error(String(error));
    logger.error(message, sanitizedError, context);
  },
};

/**
 * Integration with monitoring services
 */
export function setupMonitoring() {
  // Example: Send errors to Sentry
  if (isProduction()) {
    // Add Sentry integration if available
    try {
      // Dynamically import Sentry to avoid dependency errors in minimal builds
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sentry = typeof window === "undefined" ? require("@sentry/node") : null;

      if (Sentry) {
        logger.addListener((entry) => {
          if (entry.level === "error" && entry.error) {
            const trace = getTraceContextForLogging();
            Sentry.withScope((scope: any) => {
              scope.setExtras({ ...entry.context, ...trace });
              scope.setTag("component", entry.context?.component || "unknown");
              Sentry.captureException(entry.error);
            });
          }
        });
      }
    } catch (err) {
      logger.warn("Sentry not installed; skipping error forwarding", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export default logger;
