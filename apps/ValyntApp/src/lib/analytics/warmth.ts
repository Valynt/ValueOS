/**
 * Warmth Analytics — Tracking and audit logging for warmth system
 *
 * Phase 5.2: Custom Warmth Thresholds
 *
 * Tracks threshold changes, warmth transitions, and system usage.
 */

import type { WarmthState } from "@shared/domain/Warmth";

/**
 * Track a warmth threshold change event.
 *
 * @param params — Threshold change details
 */
export function trackThresholdChange(params: {
  thresholdType: "firmMinimum" | "verifiedMinimum";
  oldValue: number;
  newValue: number;
  caseId?: string;
  userId: string;
}): void {
  const event = {
    type: "WARMTH_THRESHOLD_CHANGED",
    timestamp: new Date().toISOString(),
    ...params,
  };

  // Send to analytics endpoint
  sendAnalytics(event).catch(console.error);
}

/**
 * Track a warmth state transition.
 *
 * @param params — Transition details
 */
export function trackWarmthTransition(params: {
  caseId: string;
  nodeId?: string;
  previousState: WarmthState;
  newState: WarmthState;
  confidence: number;
  trigger: "saga_change" | "confidence_update" | "threshold_change" | "manual";
}): void {
  const event = {
    type: "WARMTH_TRANSITION",
    timestamp: new Date().toISOString(),
    ...params,
  };

  sendAnalytics(event).catch(console.error);
}

/**
 * Track warmth comprehension metrics.
 * Used to validate that users understand the warmth model.
 *
 * @param params — Comprehension event details
 */
export function trackWarmthComprehension(params: {
  userId: string;
  action: "hovered_tooltip" | "expanded_details" | "clicked_warmth_badge" | "dismissed_help";
  warmthState: WarmthState;
  context: "dashboard" | "workspace" | "review" | "inspector";
}): void {
  const event = {
    type: "WARMTH_COMPREHENSION",
    timestamp: new Date().toISOString(),
    ...params,
  };

  sendAnalytics(event).catch(console.error);
}

/**
 * Send analytics event to the backend.
 *
 * @param event — Analytics event payload
 */
async function sendAnalytics(event: Record<string, unknown>): Promise<void> {
  // In production, this would send to an analytics endpoint
  // For now, log to console in development
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.log("[Analytics]", event);
  }

  // TODO: Implement actual analytics API call
  // await fetch('/api/analytics/events', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(event),
  // });
}

/**
 * Audit log entry for warmth threshold changes.
 * Used for compliance and accountability.
 *
 * @param params — Audit log details
 * @param auditLogger — Optional custom audit logger
 */
export function logThresholdChange(
  params: {
    caseId?: string;
    userId: string;
    oldThresholds: { firmMinimum?: number; verifiedMinimum?: number };
    newThresholds: { firmMinimum?: number; verifiedMinimum?: number };
    reason?: string;
  },
  auditLogger?: (entry: Record<string, unknown>) => void
): void {
  const entry = {
    action: "WARMTH_THRESHOLD_CHANGED",
    timestamp: new Date().toISOString(),
    actor: params.userId,
    resource: params.caseId ? `case:${params.caseId}` : "global",
    oldValues: params.oldThresholds,
    newValues: params.newThresholds,
    reason: params.reason,
  };

  if (auditLogger) {
    auditLogger(entry);
  } else {
    // Default: send to audit API
    sendAuditLog(entry).catch(console.error);
  }
}

/**
 * Send audit log entry to the backend.
 *
 * @param entry — Audit log entry
 */
async function sendAuditLog(entry: Record<string, unknown>): Promise<void> {
  // TODO: Implement actual audit API call
  // await fetch('/api/audit/log', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(entry),
  // });

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.log("[Audit]", entry);
  }
}

/**
 * Get warmth analytics summary for a user or organization.
 *
 * @param userId — User ID
 * @param orgId — Organization ID
 * @returns Analytics summary
 */
export async function getWarmthAnalytics(
  userId?: string,
  orgId?: string
): Promise<{
  totalTransitions: number;
  averageComprehensionScore: number;
  thresholdCustomizationRate: number;
  mostCommonTransitions: Array<{ from: WarmthState; to: WarmthState; count: number }>;
}> {
  // TODO: Implement actual analytics fetch
  return {
    totalTransitions: 0,
    averageComprehensionScore: 0,
    thresholdCustomizationRate: 0,
    mostCommonTransitions: [],
  };
}
