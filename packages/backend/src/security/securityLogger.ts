import { logger } from '../lib/logger.js'

export interface SecurityEvent {
  type: string;
  outcome: "allowed" | "blocked" | "error";
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log security-relevant events with structured metadata
 * Never logs secrets, tokens, or raw sensitive data
 */
export function logSecurityEvent(event: SecurityEvent): void {
  const sanitizedEvent = {
    type: event.type,
    outcome: event.outcome,
    reason: event.reason,
    metadata: sanitizeMetadata(event.metadata),
    timestamp: new Date().toISOString()
  };

  // Use appropriate log level based on outcome
  switch (event.outcome) {
    case "blocked":
      logger.warn("SECURITY_EVENT", sanitizedEvent);
      break;
    case "error":
      logger.error("SECURITY_EVENT", sanitizedEvent);
      break;
    default:
      logger.info("SECURITY_EVENT", sanitizedEvent);
  }
}

/**
 * Sanitize metadata to prevent accidental secret leakage
 */
function sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata) return undefined;

  const sanitized = { ...metadata };

  // List of keys that should be redacted
  const redactKeys = [
    'password', 'token', 'secret', 'key', 'auth',
    'authorization', 'bearer', 'apikey', 'api_key',
    'session', 'cookie', 'credential'
  ];

  for (const [key, value] of Object.entries(sanitized)) {
    if (redactKeys.some(redactKey => key.toLowerCase().includes(redactKey))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === 'string' && value.length > 100) {
      // Truncate long strings
      sanitized[key] = value.substring(0, 100) + "...";
    }
  }

  return sanitized;
}

/**
 * Convenience functions for common security events
 */
export const securityEvents = {
  ssrfCheck: (url: string, outcome: "allowed" | "blocked", reason?: string) => {
    logSecurityEvent({
      type: "SSRF_CHECK",
      outcome,
      reason,
      metadata: { hostname: new URL(url).hostname }
    });
  },

  cspViolation: (violation: any) => {
    logSecurityEvent({
      type: "CSP_VIOLATION",
      outcome: "blocked",
      metadata: {
        violatedDirective: violation.violatedDirective,
        blockedUri: violation.blockedUri,
        sourceFile: violation.sourceFile
      }
    });
  },

  deserializationFailure: (type: string, error: string) => {
    logSecurityEvent({
      type: "DESERIALIZATION_FAILURE",
      outcome: "error",
      reason: error,
      metadata: { dataType: type }
    });
  },

  authFailure: (reason: string, metadata?: Record<string, unknown>) => {
    logSecurityEvent({
      type: "AUTH_FAILURE",
      outcome: "blocked",
      reason,
      metadata
    });
  }
};
