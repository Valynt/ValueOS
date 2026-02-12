/**
 * Security Audit Logger
 * Sends security events to backend for SOC 2 Immutable Logging (CC6.8)
 */

import { SecurityAuditEvent } from "@/types/security";
import { logger } from "../../lib/logger";

/**
 * Sends security events to the backend for SOC 2 Immutable Logging.
 * This must not be blocked by ad-blockers.
 */
export const logSecurityEvent = async (
  event: SecurityAuditEvent
): Promise<void> => {
  // In development, console.warn for visibility
  if (process.env.NODE_ENV === "development") {
    console.warn(`[SECURITY AUDIT] ${event.action}: ${event.resource}`, event);
  }

  // Fire-and-forget beacon to backend security endpoint
  try {
    const blob = new Blob([JSON.stringify(event)], {
      type: "application/json",
    });

    // Use sendBeacon for reliable delivery (works even during page unload)
    const success = navigator.sendBeacon("/api/security/audit", blob);

    if (!success && process.env.NODE_ENV === "development") {
      console.warn("sendBeacon failed, falling back to fetch");

      // Fallback to fetch for development
      await fetch("/api/security/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
        keepalive: true, // Ensure delivery even if page is closing
      });
    }
  } catch (e) {
    // Fail safe - do not crash app if logging fails
    console.error("Failed to dispatch security audit log", e);

    // In production, you might want to queue failed events for retry
    if (typeof window !== "undefined" && "localStorage" in window) {
      try {
        const queue = JSON.parse(
          localStorage.getItem("security_audit_queue") || "[]"
        );
        queue.push(event);
        localStorage.setItem(
          "security_audit_queue",
          JSON.stringify(queue.slice(-50))
        ); // Keep last 50
      } catch (storageError) {
        console.error("Failed to queue audit event", storageError);
      }
    }
  }
};

/**
 * Retry queued audit events (call on app startup)
 */
export const retryQueuedAuditEvents = async (): Promise<void> => {
  if (typeof window === "undefined" || !("localStorage" in window)) return;

  try {
    const queue = JSON.parse(
      localStorage.getItem("security_audit_queue") || "[]"
    );

    if (queue.length > 0) {
      logger.info(`Retrying ${queue.length} queued security audit events`);

      for (const event of queue) {
        await logSecurityEvent(event);
      }

      localStorage.removeItem("security_audit_queue");
    }
  } catch (e) {
    console.error("Failed to retry queued audit events", e);
  }
};
