/**
 * Sentry stub — captures exceptions when Sentry is configured,
 * otherwise logs to console.
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  // In production, this would forward to Sentry.
  // For local dev, log to stderr.
  console.error("[sentry stub] captureException:", error, context);
}

export function captureMessage(message: string, level?: string): void {
  console.warn(`[sentry stub] captureMessage (${level ?? "info"}):`, message);
}
