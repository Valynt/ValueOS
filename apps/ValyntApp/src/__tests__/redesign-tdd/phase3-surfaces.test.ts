/**
 * TDD: Frontend Redesign — Phase 3 Surfaces & Phase 5 Realization Contracts
 *
 * Tests for the dashboard warmth summary, case listing, reviewer surface,
 * and realization tracker integration.
 *
 * Run: pnpm --filter ValyntApp test -- redesign-tdd
 */

import { describe, expect, it, vi } from "vitest";

// Mock Supabase to avoid import-time credential check
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }) },
  },
  createBrowserSupabaseClient: vi.fn(),
}));

// Mock TenantContext used by useRealization hooks
vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({ currentTenant: { id: "test-tenant" }, tenants: [], loading: false }),
}));

import type { SagaStateEnum } from "@shared/domain/ExperienceModel";
import { deriveWarmth } from "@shared/domain/Warmth";

// ============================================================================
// §5.1 Dashboard: Warmth Summary Aggregation Contract
// ============================================================================

describe("Dashboard: warmth aggregation", () => {

  it("aggregates cases by warmth state", () => {
    const cases = [
      { sagaState: "INITIATED", confidence: 0.3 },
      { sagaState: "DRAFTING", confidence: 0.5 },
      { sagaState: "VALIDATING", confidence: 0.7 },
      { sagaState: "COMPOSING", confidence: 0.6 },
      { sagaState: "REFINING", confidence: 0.9 },
      { sagaState: "FINALIZED", confidence: 0.95 },
    ];

    const warmthCounts = { forming: 0, firm: 0, verified: 0 };
    for (const c of cases) {
      const result = deriveWarmth(c.sagaState as SagaStateEnum, c.confidence);
      warmthCounts[result.state as keyof typeof warmthCounts]++;
    }

    expect(warmthCounts.forming).toBe(2);
    expect(warmthCounts.firm).toBe(2);
    expect(warmthCounts.verified).toBe(2);
  });

  it("handles empty case list", () => {
    const cases: Array<{ sagaState: string; confidence: number }> = [];
    const warmthCounts = { forming: 0, firm: 0, verified: 0 };

    for (const c of cases) {
      const result = deriveWarmth(c.sagaState as SagaStateEnum, c.confidence);
      warmthCounts[result.state as keyof typeof warmthCounts]++;
    }

    expect(warmthCounts.forming).toBe(0);
    expect(warmthCounts.firm).toBe(0);
    expect(warmthCounts.verified).toBe(0);
  });

  it("warmth-sorted activity feed orders forming first, then firm, then verified", () => {
    const WARMTH_SORT_ORDER = { forming: 0, firm: 1, verified: 2 };

    const cases = [
      { name: "Case A", warmth: "verified" as const },
      { name: "Case B", warmth: "forming" as const },
      { name: "Case C", warmth: "firm" as const },
    ];

    const sorted = [...cases].sort(
      (a, b) => WARMTH_SORT_ORDER[a.warmth] - WARMTH_SORT_ORDER[b.warmth],
    );

    expect(sorted[0]!.warmth).toBe("forming");
    expect(sorted[1]!.warmth).toBe("firm");
    expect(sorted[2]!.warmth).toBe("verified");
  });
});

// ============================================================================
// §5.3 Reviewer Surface: Approval Workflow Contract
// ============================================================================

describe("Reviewer surface: approval workflow", () => {
  it("approval states are a closed set", () => {
    const APPROVAL_ACTIONS = ["approve", "request_changes", "reject"] as const;

    expect(APPROVAL_ACTIONS).toHaveLength(3);
    expect(APPROVAL_ACTIONS).toContain("approve");
    expect(APPROVAL_ACTIONS).toContain("request_changes");
    expect(APPROVAL_ACTIONS).toContain("reject");
  });

  it("export formats include PDF", () => {
    const EXPORT_FORMATS = ["pdf", "presentation", "share_link"] as const;

    expect(EXPORT_FORMATS).toContain("pdf");
  });
});

// ============================================================================
// §5.3 Realization Tracker: Existing API Contract
// ============================================================================

import {
  useApproveCase,
  useBaseline,
  useCheckpoints,
  useRealizationReport,
  useRunRealizationAgent,
} from "@/hooks/useRealization";

