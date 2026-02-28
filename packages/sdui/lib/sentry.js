/**
 * Sentry stub — captures exceptions when Sentry is configured,
 * otherwise logs to console.
 */
export function captureException(error, context) {
    // In production, this would forward to Sentry.
    // For local dev, log to stderr.
    console.error("[sentry stub] captureException:", error, context);
}
export function captureMessage(message, level) {
    console.warn(`[sentry stub] captureMessage (${level ?? "info"}):`, message);
}
//# sourceMappingURL=sentry.js.map