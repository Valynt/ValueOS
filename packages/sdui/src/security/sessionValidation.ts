/**
 * Session Validation for SDUI
 *
 * Validates session state, expiration, and security context.
 */

import { logger } from "@shared/lib/logger";

import { incrementSecurityMetric } from "./metrics";

/**
 * Session context for SDUI rendering
 */
export interface SessionContext {
  sessionId: string;
  userId: string;
  organizationId: string;
  createdAt: number;
  lastActivityAt: number;
  expiresAt: number;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Session validation result
 */
export interface SessionValidationResult {
  valid: boolean;
  reason?: string;
  shouldRefresh?: boolean;
}

/**
 * Session configuration
 */
const SESSION_CONFIG = {
  MAX_AGE_MS: 24 * 60 * 60 * 1000, // 24 hours
  IDLE_TIMEOUT_MS: 2 * 60 * 60 * 1000, // 2 hours
  REFRESH_THRESHOLD_MS: 15 * 60 * 1000, // 15 minutes before expiry
};

/**
 * Validate session is not expired
 */
export function validateSessionExpiry(session: SessionContext): SessionValidationResult {
  const now = Date.now();

  // Check absolute expiration
  if (now > session.expiresAt) {
    incrementSecurityMetric("session_invalid", {
      reason: "expired",
      sessionId: session.sessionId,
      organizationId: session.organizationId,
    });

    logger.warn("Session expired", {
      sessionId: session.sessionId,
      userId: session.userId,
      organizationId: session.organizationId,
      expiresAt: new Date(session.expiresAt).toISOString(),
    });

    return {
      valid: false,
      reason: "Session expired. Please sign in again.",
    };
  }

  // Check idle timeout
  const idleTime = now - session.lastActivityAt;
  if (idleTime > SESSION_CONFIG.IDLE_TIMEOUT_MS) {
    incrementSecurityMetric("session_invalid", {
      reason: "idle_timeout",
      sessionId: session.sessionId,
      organizationId: session.organizationId,
      idleTime,
    });

    logger.warn("Session idle timeout", {
      sessionId: session.sessionId,
      userId: session.userId,
      organizationId: session.organizationId,
      idleTime,
    });

    return {
      valid: false,
      reason: "Session timed out due to inactivity. Please sign in again.",
    };
  }

  // Check if session should be refreshed soon
  const timeUntilExpiry = session.expiresAt - now;
  const shouldRefresh = timeUntilExpiry < SESSION_CONFIG.REFRESH_THRESHOLD_MS;

  return {
    valid: true,
    shouldRefresh,
  };
}

/**
 * Validate session has required fields
 */
export function validateSessionStructure(session: unknown): session is SessionContext {
  if (!session || typeof session !== "object") {
    return false;
  }

  const s = session as Record<string, unknown>;

  const required = [
    "sessionId",
    "userId",
    "organizationId",
    "createdAt",
    "lastActivityAt",
    "expiresAt",
  ];

  for (const field of required) {
    if (!(field in s)) {
      logger.error("Invalid session structure", new Error("Missing required field"), {
        missingField: field,
        sessionId: (s.sessionId as string) || "unknown",
      });
      return false;
    }
  }

  // Validate types
  if (
    typeof s.sessionId !== "string" ||
    typeof s.userId !== "string" ||
    typeof s.organizationId !== "string" ||
    typeof s.createdAt !== "number" ||
    typeof s.lastActivityAt !== "number" ||
    typeof s.expiresAt !== "number"
  ) {
    logger.error("Invalid session field types", new Error("Type mismatch"), {
      sessionId: (s.sessionId as string) || "unknown",
    });
    return false;
  }

  return true;
}

/**
 * Comprehensive session validation
 */
export function validateSession(session: unknown): SessionValidationResult {
  // Structure validation
  if (!validateSessionStructure(session)) {
    const s = session as Record<string, unknown>;
    incrementSecurityMetric("session_invalid", {
      reason: "invalid_structure",
      sessionId: (s?.sessionId as string) || "unknown",
    });

    return {
      valid: false,
      reason: "Invalid session format. Please sign in again.",
    };
  }

  // Expiry validation
  return validateSessionExpiry(session);
}

/**
 * Update session activity timestamp
 */
export function updateSessionActivity(session: SessionContext): SessionContext {
  return {
    ...session,
    lastActivityAt: Date.now(),
  };
}

/**
 * Create new session context
 */
export function createSessionContext(
  userId: string,
  organizationId: string,
  options?: {
    ipAddress?: string;
    userAgent?: string;
    maxAge?: number;
  }
): SessionContext {
  const now = Date.now();
  const maxAge = options?.maxAge || SESSION_CONFIG.MAX_AGE_MS;

  return {
    sessionId: generateSessionId(),
    userId,
    organizationId,
    createdAt: now,
    lastActivityAt: now,
    expiresAt: now + maxAge,
    ipAddress: options?.ipAddress,
    userAgent: options?.userAgent,
  };
}

/**
 * Generate secure session ID
 */
function generateSessionId(): string {
  // Use crypto.randomUUID if available (Node 14.17+)
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback to timestamp + random
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Check if session needs refresh
 */
export function shouldRefreshSession(session: SessionContext): boolean {
  const now = Date.now();
  const timeUntilExpiry = session.expiresAt - now;
  return timeUntilExpiry < SESSION_CONFIG.REFRESH_THRESHOLD_MS;
}

/**
 * Get session time remaining
 */
export function getSessionTimeRemaining(session: SessionContext): {
  totalMs: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const now = Date.now();
  const totalMs = Math.max(0, session.expiresAt - now);

  const seconds = Math.floor((totalMs / 1000) % 60);
  const minutes = Math.floor((totalMs / (1000 * 60)) % 60);
  const hours = Math.floor(totalMs / (1000 * 60 * 60));

  return { totalMs, hours, minutes, seconds };
}

/**
 * Export configuration for testing
 */
export const SESSION_VALIDATION_CONFIG = SESSION_CONFIG;
