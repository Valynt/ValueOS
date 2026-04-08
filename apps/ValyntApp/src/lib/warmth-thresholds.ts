/**
 * Warmth Thresholds — Configuration and resolution
 *
 * Phase 5.2: Custom Warmth Thresholds
 *
 * Manages per-case and global warmth threshold configuration.
 */

import type { WarmthOverrides } from "@shared/domain/Warmth";

/**
 * Default warmth threshold values per the warmth derivation spec.
 */
export const DEFAULT_THRESHOLDS = {
  firmMinimum: 0.6,
  verifiedMinimum: 0.8,
} as const;

/**
 * Bounded threshold ranges for UI constraints.
 * Prevents users from setting nonsensical thresholds.
 */
export const THRESHOLD_BOUNDS = {
  firmMinimum: {
    min: 0.5,
    max: 0.7,
    default: 0.6,
  },
  verifiedMinimum: {
    min: 0.7,
    max: 0.9,
    default: 0.8,
  },
} as const;

/**
 * User's global warmth threshold preferences.
 * Stored in UI store and persisted.
 */
export interface GlobalWarmthPreferences {
  firmMinimum: number;
  verifiedMinimum: number;
  updatedAt: string;
}

/**
 * Resolved warmth thresholds after applying override chain.
 */
export interface ResolvedThresholds {
  firmMinimum: number;
  verifiedMinimum: number;
  source: "per-case" | "global" | "default";
}

/**
 * Resolve warmth thresholds using precedence chain:
 * 1. Per-case override (if provided)
 * 2. Global user preference (if set)
 * 3. Spec defaults
 *
 * @param perCaseOverride — Optional per-case threshold override
 * @param globalPreference — Optional global user preference
 * @returns Resolved thresholds with source annotation
 */
export function resolveWarmthThresholds(
  perCaseOverride?: WarmthOverrides | null,
  globalPreference?: GlobalWarmthPreferences | null
): ResolvedThresholds {
  // Apply per-case override if valid
  if (perCaseOverride?.firmMinimum !== undefined) {
    const clampedFirm = Math.max(
      THRESHOLD_BOUNDS.firmMinimum.min,
      Math.min(THRESHOLD_BOUNDS.firmMinimum.max, perCaseOverride.firmMinimum)
    );
    const clampedVerified = perCaseOverride.verifiedMinimum !== undefined
      ? Math.max(
          THRESHOLD_BOUNDS.verifiedMinimum.min,
          Math.min(THRESHOLD_BOUNDS.verifiedMinimum.max, perCaseOverride.verifiedMinimum)
        )
      : (globalPreference?.verifiedMinimum ?? DEFAULT_THRESHOLDS.verifiedMinimum);

    return {
      firmMinimum: clampedFirm,
      verifiedMinimum: clampedVerified,
      source: "per-case",
    };
  }

  // Apply global preference if set
  if (globalPreference) {
    return {
      firmMinimum: globalPreference.firmMinimum,
      verifiedMinimum: globalPreference.verifiedMinimum,
      source: "global",
    };
  }

  // Fall back to defaults
  return {
    firmMinimum: DEFAULT_THRESHOLDS.firmMinimum,
    verifiedMinimum: DEFAULT_THRESHOLDS.verifiedMinimum,
    source: "default",
  };
}

/**
 * Clamp a threshold value to its valid range.
 *
 * @param value — Raw threshold value
 * @param type — Which threshold (firmMinimum or verifiedMinimum)
 * @returns Clamped value within bounds
 */
export function clampThreshold(
  value: number,
  type: "firmMinimum" | "verifiedMinimum"
): number {
  const bounds = THRESHOLD_BOUNDS[type];
  return Math.max(bounds.min, Math.min(bounds.max, value));
}

/**
 * Validate that thresholds are in correct relationship.
 * firmMinimum must be < verifiedMinimum.
 *
 * @param firmMinimum — Firm threshold
 * @param verifiedMinimum — Verified threshold
 * @returns true if valid
 */
export function validateThresholdRelationship(
  firmMinimum: number,
  verifiedMinimum: number
): boolean {
  return firmMinimum < verifiedMinimum;
}

/**
 * Get a human-readable label for a threshold value.
 *
 * @param value — Threshold value (0-1)
 * @returns Description string
 */
export function getThresholdLabel(value: number): string {
  if (value <= 0.5) return "Very Lenient";
  if (value <= 0.6) return "Lenient";
  if (value <= 0.7) return "Standard";
  if (value <= 0.8) return "Strict";
  return "Very Strict";
}

/**
 * Calculate what percentage of cases would reclassify under new thresholds.
 *
 * @param cases — Array of cases with current warmth and confidence
 * @param newFirmMinimum — Proposed firm threshold
 * @param newVerifiedMinimum — Proposed verified threshold
 * @returns Reclassification statistics
 */
export function calculateReclassificationImpact(
  cases: Array<{ confidence: number; currentWarmth: string }>,
  newFirmMinimum: number,
  newVerifiedMinimum: number
): {
  totalCases: number;
  reclassifiedCount: number;
  reclassifiedPercentage: number;
  formingToFirm: number;
  firmToVerified: number;
  verifiedToFirm: number;
  firmToForming: number;
} {
  let formingToFirm = 0;
  let firmToVerified = 0;
  let verifiedToFirm = 0;
  let firmToForming = 0;

  cases.forEach((c) => {
    const newWarmth = deriveWarmthFromThresholds(c.confidence, newFirmMinimum, newVerifiedMinimum);

    if (c.currentWarmth !== newWarmth) {
      if (c.currentWarmth === "forming" && newWarmth === "firm") formingToFirm++;
      if (c.currentWarmth === "firm" && newWarmth === "verified") firmToVerified++;
      if (c.currentWarmth === "verified" && newWarmth === "firm") verifiedToFirm++;
      if (c.currentWarmth === "firm" && newWarmth === "forming") firmToForming++;
    }
  });

  const reclassifiedCount = formingToFirm + firmToVerified + verifiedToFirm + firmToForming;

  return {
    totalCases: cases.length,
    reclassifiedCount,
    reclassifiedPercentage: cases.length > 0 ? (reclassifiedCount / cases.length) * 100 : 0,
    formingToFirm,
    firmToVerified,
    verifiedToFirm,
    firmToForming,
  };
}

/**
 * Derive warmth state from confidence and custom thresholds.
 *
 * @param confidence — Confidence score (0-1)
 * @param firmMinimum — Threshold for "firm" state
 * @param verifiedMinimum — Threshold for "verified" state
 * @returns Warmth state string
 */
function deriveWarmthFromThresholds(
  confidence: number,
  firmMinimum: number,
  verifiedMinimum: number
): "forming" | "firm" | "verified" {
  if (confidence >= verifiedMinimum) return "verified";
  if (confidence >= firmMinimum) return "firm";
  return "forming";
}

/**
 * Create a WarmthOverrides object with audit fields.
 *
 * @param params — Threshold values and metadata
 * @returns Complete WarmthOverrides object
 */
export function createWarmthOverrides(params: {
  firmMinimum?: number;
  verifiedMinimum?: number;
  userId: string;
  reason?: string;
}): WarmthOverrides {
  return {
    firmMinimum: params.firmMinimum,
    verifiedMinimum: params.verifiedMinimum,
    overriddenBy: params.userId,
    overriddenAt: new Date().toISOString(),
    reason: params.reason,
  };
}
