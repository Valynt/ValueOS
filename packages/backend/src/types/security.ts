/**
 * Security Type Definitions
 *
 * Types for security audit logging, events, and compliance tracking.
 */

// ============================================================================
// Security Event Types
// ============================================================================

export type SecurityEventType =
  | "auth_success"
  | "auth_failure"
  | "access_denied"
  | "data_access"
  | "data_modification"
  | "configuration_change"
  | "privilege_escalation"
  | "session_created"
  | "session_terminated"
  | "mfa_enabled"
  | "mfa_disabled"
  | "password_changed"
  | "api_key_created"
  | "api_key_revoked"
  | "highSensitivityAccess"
  | "agentCompromised"
  | "circuitBreakerOpened"
  | "context_share_denied";

export type SecuritySeverity = "low" | "medium" | "high" | "critical";

// ============================================================================
// Security Audit Event
// ============================================================================

export interface SecurityAuditEvent {
  id?: string;
  timestamp: string;
  action: string;
  resource: string;
  resourceType?: string;
  userId?: string;
  organizationId?: string;
  tenantId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  outcome: "success" | "failure" | "blocked";
  severity: SecuritySeverity;
  details?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  timestamp: string;
  userId?: string;
  organizationId?: string;
  severity: SecuritySeverity;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// Alert Types
// ============================================================================

export type AlertType = "email" | "slack" | "pagerduty" | "webhook" | "sms" | "console";

export interface SecurityAlert {
  id: string;
  eventId: string;
  alertType: AlertType;
  status: "pending" | "sent" | "failed" | "acknowledged";
  createdAt: string;
  sentAt?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

// ============================================================================
// Security Metrics
// ============================================================================

export interface SecurityMetrics {
  totalEvents: number;
  eventsByType: Record<SecurityEventType, number>;
  eventsBySeverity: Record<SecuritySeverity, number>;
  failedAuthAttempts: number;
  blockedRequests: number;
  activeAlerts: number;
  lastUpdated: string;
  [key: string]: unknown; // Index signature for compatibility
}

// ============================================================================
// Rate Limiting
// ============================================================================

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  blockDurationMs: number;
}

export interface RateLimitState {
  requests: number;
  windowStart: number;
  blocked: boolean;
  blockedUntil?: number;
}
