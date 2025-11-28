/**
 * Error Telemetry
 * 
 * Captures and reports errors to monitoring services like Sentry.
 * Includes context, breadcrumbs, and user information.
 */

import { TenantContext } from '../TenantContext';

/**
 * Error severity level
 */
export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

/**
 * Error context
 */
export interface ErrorContext {
  /**
   * Component name where error occurred
   */
  component?: string;

  /**
   * Action being performed
   */
  action?: string;

  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;

  /**
   * Tenant context
   */
  tenant?: TenantContext;

  /**
   * User information
   */
  user?: {
    id: string;
    email?: string;
    username?: string;
  };

  /**
   * Request information
   */
  request?: {
    url: string;
    method: string;
    headers?: Record<string, string>;
  };
}

/**
 * Breadcrumb
 */
export interface Breadcrumb {
  timestamp: string;
  category: string;
  message: string;
  level: ErrorSeverity;
  data?: Record<string, any>;
}

/**
 * Error report
 */
export interface ErrorReport {
  error: Error;
  severity: ErrorSeverity;
  context: ErrorContext;
  breadcrumbs: Breadcrumb[];
  timestamp: string;
  fingerprint?: string[];
}

/**
 * Telemetry configuration
 */
export interface TelemetryConfig {
  /**
   * Enable telemetry
   */
  enabled: boolean;

  /**
   * Sentry DSN
   */
  sentryDsn?: string;

  /**
   * Environment (production, staging, development)
   */
  environment: string;

  /**
   * Release version
   */
  release?: string;

  /**
   * Sample rate (0-1)
   */
  sampleRate?: number;

  /**
   * Before send callback
   */
  beforeSend?: (report: ErrorReport) => ErrorReport | null;

  /**
   * Ignore errors matching patterns
   */
  ignoreErrors?: RegExp[];
}

/**
 * Error Telemetry Service
 */
export class ErrorTelemetry {
  private static instance: ErrorTelemetry;
  private config: TelemetryConfig;
  private breadcrumbs: Breadcrumb[] = [];
  private maxBreadcrumbs = 100;
  private context: ErrorContext = {};

  private constructor(config: TelemetryConfig) {
    this.config = config;
    this.initializeSentry();
  }

  /**
   * Initialize singleton
   */
  public static initialize(config: TelemetryConfig): ErrorTelemetry {
    if (!ErrorTelemetry.instance) {
      ErrorTelemetry.instance = new ErrorTelemetry(config);
    }
    return ErrorTelemetry.instance;
  }

  /**
   * Get instance
   */
  public static getInstance(): ErrorTelemetry | null {
    return ErrorTelemetry.instance || null;
  }

  /**
   * Initialize Sentry
   */
  private initializeSentry(): void {
    if (!this.config.enabled || !this.config.sentryDsn) {
      return;
    }

    // In a real implementation, initialize Sentry here
    // import * as Sentry from '@sentry/react';
    // Sentry.init({
    //   dsn: this.config.sentryDsn,
    //   environment: this.config.environment,
    //   release: this.config.release,
    //   sampleRate: this.config.sampleRate,
    // });

    console.log('[ErrorTelemetry] Initialized with Sentry DSN');
  }

  /**
   * Capture error
   */
  public captureError(
    error: Error,
    severity: ErrorSeverity = 'error',
    context?: ErrorContext
  ): void {
    if (!this.config.enabled) {
      return;
    }

    // Check if error should be ignored
    if (this.shouldIgnoreError(error)) {
      return;
    }

    // Create error report
    const report: ErrorReport = {
      error,
      severity,
      context: { ...this.context, ...context },
      breadcrumbs: [...this.breadcrumbs],
      timestamp: new Date().toISOString(),
      fingerprint: this.generateFingerprint(error, context),
    };

    // Apply beforeSend callback
    const processedReport = this.config.beforeSend?.(report) || report;
    if (!processedReport) {
      return;
    }

    // Send to Sentry
    this.sendToSentry(processedReport);

    // Log locally
    this.logError(processedReport);
  }

  /**
   * Capture exception
   */
  public captureException(error: Error, context?: ErrorContext): void {
    this.captureError(error, 'error', context);
  }

