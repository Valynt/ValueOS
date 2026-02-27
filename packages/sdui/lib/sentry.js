"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.captureException = captureException;
exports.captureMessage = captureMessage;
/**
 * Sentry stub — captures exceptions when Sentry is configured,
 * otherwise logs to console.
 */
function captureException(error, context) {
    // In production, this would forward to Sentry.
    // For local dev, log to stderr.
    console.error("[sentry stub] captureException:", error, context);
}
function captureMessage(message, level) {
    console.warn(`[sentry stub] captureMessage (${level ?? "info"}):`, message);
}
//# sourceMappingURL=sentry.js.map