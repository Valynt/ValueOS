/**
 * Structured Logging Utility
 * 
 * Provides consistent, environment-aware logging across the application.
 * Replaces console.log/error with structured logging that can be:
 * - Filtered by environment
 * - Sent to monitoring services
 * - Formatted consistently
 * - Disabled in production
 */

import { isDevelopment, isProduction, isTest } from '../config/environment';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

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

class Logger {
  private minLevel: LogLevel;
  private listeners: Array<(entry: LogEntry) => void> = [];

  constructor() {
    // Set minimum log level based on environment
    if (isProduction()) {
      this.minLevel = 'warn';
    } else if (isTest()) {
      this.minLevel = 'error';
    } else {
      this.minLevel = 'debug';
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
   * Log a debug message
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error, context?: LogContext): void {
    this.log('error', message, { ...context, error });
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: LogContext & { error?: Error }): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: context ? { ...context, error: undefined } : undefined,
      error: context?.error,
    };

    // Notify listeners (for monitoring services)
    this.listeners.forEach(listener => {
      try {
        listener(entry);
      } catch (err) {
        // Don't let listener errors break logging
        console.error('Logger listener error:', err);
      }
    });

    // Output to console in development
    if (isDevelopment() || isTest()) {
      this.consoleOutput(entry);
    }

    // In production, only log errors to console
    if (isProduction() && level === 'error') {
      this.consoleOutput(entry);
    }
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const minIndex = levels.indexOf(this.minLevel);
    const levelIndex = levels.indexOf(level);
    return levelIndex >= minIndex;
  }

  /**
   * Output log entry to console
   */
  private consoleOutput(entry: LogEntry): void {
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    const fullMessage = `${prefix} ${entry.message}${contextStr}`;

    switch (entry.level) {
      case 'debug':
        console.debug(fullMessage);
        break;
      case 'info':
        console.info(fullMessage);
        break;
      case 'warn':
        console.warn(fullMessage);
        break;
      case 'error':
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
}

// Export singleton instance
export const logger = new Logger();

// Export convenience functions
export const log = {
  debug: (message: string, context?: LogContext) => logger.debug(message, context),
  info: (message: string, context?: LogContext) => logger.info(message, context),
  warn: (message: string, context?: LogContext) => logger.warn(message, context),
  error: (message: string, error?: Error, context?: LogContext) => logger.error(message, error, context),
};

/**
 * Create a logger with default context
 */
export function createLogger(defaultContext: LogContext) {
  return {
    debug: (message: string, context?: LogContext) =>
      logger.debug(message, { ...defaultContext, ...context }),
    info: (message: string, context?: LogContext) =>
      logger.info(message, { ...defaultContext, ...context }),
    warn: (message: string, context?: LogContext) =>
      logger.warn(message, { ...defaultContext, ...context }),
    error: (message: string, error?: Error, context?: LogContext) =>
      logger.error(message, error, { ...defaultContext, ...context }),
  };
}

/**
 * Integration with monitoring services
 */
export function setupMonitoring() {
  // Example: Send errors to Sentry
  if (isProduction()) {
    logger.addListener((entry) => {
      if (entry.level === 'error' && entry.error) {
        // Send to Sentry or other monitoring service
        // Sentry.captureException(entry.error, { extra: entry.context });
      }
    });
  }
}

export default logger;
