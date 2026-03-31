/**
 * Enhanced Security Monitoring Logger
 * Extends the existing security logger with comprehensive event categorization,
 * severity levels, and monitoring capabilities for the security dashboard.
 */

import { logger } from "../lib/logger.js";

export interface SecurityEvent {
  type: string;
  category: SecurityCategory;
  severity: SecuritySeverity;
  outcome: "allowed" | "blocked" | "error" | "warning";
  reason?: string;
  metadata?: Record<string, unknown>;
  userId?: string;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
  timestamp?: string;
}

export type SecurityCategory =
  | "authentication"
  | "authorization"
  | "access_control"
  | "input_validation"
  | "output_encoding"
  | "session_management"
  | "cryptography"
  | "error_handling"
  | "logging_monitoring"
  | "data_protection"
  | "network_security"
  | "web_security"
  | "api_security"
  | "file_upload"
  | "third_party"
  | "rate_limiting"
  | "audit";

export type SecuritySeverity = "low" | "medium" | "high" | "critical";

/**
 * Log security-relevant events with structured metadata
 * Enhanced for security monitoring dashboard
 */
export function logSecurityEvent(event: SecurityEvent): void {
  const sanitizedEvent = {
    type: event.type,
    category: event.category,
    severity: event.severity,
    outcome: event.outcome,
    reason: event.reason,
    userId: event.userId,
    tenantId: event.tenantId,
    ipAddress: event.ipAddress,
    userAgent: event.userAgent ? event.userAgent.substring(0, 200) : undefined,
    sessionId: event.sessionId,
    requestId: event.requestId,
    metadata: sanitizeMetadata(event.metadata),
    timestamp: new Date().toISOString(),
  };

  // Use appropriate log level based on severity and outcome
  const logLevel = getLogLevel(event.severity, event.outcome);
  logger[logLevel]("SECURITY_EVENT", sanitizedEvent as unknown as Record<string, unknown>);
}

/**
 * Determine log level based on severity and outcome
 */
function getLogLevel(severity: SecuritySeverity, outcome: string): "info" | "warn" | "error" {
  if (outcome === "error" || severity === "critical") {
    return "error";
  }
  if (outcome === "blocked" || severity === "high") {
    return "warn";
  }
  return "info";
}

/**
 * Sanitize metadata to prevent accidental secret leakage
 */
function sanitizeMetadata(metadata?: Record<string, unknown> | null): Record<string, unknown> | undefined | null {
  if (metadata === null) return null;
  if (!metadata) return undefined;

  const sanitized = { ...metadata };

  // List of keys that should be redacted
  const redactKeys = [
    "password",
    "token",
    "secret",
    "key",
    "auth",
    "authorization",
    "bearer",
    "apikey",
    "api_key",
    "session",
    "cookie",
    "credential",
    "private_key",
  ];

  for (const [key, value] of Object.entries(sanitized)) {
    if (redactKeys.some((redactKey) => key.toLowerCase().includes(redactKey))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "string" && value.length > 500) {
      // Truncate long strings
      sanitized[key] = value.substring(0, 500) + "...[TRUNCATED]";
    } else if (Array.isArray(value)) {
      // Recursively sanitize array elements, preserving array type
      sanitized[key] = value.map((item) =>
        item !== null && typeof item === "object" && !Array.isArray(item)
          ? sanitizeMetadata(item as Record<string, unknown>)
          : item
      );
    } else if (typeof value === "object" && value !== null) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeMetadata(value as Record<string, unknown>);
    }
  }

  return sanitized;
}

/**
 * Enhanced convenience functions for comprehensive security event logging
 */
