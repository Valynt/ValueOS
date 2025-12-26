import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";
import { env, getEnvVar } from "../env";

/**
 * Initialize Sentry for production monitoring.
 */
export function initSentry(): void {
  if (!env.isProduction || !getEnvVar("VITE_SENTRY_DSN")) {
    console.log(
      "Sentry initialization skipped (not production or missing DSN)"
    );
    return;
  }

  Sentry.init({
    dsn: getEnvVar("VITE_SENTRY_DSN"),
    integrations: [new BrowserTracing()],

    // Performance Monitoring
    tracesSampleRate: 0.1, // Adjust in production

    // Environment
    environment: env.mode,

    // Filter sensitive data
    beforeSend(event) {
      // Remove sensitive information from the event
      if (event.request && event.request.headers) {
        delete event.request.headers["Authorization"];
        delete event.request.headers["Cookie"];
        delete event.request.headers["x-csrf-token"];
      }
      return event;
    },

    // Session tracking for crash-free users metric
    autoSessionTracking: true,
  });

  console.log("Sentry monitoring initialized");
}

/**
 * Log an error to Sentry with additional context.
 */
export function captureException(
  error: any,
  context?: Record<string, any>
): void {
  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureException(error);
  });
}

/**
 * Log a message to Sentry as an info event.
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = "info"
): void {
  Sentry.captureMessage(message, level);
}

/**
 * Set user context for Sentry events.
 */
export function setUserContext(user: {
  id: string;
  email?: string;
  organizationId?: string;
}): void {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    organization_id: user.organizationId,
  });
}
