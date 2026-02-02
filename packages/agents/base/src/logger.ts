/**
 * Shared logger for ValueOS agents
 * Uses structured JSON logging for centralized aggregation
 */

import { inspect } from "util";

export interface LogContext {
  component?: string;
  agentType?: string;
  userId?: string;
  sessionId?: string;
  [key: string]: any;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error | unknown, context?: LogContext): void;
  trackError(
    error: Error,
    context?: LogContext,
    severity?: "low" | "medium" | "high" | "critical"
  ): void;
}

class ConsoleLogger implements Logger {
  private formatMessage(
    level: string,
    message: string,
    context?: LogContext,
    error?: Error
  ): string {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(context && { context }),
      ...(error && { error: { message: error.message, stack: error.stack } }),
    };
    return JSON.stringify(logEntry);
  }

  debug(message: string, context?: LogContext): void {
    console.debug(this.formatMessage("DEBUG", message, context));
  }

  info(message: string, context?: LogContext): void {
    console.info(this.formatMessage("INFO", message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage("WARN", message, context));
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorObj = error instanceof Error ? error : error ? new Error(String(error)) : undefined;
    console.error(this.formatMessage("ERROR", message, context, errorObj));
  }

  trackError(
    error: Error,
    context?: LogContext,
    severity: "low" | "medium" | "high" | "critical" = "medium"
  ): void {
    const enrichedContext = {
      ...(context || {}),
      severity,
      alert: severity === "high" || severity === "critical",
    };
    this.error(error.message, error, enrichedContext);
  }
}

export const logger = new ConsoleLogger();
