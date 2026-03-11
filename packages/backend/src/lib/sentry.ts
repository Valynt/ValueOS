/**
 * Sentry integration for the backend.
 *
 * Initialises @sentry/node when SENTRY_DSN is set; otherwise all calls are
 * no-ops so the rest of the codebase can import unconditionally.
 */

import * as Sentry from "@sentry/node";

import { logger } from "./logger.js";

export interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  sample_rate?: number;
}

let initialised = false;

export function initSentry(config: SentryConfig): void {
  if (!config.dsn) {
    logger.warn("Sentry DSN not configured — error tracking disabled");
    return;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,
    tracesSampleRate: config.sample_rate ?? (config.environment === "production" ? 0.1 : 1.0),
  });

  initialised = true;
  logger.info("Sentry initialised", { environment: config.environment });
}

export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (initialised) {
    Sentry.withScope((scope) => {
      if (context) scope.setExtras(context);
      Sentry.captureException(error);
    });
  } else {
    logger.error("Unhandled exception (Sentry not configured)", error, context);
  }
}

export function captureMessage(message: string, level: "info" | "warning" | "error" = "info"): void {
  if (initialised) {
    Sentry.captureMessage(message, level === "warning" ? "warning" : level);
  } else {
    logger.warn(`[sentry-noop] ${message}`, { level });
  }
}

export function addBreadcrumb(breadcrumb: {
  message: string;
  category?: string;
  level?: string;
  data?: Record<string, unknown>;
}): void {
  if (initialised) {
    Sentry.addBreadcrumb(breadcrumb);
  }
}
