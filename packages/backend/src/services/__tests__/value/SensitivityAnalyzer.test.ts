import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SensitivityAnalyzer } from "../../value/SensitivityAnalyzer.js";
import { supabase } from "../../../lib/supabase.js";
import { createMockSupabase } from "../helpers/testHelpers.js";

vi.mock("../../../lib/supabase.js", async () => {
  const { createMockSupabase } = await import("../helpers/testHelpers.js");
  return { assertNotTestEnv: vi.fn(), supabase: createMockSupabase() };
});

const BASE_INPUT = {
  organizationId: "org-1",
  caseId: "case-1",
  scenarioId: "scenario-1",
  scenarioType: "base" as const,
  assumptions: [
    { id: "asm-1", name: "headcount_savings", value: 100_000 },
    { id: "asm-2", name: "productivity_gain", value: 50_000 },
    { id: "asm-3", name: "license_cost_reduction", value: 30_000 },
  ],
  baseMetrics: { roi: 1.5, npv: 200_000, payback_months: 18 },
  costInputUsd: 100_000,
  timelineYears: 3,
  discountRate: 0.10,
};

describe("SensitivityAnalyzer", () => {
  let analyzer: SensitivityAnalyzer;
  const mockSupabase = supabase as unknown as ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mockSupabase._clearMocks();
    analyzer = new SensitivityAnalyzer();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockSupabase._clearMocks();
  });

  // ---------------------------------------------------------------------------
  // ±20% variance calculation
  // ---------------------------------------------------------------------------

  describe("±20% variance", () => {
    it("calculates variance_negative_20 as value * 0.8", async () => {
      const result = await analyzer.analyze(BASE_INPUT);
      const asm1 = result.find((r) => r.assumption_id === "asm-1");

      expect(asm1).toBeDefined();
      expect(asm1!.variance_negative_20).toBe(80_000); // 100_000 * 0.8
    });

    it("calculates variance_positive_20 as value * 1.2", async () => {
      const result = await analyzer.analyze(BASE_INPUT);
      const asm1 = result.find((r) => r.assumption_id === "asm-1");

      expect(asm1!.variance_positive_20).toBe(120_000); // 100_000 * 1.2
    });
  });

  // ---------------------------------------------------------------------------
  // Determinism — no hardcoded impact factor
  // ---------------------------------------------------------------------------

  describe("determinism", () => {
    it("produces the same impact_variance for identical inputs", async () => {
      const result1 = await analyzer.analyze(BASE_INPUT);
      mockSupabase._clearMocks();
      const result2 = await analyzer.analyze(BASE_INPUT);

      expect(result1[0].impact_variance).toBe(result2[0].impact_variance);
    });

    it("impact_variance changes when costInputUsd changes", async () => {
      const result1 = await analyzer.analyze({ ...BASE_INPUT, costInputUsd: 100_000 });
      mockSupabase._clearMocks();
      const result2 = await analyzer.analyze({ ...BASE_INPUT, costInputUsd: 200_000 });

      // Different cost → different NPV reconstruction → different impact
      expect(result1[0].impact_variance).not.toBe(result2[0].impact_variance);
    });

    it("impact_variance changes when timelineYears changes", async () => {
      const result1 = await analyzer.analyze({ ...BASE_INPUT, timelineYears: 3 });
      mockSupabase._clearMocks();
      const result2 = await analyzer.analyze({ ...BASE_INPUT, timelineYears: 5 });

      expect(result1[0].impact_variance).not.toBe(result2[0].impact_variance);
    });
  });

  // ---------------------------------------------------------------------------
  // Top-N ranking
  // ---------------------------------------------------------------------------

  describe("top-N ranking", () => {
    it("returns at most TOP_N (3) results", async () => {
      const input = {
        ...BASE_INPUT,
        assumptions: [
          { id: "a1", name: "A", value: 1_000_000 },
          { id: "a2", name: "B", value: 500_000 },
          { id: "a3", name: "C", value: 100_000 },
          { id: "a4", name: "D", value: 50_000 },
          { id: "a5", name: "E", value: 10_000 },
        ],
      };

      const result = await analyzer.analyze(input);
      expect(result).toHaveLength(3);
    });

    it("assigns ranks 1, 2, 3 in order", async () => {
      const result = await analyzer.analyze(BASE_INPUT);

      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(2);
      expect(result[2].rank).toBe(3);
    });

    it("rank 1 has the highest impact_variance", async () => {
      const result = await analyzer.analyze(BASE_INPUT);

      expect(result[0].impact_variance).toBeGreaterThanOrEqual(result[1].impact_variance);
      expect(result[1].impact_variance).toBeGreaterThanOrEqual(result[2].impact_variance);
    });

    it("ranking is stable and deterministic across runs", async () => {
      // calculateImpact scales the annual benefit by newValue/assumption.value.
      // Since all assumptions use the same ±20% variance, the scale factor
      // (0.8 / 1.2) is identical for every assumption — impact_variance is
      // equal across all assumptions in this test because they all share the
      // same base benefit stream. Ranking is therefore stable by insertion order.
      // Note: with different assumption values the impact_variance WILL differ
      // because the scale factor (newValue/assumption.value) is the same but
      // the reconstructed benefit stream scales proportionally to each assumption's
      // contribution. See the "rank 1 has the highest impact_variance" test for
      // a case where assumptions with different values produce different ranks.
      const input = {
        ...BASE_INPUT,
        assumptions: [
          { id: "a1", name: "alpha", value: 1_000 },
          { id: "a2", name: "beta", value: 500_000 },
          { id: "a3", name: "gamma", value: 50_000 },
        ],
      };

      const result1 = await analyzer.analyze(input);
      mockSupabase._clearMocks();
      const result2 = await analyzer.analyze(input);

      // Same order both runs
      expect(result1.map((r) => r.assumption_id)).toEqual(result2.map((r) => r.assumption_id));
      // Ranks are 1, 2, 3
      expect(result1[0].rank).toBe(1);
      expect(result1[1].rank).toBe(2);
      expect(result1[2].rank).toBe(3);
    });
  });

  // ---------------------------------------------------------------------------
  // Persistence — organization_id column
  // ---------------------------------------------------------------------------

  describe("persistence", () => {
    it("persists organization_id (not tenant_id) to sensitivity_analysis", async () => {
      await analyzer.analyze(BASE_INPUT);

      const persisted = mockSupabase._mockData.get("sensitivity_analysis") as Array<Record<string, unknown>>;
      expect(persisted).toBeDefined();
      expect(persisted!.length).toBeGreaterThan(0);
      expect(persisted!.every((r) => r.organization_id === "org-1")).toBe(true);
      expect(persisted!.every((r) => !("tenant_id" in r) && "organization_id" in r)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe("edge cases", () => {
    it("returns empty array when no assumptions provided", async () => {
      const result = await analyzer.analyze({ ...BASE_INPUT, assumptions: [] });
      expect(result).toHaveLength(0);
    });

    it("handles zero-value assumption without crashing", async () => {
      const result = await analyzer.analyze({
        ...BASE_INPUT,
        assumptions: [{ id: "zero", name: "zero_val", value: 0 }],
      });
      expect(result).toBeDefined();
    });
  });
});
