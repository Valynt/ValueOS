/**
 * Case display utilities — extracted from Dashboard.tsx
 *
 * Pure functions that derive warmth state, display fields, and sort orders
 * from ValueCaseWithRelations. No React dependencies.
 */

import type { ValueCaseWithRelations } from "@/lib/supabase/types";
import type { WarmthState } from "@/lib/warmth";

// ============================================================================
// Stage → Warmth mapping
// ============================================================================

const STAGE_TO_WARMTH: Record<string, WarmthState> = {
  discovery: "forming",
  target: "firm",
  narrative: "verified",
  realization: "verified",
  expansion: "verified",
};

export function deriveWarmthFromCase(c: ValueCaseWithRelations): WarmthState {
  const s = c.stage?.toLowerCase() ?? "";
  for (const [key, warmth] of Object.entries(STAGE_TO_WARMTH)) {
    if (s.includes(key)) return warmth;
  }
  return "forming";
}

// ============================================================================
// Warmth grouping & aggregation
// ============================================================================

export interface WarmthCounts {
  forming: number;
  firm: number;
  verified: number;
}

export function groupCasesByWarmth(cases: ValueCaseWithRelations[]): WarmthCounts {
  const counts: WarmthCounts = { forming: 0, firm: 0, verified: 0 };
  for (const c of cases) {
    counts[deriveWarmthFromCase(c)]++;
  }
  return counts;
}

export function getTotalValueByWarmth(
  cases: ValueCaseWithRelations[],
): WarmthCounts {
  const totals: WarmthCounts = { forming: 0, firm: 0, verified: 0 };
  for (const c of cases) {
    const warmth = deriveWarmthFromCase(c);
    const meta = c.metadata as Record<string, unknown> | null;
    const value = typeof meta?.projected_value === "number" ? meta.projected_value : 0;
    totals[warmth] += value;
  }
  return totals;
}

// ============================================================================
// Warmth-priority sorting
// ============================================================================

const WARMTH_SORT_ORDER: Record<WarmthState, number> = {
  forming: 0,
  firm: 1,
  verified: 2,
};

function isNeedsInput(c: ValueCaseWithRelations): boolean {
  const meta = c.metadata as Record<string, unknown> | null;
  return meta?.agent_status === "needs-input";
}

export function sortByWarmthPriority(
  cases: ValueCaseWithRelations[],
): ValueCaseWithRelations[] {
  return [...cases].sort((a, b) => {
    const aNeedsInput = isNeedsInput(a) ? 0 : 1;
    const bNeedsInput = isNeedsInput(b) ? 0 : 1;
    if (aNeedsInput !== bNeedsInput) return aNeedsInput - bNeedsInput;

    const aWarmth = WARMTH_SORT_ORDER[deriveWarmthFromCase(a)];
    const bWarmth = WARMTH_SORT_ORDER[deriveWarmthFromCase(b)];
    if (aWarmth !== bWarmth) return aWarmth - bWarmth;

    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

// ============================================================================
// Display field derivation
// ============================================================================

export interface CaseDisplayFields {
  companyName: string;
  value: string;
  nextAction: string;
  lastActivity: string;
  confidence: number;
  status: string;
}

export function deriveCaseDisplayFields(c: ValueCaseWithRelations): CaseDisplayFields {
  const meta = c.metadata as Record<string, unknown> | null;

  const companyName = c.company_profiles?.company_name ?? c.name;

  let value = "—";
  if (typeof meta?.projected_value === "number") {
    value = `$${(meta.projected_value / 1_000_000).toFixed(1)}M`;
  }

  let nextAction = "Agent working — check back shortly";
  if (typeof meta?.next_action === "string") {
    nextAction = meta.next_action;
  } else if (meta?.agent_status === "needs-input") {
    nextAction = "Review flagged assumptions";
  } else if (c.status === "review") {
    nextAction = "Output ready for your review";
  } else if (meta?.agent_status === "paused") {
    nextAction = "Resume case";
  }

  const updated = new Date(c.updated_at);
  const diffMs = Date.now() - updated.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  let lastActivity: string;
  if (diffMin < 1) {
    lastActivity = "Just now";
  } else if (diffMin < 60) {
    lastActivity = `Updated ${diffMin}m ago`;
  } else {
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) {
      lastActivity = `Updated ${diffH}h ago`;
    } else {
      lastActivity = `Updated ${Math.floor(diffH / 24)}d ago`;
    }
  }

  const confidence =
    typeof c.quality_score === "number" ? Math.round(c.quality_score * 100) : 0;

  const status = (() => {
    if (c.status === "review") return "review";
    if (meta?.agent_status === "running") return "running";
    if (meta?.agent_status === "needs-input") return "needs-input";
    return "paused";
  })();

  return { companyName, value, nextAction, lastActivity, confidence, status };
}