export const securityEvents = {
  // Authentication Events
  authSuccess: (userId: string, tenantId: string, metadata?: Record<string, unknown>) => {
    logSecurityEvent({
      type: "AUTH_SUCCESS",
      category: "authentication",
      severity: "low",
      outcome: "allowed",
      userId,
      tenantId,
      metadata,
    });
  },

  authFailure: (
    reason: string,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, unknown>
  ) => {
    logSecurityEvent({
      type: "AUTH_FAILURE",
      category: "authentication",
      severity: "medium",
      outcome: "blocked",
      reason,
      ipAddress,
      userAgent,
      metadata,
    });
  },

  sessionCreated: (userId: string, tenantId: string, sessionId: string) => {
    logSecurityEvent({
      type: "SESSION_CREATED",
      category: "session_management",
      severity: "low",
      outcome: "allowed",
      userId,
      tenantId,
      sessionId,
    });
  },

  sessionDestroyed: (userId: string, tenantId: string, sessionId: string, reason?: string) => {
    logSecurityEvent({
      type: "SESSION_DESTROYED",
      category: "session_management",
      severity: "low",
      outcome: "allowed",
      userId,
      tenantId,
      sessionId,
      reason,
    });
  },

  // Authorization Events
  accessGranted: (userId: string, tenantId: string, resource: string, action: string) => {
    logSecurityEvent({
      type: "ACCESS_GRANTED",
      category: "authorization",
      severity: "low",
      outcome: "allowed",
      userId,
      tenantId,
      metadata: { resource, action },
    });
  },

  accessDenied: (
    userId: string,
    tenantId: string,
    resource: string,
    action: string,
    reason?: string
  ) => {
    logSecurityEvent({
      type: "ACCESS_DENIED",
      category: "authorization",
      severity: "medium",
      outcome: "blocked",
      userId,
      tenantId,
      reason,
      metadata: { resource, action },
    });
  },

  // Rate Limiting Events
  rateLimitExceeded: (ipAddress: string, endpoint: string, limit: number) => {
    logSecurityEvent({
      type: "RATE_LIMIT_EXCEEDED",
      category: "rate_limiting",
      severity: "medium",
      outcome: "blocked",
      ipAddress,
      metadata: { endpoint, limit },
    });
  },

  // Input Validation Events
  inputValidationFailed: (field: string, reason: string, ipAddress?: string) => {
    logSecurityEvent({
      type: "INPUT_VALIDATION_FAILED",
      category: "input_validation",
      severity: "medium",
      outcome: "blocked",
      ipAddress,
      reason,
      metadata: { field },
    });
  },

  // XSS/CSRF Events
  xssAttempt: (input: string, context: string, ipAddress?: string) => {
    logSecurityEvent({
      type: "XSS_ATTEMPT",
      category: "web_security",
      severity: "high",
      outcome: "blocked",
      ipAddress,
      metadata: { context, inputLength: input.length },
    });
  },

  csrfViolation: (token: string, ipAddress?: string, userAgent?: string) => {
    logSecurityEvent({
      type: "CSRF_VIOLATION",
      category: "web_security",
      severity: "high",
      outcome: "blocked",
      ipAddress,
      userAgent,
      metadata: { tokenProvided: !!token },
    });
  },

  // SSRF Events
  ssrfCheck: (url: string, outcome: "allowed" | "blocked", reason?: string, ipAddress?: string) => {
    logSecurityEvent({
      type: "SSRF_CHECK",
      category: "network_security",
      severity: outcome === "blocked" ? "high" : "low",
      outcome,
      reason,
      ipAddress,
      metadata: { hostname: new URL(url).hostname },
    });
  },

  // File Upload Events
  fileUploadBlocked: (filename: string, reason: string, ipAddress?: string) => {
    logSecurityEvent({
      type: "FILE_UPLOAD_BLOCKED",
      category: "file_upload",
      severity: "high",
      outcome: "blocked",
      ipAddress,
      reason,
      metadata: { filename },
    });
  },

  // CSP Events
  cspViolation: (violation: Record<string, unknown>, ipAddress?: string) => {
    logSecurityEvent({
      type: "CSP_VIOLATION",
      category: "web_security",
      severity: "medium",
      outcome: "blocked",
      ipAddress,
      metadata: {
        violatedDirective: violation.violatedDirective,
        blockedUri: violation.blockedUri,
        sourceFile: violation.sourceFile,
      },
    });
  },

  // API Security Events
  apiKeyCompromised: (keyId: string, reason: string) => {
    logSecurityEvent({
      type: "API_KEY_COMPROMISED",
      category: "api_security",
      severity: "critical",
      outcome: "error",
      reason,
      metadata: { keyId },
    });
  },

  // Audit Events
  adminAction: (
    userId: string,
    action: string,
    resource: string,
    metadata?: Record<string, unknown>
  ) => {
    logSecurityEvent({
      type: "ADMIN_ACTION",
      category: "audit",
      severity: "low",
      outcome: "allowed",
      userId,
      metadata: { action, resource, ...metadata },
    });
  },

  // Error Handling Events
  securityError: (error: string, context: string, severity: SecuritySeverity = "medium") => {
    logSecurityEvent({
      type: "SECURITY_ERROR",
      category: "error_handling",
      severity,
      outcome: "error",
      reason: error,
      metadata: { context },
    });
  },

  // Data Protection Events
  dataExfiltrationAttempt: (userId: string, dataType: string, ipAddress?: string) => {
    logSecurityEvent({
      type: "DATA_EXFILTRATION_ATTEMPT",
      category: "data_protection",
      severity: "critical",
      outcome: "blocked",
      userId,
      ipAddress,
      metadata: { dataType },
    });
  },
};

/**
 * Security Metrics Collector
 * Tracks security KPIs for dashboard reporting
 */
export class SecurityMetricsCollector {
  private static instance: SecurityMetricsCollector;
  private metrics: Map<string, number> = new Map();
  private events: SecurityEvent[] = [];
  private readonly maxEvents = 1000;

  private constructor() {}

  static getInstance(): SecurityMetricsCollector {
    if (!SecurityMetricsCollector.instance) {
      SecurityMetricsCollector.instance = new SecurityMetricsCollector();
    }
    return SecurityMetricsCollector.instance;
  }

  recordEvent(event: SecurityEvent): void {
    // Update metrics counters
    const key = `${event.category}_${event.outcome}`;
    this.metrics.set(key, (this.metrics.get(key) || 0) + 1);

    // Sanitize metadata before storing to prevent secret leakage in memory/API
    const sanitizedEvent: SecurityEvent = {
      ...event,
      metadata: sanitizeMetadata(event.metadata),
    };

    // Store recent events (circular buffer)
    this.events.push(sanitizedEvent);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
  }

  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }

  getRecentEvents(limit: number = 50): SecurityEvent[] {
    return this.events.slice(-limit);
  }

  getEventsByCategory(category: SecurityCategory, limit: number = 20): SecurityEvent[] {
    return this.events.filter((event) => event.category === category).slice(-limit);
  }

  getEventsBySeverity(severity: SecuritySeverity, limit: number = 20): SecurityEvent[] {
    return this.events.filter((event) => event.severity === severity).slice(-limit);
  }

  reset(): void {
    this.metrics.clear();
    this.events = [];
  }
}

// Override the original logSecurityEvent to also record metrics
const originalLogSecurityEvent = logSecurityEvent;
(globalThis as Record<string, unknown>).logSecurityEvent = function (event: SecurityEvent): void {
  // Record metrics
  SecurityMetricsCollector.getInstance().recordEvent(event);

  // Log the event
  originalLogSecurityEvent(event);
};