  /**
   * Capture message
   */
  public captureMessage(
    message: string,
    severity: ErrorSeverity = 'info',
    context?: ErrorContext
  ): void {
    const error = new Error(message);
    this.captureError(error, severity, context);
  }

  /**
   * Add breadcrumb
   */
  public addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
    this.breadcrumbs.push({
      ...breadcrumb,
      timestamp: new Date().toISOString(),
    });

    // Trim old breadcrumbs
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.maxBreadcrumbs);
    }
  }

  /**
   * Set context
   */
  public setContext(context: Partial<ErrorContext>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Set user
   */
  public setUser(user: ErrorContext['user']): void {
    this.context.user = user;
  }

  /**
   * Set tenant
   */
  public setTenant(tenant: TenantContext): void {
    this.context.tenant = tenant;
    this.setUser({
      id: tenant.userId,
    });
  }

  /**
   * Clear context
   */
  public clearContext(): void {
    this.context = {};
  }

  /**
   * Clear breadcrumbs
   */
  public clearBreadcrumbs(): void {
    this.breadcrumbs = [];
  }

  /**
   * Check if error should be ignored
   */
  private shouldIgnoreError(error: Error): boolean {
    if (!this.config.ignoreErrors) {
      return false;
    }

    return this.config.ignoreErrors.some((pattern) => pattern.test(error.message));
  }

  /**
   * Generate error fingerprint
   */
  private generateFingerprint(error: Error, context?: ErrorContext): string[] {
    const fingerprint: string[] = [error.name];

    if (context?.component) {
      fingerprint.push(context.component);
    }

    if (context?.action) {
      fingerprint.push(context.action);
    }

    // Add first line of stack trace
    const stackLine = error.stack?.split('\n')[1];
    if (stackLine) {
      fingerprint.push(stackLine.trim());
    }

    return fingerprint;
  }

  /**
   * Send to Sentry
   */
  private sendToSentry(report: ErrorReport): void {
    // In a real implementation, send to Sentry here
    // import * as Sentry from '@sentry/react';
    // Sentry.captureException(report.error, {
    //   level: report.severity,
    //   contexts: {
    //     custom: report.context,
    //   },
    //   fingerprint: report.fingerprint,
    // });

    console.log('[ErrorTelemetry] Would send to Sentry:', {
      error: report.error.message,
      severity: report.severity,
      context: report.context,
    });
  }

  /**
   * Log error locally
   */
  private logError(report: ErrorReport): void {
    const logMethod = report.severity === 'fatal' || report.severity === 'error' ? 'error' : 'warn';

    console[logMethod]('[ErrorTelemetry]', {
      error: report.error,
      severity: report.severity,
      context: report.context,
      breadcrumbs: report.breadcrumbs.slice(-5), // Last 5 breadcrumbs
      timestamp: report.timestamp,
    });
  }
}

/**
 * Initialize error telemetry
 */
export function initializeErrorTelemetry(config: TelemetryConfig): ErrorTelemetry {
  return ErrorTelemetry.initialize(config);
}

/**
 * Capture error
 */
export function captureError(
  error: Error,
  severity?: ErrorSeverity,
  context?: ErrorContext
): void {
  const telemetry = ErrorTelemetry.getInstance();
  if (telemetry) {
    telemetry.captureError(error, severity, context);
  } else {
    console.error('[ErrorTelemetry] Not initialized:', error);
  }
}

/**
 * Capture exception
 */
export function captureException(error: Error, context?: ErrorContext): void {
  captureError(error, 'error', context);
}

/**
 * Capture message
 */
export function captureMessage(
  message: string,
  severity?: ErrorSeverity,
  context?: ErrorContext
): void {
  const telemetry = ErrorTelemetry.getInstance();
  if (telemetry) {
    telemetry.captureMessage(message, severity, context);
  } else {
    console.log('[ErrorTelemetry] Not initialized:', message);
  }
}

/**
 * Add breadcrumb
 */
export function addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
  const telemetry = ErrorTelemetry.getInstance();
  if (telemetry) {
    telemetry.addBreadcrumb(breadcrumb);
  }
}

export default ErrorTelemetry;