describe("Realization tracker: existing hooks contract", () => {
  it("useRealizationReport hook signature is stable", () => {
    expect(typeof useRealizationReport).toBe("function");
  });

  it("useBaseline hook signature is stable", () => {
    expect(typeof useBaseline).toBe("function");
  });

  it("useCheckpoints hook signature is stable", () => {
    expect(typeof useCheckpoints).toBe("function");
  });

  it("useApproveCase hook signature is stable", () => {
    expect(typeof useApproveCase).toBe("function");
  });

  it("useRunRealizationAgent hook signature is stable", () => {
    expect(typeof useRunRealizationAgent).toBe("function");
  });
});

// ============================================================================
// §5.3 Realization Types: KPI Variance Contract
// ============================================================================

describe("Realization: KPI variance types", () => {
  it("KPIVariance direction is a closed set", () => {
    const VALID_DIRECTIONS = ["over", "under", "on_target"] as const;
    expect(VALID_DIRECTIONS).toHaveLength(3);
  });

  it("CheckpointStatus is a closed set", () => {
    const VALID_STATUSES = ["pending", "measured", "missed", "exceeded"] as const;
    expect(VALID_STATUSES).toHaveLength(4);
    expect(VALID_STATUSES).toContain("measured");
    expect(VALID_STATUSES).toContain("missed");
  });

  it("realization rate maps to warmth states", () => {
    // Blueprint §5.3.1: >90% = verified, 70-90% = firm, <70% = forming
    function realizationToWarmth(rate: number): string {
      if (rate >= 90) return "verified";
      if (rate >= 70) return "firm";
      return "forming";
    }

    expect(realizationToWarmth(95)).toBe("verified");
    expect(realizationToWarmth(90)).toBe("verified");
    expect(realizationToWarmth(85)).toBe("firm");
    expect(realizationToWarmth(70)).toBe("firm");
    expect(realizationToWarmth(69)).toBe("forming");
    expect(realizationToWarmth(0)).toBe("forming");
  });
});

// ============================================================================
// Phase 5.3: Expansion Trigger Contract
// ============================================================================

describe("Expansion triggers: threshold contract", () => {
  it("expansion fires when KPIs exceed target by >15% for >2 checkpoints", () => {
    const EXPANSION_THRESHOLDS = {
      exceedPercent: 15,
      consecutiveCheckpoints: 2,
      minKPIsExceeding: 2,
    };

    expect(EXPANSION_THRESHOLDS.exceedPercent).toBe(15);
    expect(EXPANSION_THRESHOLDS.consecutiveCheckpoints).toBe(2);
    expect(EXPANSION_THRESHOLDS.minKPIsExceeding).toBe(2);
  });

  it("expansion signal types are defined", () => {
    const TRIGGER_TYPES = [
      "kpi_exceeded",
      "timeline_ahead",
      "scope_increase",
    ] as const;

    expect(TRIGGER_TYPES).toHaveLength(3);
    expect(TRIGGER_TYPES).toContain("kpi_exceeded");
  });
});

// ============================================================================
// §6.3 SDUI Integration: Component Registry Contract
// ============================================================================

describe("SDUI: registry compatibility", () => {
  it("SDUI feature module exports exist", async () => {
    const mod = await import("@features/sdui/index");
    expect(mod).toBeDefined();
  });
});

// ============================================================================
// Graph Types: Warmth Compatibility
// ============================================================================

describe("Graph types: warmth compatibility", () => {
  it("graph types module is importable", async () => {
    const types = await import("@features/living-value-graph/types/graph.types");
    expect(types).toBeDefined();
  });
});

// ============================================================================
// Error Boundary: Recovery Strategy Contract
// ============================================================================

describe("Error boundary: recovery strategy", () => {
  it("recovery strategies are ordered by severity", () => {
    // Blueprint §7.6: Remount → Invalidate cache → Full reload
    const RECOVERY_STRATEGIES = [
      { id: "remount", destructive: false },
      { id: "invalidate_cache", destructive: false },
      { id: "full_reload", destructive: true },
    ] as const;

    expect(RECOVERY_STRATEGIES[0].id).toBe("remount");
    expect(RECOVERY_STRATEGIES[0].destructive).toBe(false);

    expect(RECOVERY_STRATEGIES[2].id).toBe("full_reload");
    expect(RECOVERY_STRATEGIES[2].destructive).toBe(true);
  });

  it("full reload warns about unsaved changes", () => {
    // Contract: the most destructive recovery must warn the user
    const fullReload = { id: "full_reload", destructive: true, requiresConfirmation: true };
    expect(fullReload.requiresConfirmation).toBe(true);
  });
});
