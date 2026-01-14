/**
 * Sentry Integration
 *
 * Provides error tracking and performance monitoring for production.
 * Only initializes in production environment.
 */

import { logger } from "./logger";
import { getConfig, isDevelopment, isProduction } from "../config/environment";
import * as Sentry from "@sentry/react";

// Type-safe Sentry interface (will be replaced with actual SDK)
interface SentryContext {
  react?: {
    componentStack?: string;
  };
  [key: string]: unknown;
}

interface SentryExtra {
  [key: string]: unknown;
}

/**
 * Initialize Sentry for error tracking
 *
 * @example
 * ```typescript
 * import { initializeSentry } from './lib/sentry';
 *
 * // In bootstrap
 * if (config.monitoring.sentry.enabled) {
 *   await initializeSentry();
 * }
 * ```
 */
export async function initializeSentry(): Promise<void> {
  const config = getConfig();

  // Always allow initialization check, let internal logic decide to skip
  if (!isProduction() && !config.monitoring.sentry.enabled) {
    logger.debug("[Sentry] Skipping initialization (not in production)");
    return;
  }

  if (!config.monitoring.sentry.enabled) {
    logger.debug("[Sentry] Disabled in configuration");
    return;
  }

  if (!config.monitoring.sentry.dsn) {
    logger.error("[Sentry] DSN not configured");
    return;
  }

  try {
    Sentry.init({
      dsn: config.monitoring.sentry.dsn,
      environment: config.monitoring.sentry.environment,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      tracesSampleRate: config.monitoring.sentry.sampleRate,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,

      // Performance monitoring
      beforeSend(event) {
        // Filter out development errors
        if (event.environment === "development") {
          return null;
        }
        return event;
      },

      // Ignore common non-critical errors
      ignoreErrors: [
        "ResizeObserver loop limit exceeded",
        "Non-Error promise rejection captured",
      ],
    });

    logger.debug("[Sentry] Initialized successfully");
  } catch (error) {
    logger.error("[Sentry] Initialization failed:", error);
  }
}

/**
 * Capture an exception manually
 *
 * @example
 * ```typescript
 * try {
 *   // risky operation
 * } catch (error) {
 *   captureException(error, {
 *     extra: { userId: '123', action: 'save' }
 *   });
 * }
 * ```
 */
export function captureException(
  error: Error,
  options?: {
    contexts?: SentryContext;
    extra?: SentryExtra;
  }
): void {
  if (!isProduction()) {
    logger.error("[Sentry] Would capture exception:", error, options);
    return;
  }

  // Cast options to match Sentry's expected type
  Sentry.captureException(error, options as unknown as Sentry.CaptureContext);
}

/**
 * Capture a message manually
 *
 * @example
 * ```typescript
 * captureMessage('User completed onboarding', {
 *   level: 'info',
 *   extra: { userId: '123' }
 * });
 * ```
 */
export function captureMessage(
  message: string,
  options?: {
    level?: "fatal" | "error" | "warning" | "log" | "info" | "debug";
    extra?: SentryExtra;
  }
): void {
  if (!isProduction()) {
    logger.debug("[Sentry] Would capture message:", message, options);
    return;
  }

  // Handle level conversion if necessary, though Sentry types usually match
  // @ts-ignore - Sentry types are strict about the context object
  Sentry.captureMessage(message, { level: (options?.level || "info") as any });
}

/**
 * Set user context for error tracking
 *
 * @example
 * ```typescript
 * setUser({
 *   id: '123',
 *   email: 'user@example.com',
 *   username: 'john_doe'
 * });
 * ```
 */
export function setUser(
  user: {
    id: string;
    email?: string;
    username?: string;
    [key: string]: unknown;
  } | null
): void {
  if (!isProduction()) {
    logger.debug("[Sentry] Would set user:", user);
    return;
  }

  Sentry.setUser(user);
}

/**
 * Add breadcrumb for debugging
 *
 * @example
 * ```typescript
 * addBreadcrumb({
 *   category: 'navigation',
 *   message: 'User navigated to dashboard',
 *   level: 'info'
 * });
 * ```
 */
export function addBreadcrumb(breadcrumb: {
  category?: string;
  message: string;
  level?: "fatal" | "error" | "warning" | "log" | "info" | "debug";
  data?: Record<string, unknown>;
}): void {
  if (!isProduction()) {
    logger.debug("[Sentry] Would add breadcrumb:", breadcrumb);
    return;
  }

  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Start a performance transaction
 *
 * @example
 * ```typescript
 * const transaction = startTransaction({
 *   name: 'Load Dashboard',
 *   op: 'navigation'
 * });
 *
 * // ... do work ...
 *
 * transaction.finish();
 * ```
 */
export function startTransaction(options: { name: string; op: string }): {
  finish: () => void;
  setStatus: (status: string) => void;
} {
  if (!isProduction()) {
    logger.debug("[Sentry] Would start transaction:", options);
    return {
      finish: () =>
        logger.debug("[Sentry] Transaction finished:", { name: options.name }),
      setStatus: (status) =>
        logger.debug("[Sentry] Transaction status:", { status }),
    };
  }

  // Sentry v8 usage of startSpan.
  // Note: This returns a simplified object to match existing API.
  // The actual span is active within the callback in startSpan, but here we're trying to return a control object.
  // This pattern is problematic with v8's startSpan which expects a callback.
  // For now, we will use startInactiveSpan which returns a span that must be manually ended.

  const span = Sentry.startInactiveSpan({ name: options.name, op: options.op });

  return {
    finish: () => span.end(),
    setStatus: (status: string) => {
      // Map string status to SpanStatusCode (1=OK, 2=ERROR)
      const code = status === "ok" ? 1 : 2;
      // @ts-ignore - OpenTelemetry types mismatch
      span.setStatus({ code, message: status });
    },
  };
}

/**
 * Check if Sentry is enabled
 */
export function isSentryEnabled(): boolean {
  const config = getConfig();
  return isProduction() && config.monitoring.sentry.enabled;
}

export default {
  initializeSentry,
  captureException,
  captureMessage,
  setUser,
  addBreadcrumb,
  startTransaction,
  isSentryEnabled,
};
