"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.secureLog = exports.log = exports.logger = void 0;
exports.createLogger = createLogger;
exports.setupMonitoring = setupMonitoring;
const environment_1 = require("../config/environment");
const telemetry_1 = require("../config/telemetry");
const piiFilter_1 = require("./piiFilter");
const context_1 = require("./context");
class Logger {
    minLevel;
    listeners = [];
    constructor() {
        // Set minimum log level based on environment
        if ((0, environment_1.isProduction)()) {
            this.minLevel = "warn";
        }
        else if ((0, environment_1.isTest)()) {
            this.minLevel = "error";
        }
        else {
            this.minLevel = "debug";
        }
    }
    /**
     * Add a listener for log entries (e.g., for sending to monitoring service)
     */
    addListener(listener) {
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
    debug(message, context) {
        (0, piiFilter_1.validateLogMessage)(message, context);
        const sanitizedContext = context ? (0, piiFilter_1.sanitizeForLogging)(context) : undefined;
        this.log("debug", message, sanitizedContext);
    }
    /**
     * Log an info message (with automatic PII sanitization)
     */
    info(message, context) {
        (0, piiFilter_1.validateLogMessage)(message, context);
        const sanitizedContext = context ? (0, piiFilter_1.sanitizeForLogging)(context) : undefined;
        this.log("info", message, sanitizedContext);
    }
    /**
     * Log a warning message (with automatic PII sanitization)
     */
    warn(message, context) {
        (0, piiFilter_1.validateLogMessage)(message, context);
        const sanitizedContext = context ? (0, piiFilter_1.sanitizeForLogging)(context) : undefined;
        this.log("warn", message, sanitizedContext);
    }
    /**
     * Log an error message (with automatic PII sanitization)
     */
    error(message, error, context) {
        (0, piiFilter_1.validateLogMessage)(message, context);
        const sanitizedContext = context ? (0, piiFilter_1.sanitizeForLogging)(context) : undefined;
        const sanitizedError = error ? (0, piiFilter_1.sanitizeError)(error) : undefined;
        this.log("error", message, {
            ...sanitizedContext,
            error: sanitizedError,
        });
    }
    /**
     * Core logging method
     */
    log(level, message, context) {
        if (!this.shouldLog(level)) {
            return;
        }
        // Merge with AsyncLocalStorage context if available
        const requestContext = (0, context_1.getContext)();
        const mergedContext = {
            ...requestContext,
            ...context,
        };
        const entry = {
            level,
            message,
            timestamp: new Date().toISOString(),
        };
        // Only add context if there are meaningful keys (excluding error)
        const contextWithoutError = { ...mergedContext };
        delete contextWithoutError.error;
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
            }
            catch (err) {
                // Don't let listener errors break logging
                // Use console.error to avoid recursion and type issues
                console.error("Logger listener error:", err);
            }
        });
        // Output to console in development
        if ((0, environment_1.isDevelopment)() || (0, environment_1.isTest)()) {
            this.consoleOutput(entry);
        }
        // In production, only log errors to console
        if ((0, environment_1.isProduction)() && level === "error") {
            this.consoleOutput(entry);
        }
    }
    /**
     * Check if a log level should be output
     */
    shouldLog(level) {
        const levels = ["debug", "info", "warn", "error"];
        const minIndex = levels.indexOf(this.minLevel);
        const levelIndex = levels.indexOf(level);
        return levelIndex >= minIndex;
    }
    /**
     * Output log entry to console
     */
    consoleOutput(entry) {
        // In production, output structured JSON for log ingestion
        if ((0, environment_1.isProduction)()) {
            console.log(JSON.stringify({
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
            }));
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
    setMinLevel(level) {
        this.minLevel = level;
    }
    /**
     * Create a child logger with default context merged into every log call.
     */
    withContext(defaultContext) {
        return createLogger(defaultContext);
    }
}
// Export singleton instance
exports.logger = new Logger();
// Export convenience functions
exports.log = {
    debug: (message, context) => exports.logger.debug(message, context),
    info: (message, context) => exports.logger.info(message, context),
    warn: (message, context) => exports.logger.warn(message, context),
    error: (message, error, context) => exports.logger.error(message, error, context),
};
/**
 * Create a logger with default context (automatically sanitized)
 */
function createLogger(defaultContext) {
    const sanitizedDefault = (0, piiFilter_1.sanitizeForLogging)(defaultContext);
    return {
        debug: (message, context) => exports.logger.debug(message, { ...sanitizedDefault, ...context }),
        info: (message, context) => exports.logger.info(message, { ...sanitizedDefault, ...context }),
        warn: (message, context) => exports.logger.warn(message, { ...sanitizedDefault, ...context }),
        error: (message, error, context) => exports.logger.error(message, error, { ...sanitizedDefault, ...context }),
    };
}
/**
 * Specialized loggers for common use cases
 */
exports.secureLog = {
    /**
     * Log user-related actions (automatically sanitizes user objects)
     */
    user: (message, user, context) => {
        exports.logger.info(message, { ...(0, piiFilter_1.sanitizeUser)(user), ...context });
    },
    /**
     * Log request-related actions (automatically sanitizes requests)
     */
    request: (message, req, context) => {
        exports.logger.info(message, { ...(0, piiFilter_1.sanitizeRequest)(req), ...context });
    },
    /**
     * Log errors with automatic sanitization
     */
    error: (message, error, context) => {
        const sanitizedError = error instanceof Error ? error : new Error(String(error));
        exports.logger.error(message, sanitizedError, context);
    },
};
/**
 * Integration with monitoring services
 */
function setupMonitoring() {
    // Example: Send errors to Sentry
    if ((0, environment_1.isProduction)()) {
        // Add Sentry integration if available
        try {
            // Dynamically import Sentry to avoid dependency errors in minimal builds
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const Sentry = typeof window === "undefined" ? require("@sentry/node") : null;
            if (Sentry) {
                exports.logger.addListener((entry) => {
                    if (entry.level === "error" && entry.error) {
                        const trace = (0, telemetry_1.getTraceContextForLogging)();
                        Sentry.withScope((scope) => {
                            scope.setExtras({ ...entry.context, ...trace });
                            scope.setTag("component", entry.context?.component || "unknown");
                            Sentry.captureException(entry.error);
                        });
                    }
                });
            }
        }
        catch (err) {
            exports.logger.warn("Sentry not installed; skipping error forwarding", {
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
}
exports.default = exports.logger;
//# sourceMappingURL=logger.js.map