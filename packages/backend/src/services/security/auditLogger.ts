/**
 * Security Audit Logger
 * Sends security events to the AuditLogService for SOC 2 Immutable Logging (CC6.8).
 *
 * Previously used navigator.sendBeacon / localStorage (browser-only APIs) which
 * caused all server-side security events to be silently dropped. Replaced with
 * direct calls to auditLogService.logAudit() so events are persisted server-side.
 */

import { logger } from "../../lib/logger.js";
import { SecurityAuditEvent } from "../../types/security.js";
import { auditLogService } from "./AuditLogService.js";

export const logSecurityEvent = async (event: SecurityAuditEvent): Promise<void> => {
  try {
    await auditLogService.logAudit({
      userId: event.userId ?? "system",
      userName: event.userId ?? "system",
      userEmail: "",
      action: event.action,
      resourceType: event.resourceType ?? event.resource,
      resourceId: event.resource,
      details: {
        ...event.details,
        ...event.metadata,
        severity: event.severity,
        sessionId: event.sessionId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        organizationId: event.organizationId,
        tenantId: event.tenantId,
      },
      status: event.outcome === "blocked" || event.outcome === "failure" ? "failed" : "success",
      timestamp: event.timestamp,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
    });
  } catch (error: unknown) {
    // Non-fatal: log the delivery failure but do not throw — security logging
    // must not break the calling code path.
    logger.error("Failed to deliver security audit event", error instanceof Error ? error : undefined, {
      action: event.action,
      severity: event.severity,
    });
  }
};

/**
 * Flush any pending events. No-op in the server-side implementation —
 * events are delivered synchronously via auditLogService.logAudit().
 * Kept for interface compatibility with any callers that invoke flushQueue().
 */
export const flushQueue = async (): Promise<void> => {
  // No-op: server-side delivery is synchronous, no queue to flush.
};
