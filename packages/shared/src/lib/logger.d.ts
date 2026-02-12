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
export type LogLevel = "debug" | "info" | "warn" | "error";
export interface LogContext {
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
declare class Logger {
    private minLevel;
    private listeners;
    constructor();
    /**
     * Add a listener for log entries (e.g., for sending to monitoring service)
     */
    addListener(listener: (entry: LogEntry) => void): () => void;
    /**
     * Log a debug message (with automatic PII sanitization)
     */
    debug(message: string, context?: LogContext): void;
    /**
     * Log an info message (with automatic PII sanitization)
     */
    info(message: string, context?: LogContext): void;
    /**
     * Log a warning message (with automatic PII sanitization)
     */
    warn(message: string, context?: LogContext): void;
    /**
     * Log an error message (with automatic PII sanitization)
     */
    error(message: string, error?: Error, context?: LogContext): void;
    /**
     * Core logging method
     */
    private log;
    /**
     * Check if a log level should be output
     */
    private shouldLog;
    /**
     * Output log entry to console
     */
    private consoleOutput;
    /**
     * Set minimum log level (useful for testing)
     */
    setMinLevel(level: LogLevel): void;
}
export declare const logger: Logger;
export declare const log: {
    debug: (message: string, context?: LogContext) => void;
    info: (message: string, context?: LogContext) => void;
    warn: (message: string, context?: LogContext) => void;
    error: (message: string, error?: Error, context?: LogContext) => void;
};
/**
 * Create a logger with default context (automatically sanitized)
 */
export declare function createLogger(defaultContext: LogContext): {
    debug: (message: string, context?: LogContext) => void;
    info: (message: string, context?: LogContext) => void;
    warn: (message: string, context?: LogContext) => void;
    error: (message: string, error?: Error, context?: LogContext) => void;
};
/**
 * Specialized loggers for common use cases
 */
export declare const secureLog: {
    /**
     * Log user-related actions (automatically sanitizes user objects)
     */
    user: (message: string, user: any, context?: LogContext) => void;
    /**
     * Log request-related actions (automatically sanitizes requests)
     */
    request: (message: string, req: any, context?: LogContext) => void;
    /**
     * Log errors with automatic sanitization
     */
    error: (message: string, error: unknown, context?: LogContext) => void;
};
/**
 * Integration with monitoring services
 */
export declare function setupMonitoring(): void;
export default logger;
//# sourceMappingURL=logger.d.ts.map