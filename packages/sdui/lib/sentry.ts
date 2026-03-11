/**
 * Sentry integration for the SDUI package.
 *
 * Uses @sentry/react when available; falls back to console when not configured.
 */

import * as Sentry from "@sentry/react";

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  Sentry.withScope((scope) => {
    if (context) scope.setExtras(context);
    Sentry.captureException(error);
  });
}

export function captureMessage(message: string, level?: string): void {
  Sentry.captureMessage(message, (level as Sentry.SeverityLevel) ?? "info");
}
