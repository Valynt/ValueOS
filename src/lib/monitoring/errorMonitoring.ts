/**
 * Error Monitoring Service
 * 
 * Integrates with error monitoring platforms (Sentry, Rollbar, etc.)
 * Provides error tracking, reporting, and alerting
 */

import { logger } from '../logger';
import { trackError } from '../analytics/customerPortalTracking';

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Error categories
export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  API = 'api',
  VALIDATION = 'validation',
  NETWORK = 'network',
  RENDERING = 'rendering',
  DATA = 'data',
  EXPORT = 'export',
  UNKNOWN = 'unknown',
}

// Error context interface
export interface ErrorContext {
  userId?: string;
  valueCaseId?: string;
  companyName?: string;
  token?: string;
  url?: string;
  userAgent?: string;
  timestamp?: string;
  sessionId?: string;
  component?: string;
  action?: string;
  [key: string]: any;
}

// Error report interface
export interface ErrorReport {
  message: string;
  stack?: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  context: ErrorContext;
  fingerprint?: string;
}

class ErrorMonitoringService {
  private enabled = true;
  private sentryDsn: string | null = null;
  private environment: string = 'development';
  private errorQueue: ErrorReport[] = [];
  private maxQueueSize = 100;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize error monitoring
   */
  private initialize(): void {
    // Get configuration from environment
    this.sentryDsn = import.meta.env.VITE_SENTRY_DSN || null;
    this.environment = import.meta.env.VITE_ENVIRONMENT || 'development';

    // Setup global error handlers
    this.setupGlobalHandlers();

    logger.info('Error monitoring initialized', {
      enabled: this.enabled,
      environment: this.environment,
    });
  }

  /**
   * Setup global error handlers
   */
  private setupGlobalHandlers(): void {
    if (typeof window === 'undefined') return;

    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      this.captureError(event.error || new Error(event.message), {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.UNKNOWN,
        context: {
          url: window.location.href,
          userAgent: navigator.userAgent,
        },
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError(
        new Error(event.reason?.message || 'Unhandled Promise Rejection'),
        {
          severity: ErrorSeverity.HIGH,
          category: ErrorCategory.UNKNOWN,
          context: {
            url: window.location.href,
            userAgent: navigator.userAgent,
            reason: event.reason,
          },
        }
      );
    });
  }

  /**
   * Capture an error
   */
  public captureError(
    error: Error,
    options: {
      severity?: ErrorSeverity;
      category?: ErrorCategory;
      context?: ErrorContext;
      fingerprint?: string;
    } = {}
  ): void {
    if (!this.enabled) return;

    const report: ErrorReport = {
      message: error.message,
      stack: error.stack,
      severity: options.severity || ErrorSeverity.MEDIUM,
      category: options.category || this.categorizeError(error),
      context: {
        ...options.context,
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      },
      fingerprint: options.fingerprint || this.generateFingerprint(error),
    };

    // Add to queue
    this.addToQueue(report);

    // Log error
    logger.error('Error captured', error, report.context);

    // Track in analytics
    trackError(error.message, report.category, report.context);

    // Send to monitoring service
    this.sendToMonitoring(report);
  }

  /**
   * Categorize error based on message and stack
   */
  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    if (message.includes('token') || message.includes('auth')) {
      return ErrorCategory.AUTHENTICATION;
    }
    if (message.includes('fetch') || message.includes('network')) {
      return ErrorCategory.NETWORK;
    }
    if (message.includes('api') || message.includes('http')) {
      return ErrorCategory.API;
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorCategory.VALIDATION;
    }
    if (message.includes('export') || message.includes('download')) {
      return ErrorCategory.EXPORT;
    }
    if (stack.includes('react') || stack.includes('render')) {
      return ErrorCategory.RENDERING;
    }
    if (message.includes('data') || message.includes('parse')) {
      return ErrorCategory.DATA;
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * Generate error fingerprint for grouping
   */
  private generateFingerprint(error: Error): string {
    const message = error.message.replace(/\d+/g, 'N'); // Replace numbers
    const stack = error.stack?.split('\n')[0] || '';
    return `${message}:${stack}`;
  }

  /**
   * Add error to queue
   */
  private addToQueue(report: ErrorReport): void {
    this.errorQueue.push(report);

    // Limit queue size
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift();
    }
  }

  /**
   * Send error to monitoring service
   */
  private async sendToMonitoring(report: ErrorReport): Promise<void> {
    try {
      // In production, send to Sentry or other monitoring service
      if (this.sentryDsn) {
        // Sentry integration would go here
        // Sentry.captureException(error, { ...report });
      }

      // Send to backend for storage and alerting
      await fetch('/api/monitoring/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });
    } catch (error) {
      // Don't throw errors from error monitoring
      logger.warn('Failed to send error to monitoring service', error as Error);
    }
  }

  /**
   * Capture exception with context
   */
  public captureException(
    error: Error,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context: ErrorContext = {}
  ): void {
    this.captureError(error, { severity, context });
  }

  /**
   * Capture message (non-error event)
   */
  public captureMessage(
    message: string,
    severity: ErrorSeverity = ErrorSeverity.LOW,
    context: ErrorContext = {}
  ): void {
    const error = new Error(message);
    this.captureError(error, { severity, context });
  }

  /**
   * Set user context
   */
  public setUserContext(context: {
    userId?: string;
    valueCaseId?: string;
    companyName?: string;
    email?: string;
  }): void {
    // Store user context for future error reports
    if (typeof window !== 'undefined') {
      (window as any).__errorMonitoringUserContext = context;
    }
  }

  /**
   * Get error queue
   */
  public getErrorQueue(): ErrorReport[] {
    return [...this.errorQueue];
  }

  /**
   * Clear error queue
   */
  public clearErrorQueue(): void {
    this.errorQueue = [];
  }

  /**
   * Enable error monitoring
   */
  public enable(): void {
    this.enabled = true;
  }

  /**
   * Disable error monitoring
   */
  public disable(): void {
    this.enabled = false;
  }

  /**
   * Check if enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }
}

// Singleton instance
let errorMonitoringInstance: ErrorMonitoringService | null = null;

/**
 * Get error monitoring instance
 */
export function getErrorMonitoring(): ErrorMonitoringService {
  if (!errorMonitoringInstance) {
    errorMonitoringInstance = new ErrorMonitoringService();
  }
  return errorMonitoringInstance;
}

/**
 * Capture error
 */
export function captureError(
  error: Error,
  options?: {
    severity?: ErrorSeverity;
    category?: ErrorCategory;
    context?: ErrorContext;
  }
): void {
  getErrorMonitoring().captureError(error, options);
}

/**
 * Capture exception
 */
export function captureException(
  error: Error,
  severity?: ErrorSeverity,
  context?: ErrorContext
): void {
  getErrorMonitoring().captureException(error, severity, context);
}

/**
 * Capture message
 */
export function captureMessage(
  message: string,
  severity?: ErrorSeverity,
  context?: ErrorContext
): void {
  getErrorMonitoring().captureMessage(message, severity, context);
}

/**
 * Set user context
 */
export function setUserContext(context: {
  userId?: string;
  valueCaseId?: string;
  companyName?: string;
  email?: string;
}): void {
  getErrorMonitoring().setUserContext(context);
}

// Export singleton instance getter
export default getErrorMonitoring;
