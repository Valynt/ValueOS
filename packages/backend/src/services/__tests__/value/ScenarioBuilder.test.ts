import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ScenarioBuilder } from "../../value/ScenarioBuilder.js";
import { supabase } from "../../../lib/supabase.js";
import { createMockSupabase } from "../helpers/testHelpers.js";

vi.mock("../../../lib/supabase.js", async () => {
  const { createMockSupabase } = await import("../helpers/testHelpers.js");
  return { supabase: createMockSupabase() };
});

const BASE_HYPOTHESES = [
  {
    id: "hyp-1",
    value_driver: "Revenue Growth",
    estimated_impact_min: 100_000,
    estimated_impact_max: 200_000,
    confidence_score: 0.8,
  },
  {
    id: "hyp-2",
    value_driver: "Cost Reduction",
    estimated_impact_min: 50_000,
    estimated_impact_max: 100_000,
    confidence_score: 0.75,
  },
];

const BASE_ASSUMPTIONS = [
  { id: "asm-1", name: "headcount_savings", value: 50_000, source_type: "crm-derived" },
  { id: "asm-2", name: "productivity_gain", value: 30_000, source_type: "customer-confirmed" },
];

describe("ScenarioBuilder", () => {
  let builder: ScenarioBuilder;
  const mockSupabase = supabase as unknown as ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mockSupabase._clearMocks();
    builder = new ScenarioBuilder();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockSupabase._clearMocks();
  });

  // ---------------------------------------------------------------------------
  // Cost input resolution
  // ---------------------------------------------------------------------------

  describe("resolveFinancialInputs — cost precedence", () => {
    it("uses explicit estimatedCostUsd when provided", () => {
      const resolved = builder.resolveFinancialInputs({
        organizationId: "org-1",
        caseId: "case-1",
        acceptedHypotheses: [],
        assumptions: BASE_ASSUMPTIONS,
        estimatedCostUsd: 250_000,
      });

      expect(resolved.costUsd).toBe(250_000);
      expect(resolved.source).toBe("explicit");
    });

    it("falls back to implementation_cost assumption when no explicit cost", () => {
      const assumptions = [
        ...BASE_ASSUMPTIONS,
        { id: "asm-cost", name: "implementation_cost", value: 180_000, source_type: "customer-confirmed" },
      ];

      const resolved = builder.resolveFinancialInputs({
        organizationId: "org-1",
        caseId: "case-1",
        acceptedHypotheses: [],
        assumptions,
      });

      expect(resolved.costUsd).toBe(180_000);
      expect(resolved.source).toBe("assumptions_register");
    });

    it("throws when no cost is resolvable", () => {
      expect(() =>
        builder.resolveFinancialInputs({
          organizationId: "org-1",
          caseId: "case-1",
          acceptedHypotheses: [],
          assumptions: BASE_ASSUMPTIONS,
        }),
      ).toThrow(/no cost input provided/);
    });

    it("explicit cost wins over assumptions register", () => {
      const assumptions = [
        { id: "asm-cost", name: "implementation_cost", value: 999_999, source_type: "inferred" },
      ];

      const resolved = builder.resolveFinancialInputs({
        organizationId: "org-1",
        caseId: "case-1",
        acceptedHypotheses: [],
        assumptions,
        estimatedCostUsd: 100_000,
      });

      expect(resolved.costUsd).toBe(100_000);
      expect(resolved.source).toBe("explicit");
    });
  });

  // ---------------------------------------------------------------------------
  // Timeline resolution
  // ---------------------------------------------------------------------------

  describe("timeline — integer enforcement", () => {
    it("rounds fractional timelineYears to nearest integer", async () => {
      await builder.buildScenarios({
        organizationId: "org-1",
        caseId: "case-1",
        acceptedHypotheses: BASE_HYPOTHESES,
        assumptions: BASE_ASSUMPTIONS,
        estimatedCostUsd: 100_000,
        timelineYears: 2.7,
      });

      const persisted = mockSupabase._mockData.get("scenarios") as Array<Record<string, unknown>>;
      expect(persisted.every((s) => s.timeline_years === 3)).toBe(true);
    });

    it("clamps fractional assumption-register timeline to at least 1", async () => {
      await builder.buildScenarios({
        organizationId: "org-1",
        caseId: "case-1",
        acceptedHypotheses: BASE_HYPOTHESES,
        assumptions: [
          ...BASE_ASSUMPTIONS,
          { id: "a-tl", name: "timeline_years", value: 0.3, source_type: "crm-derived" },
        ],
        estimatedCostUsd: 100_000,
      });

      const persisted = mockSupabase._mockData.get("scenarios") as Array<Record<string, unknown>>;
      expect(persisted.every((s) => (s.timeline_years as number) >= 1)).toBe(true);
    });
  });

  describe("resolveFinancialInputs — timeline", () => {
    it("uses explicit timelineYears when provided", () => {
      const resolved = builder.resolveFinancialInputs({
        organizationId: "org-1",
        caseId: "case-1",
        acceptedHypotheses: [],
        assumptions: [],
        estimatedCostUsd: 100_000,
        timelineYears: 5,
      });

      expect(resolved.timelineYears).toBe(5);
    });

    it("falls back to timeline_years assumption", () => {
      const resolved = builder.resolveFinancialInputs({
        organizationId: "org-1",
        caseId: "case-1",
        acceptedHypotheses: [],
        assumptions: [
          { id: "asm-t", name: "timeline_years", value: 4, source_type: "customer-confirmed" },
        ],
        estimatedCostUsd: 100_000,
      });

      expect(resolved.timelineYears).toBe(4);
    });

    it("defaults to 3 years when not provided", () => {
      const resolved = builder.resolveFinancialInputs({
        organizationId: "org-1",
        caseId: "case-1",
        acceptedHypotheses: [],
        assumptions: [],
        estimatedCostUsd: 100_000,
      });

      expect(resolved.timelineYears).toBe(3);
    });
  });

  // ---------------------------------------------------------------------------
  // Economic kernel — cash flow series
  // ---------------------------------------------------------------------------

  describe("callEconomicKernel — cash flow series", () => {
    it("payback period is bounded by timelineYears", () => {
      const evf = { revenue_uplift: 200_000, cost_reduction: 0, risk_mitigation: 0, efficiency_gain: 0 };
      const resolved = { costUsd: 100_000, timelineYears: 5, discountRate: 0.10 };

      const metrics = builder.callEconomicKernel(evf, resolved, "base");

      expect(metrics.payback_months).not.toBeNull();
      expect(metrics.payback_months!).toBeLessThanOrEqual(60);
    });

    it("longer timeline produces longer payback for same total value", () => {
      const evf = { revenue_uplift: 150_000, cost_reduction: 0, risk_mitigation: 0, efficiency_gain: 0 };
      const cost = 100_000;

      const metrics3yr = builder.callEconomicKernel(evf, { costUsd: cost, timelineYears: 3, discountRate: 0.10 }, "base");
      const metrics5yr = builder.callEconomicKernel(evf, { costUsd: cost, timelineYears: 5, discountRate: 0.10 }, "base");

      expect(metrics5yr.payback_months!).toBeGreaterThan(metrics3yr.payback_months!);
    });

    it("higher cost produces lower ROI and NPV", () => {
      const evf = { revenue_uplift: 300_000, cost_reduction: 0, risk_mitigation: 0, efficiency_gain: 0 };

      const metricsLowCost = builder.callEconomicKernel(
        evf, { costUsd: 50_000, timelineYears: 3, discountRate: 0.10 }, "base",
      );
      const metricsHighCost = builder.callEconomicKernel(
        evf, { costUsd: 200_000, timelineYears: 3, discountRate: 0.10 }, "base",
      );

      expect(metricsLowCost.roi!).toBeGreaterThan(metricsHighCost.roi!);
      expect(metricsLowCost.npv!).toBeGreaterThan(metricsHighCost.npv!);
    });
  });

  // ---------------------------------------------------------------------------
  // buildScenarios — full integration
  // ---------------------------------------------------------------------------

  describe("buildScenarios", () => {
    it("produces exactly three scenarios with correct types", async () => {
      const result = await builder.buildScenarios({
        organizationId: "org-1",
        caseId: "case-1",
        acceptedHypotheses: BASE_HYPOTHESES,
        assumptions: BASE_ASSUMPTIONS,
        estimatedCostUsd: 100_000,
      });

      expect(result.conservative.scenario_type).toBe("conservative");
      expect(result.base.scenario_type).toBe("base");
      expect(result.upside.scenario_type).toBe("upside");
    });

    it("persists organization_id (not tenant_id) on all scenarios", async () => {
      await builder.buildScenarios({
        organizationId: "org-abc",
        caseId: "case-1",
        acceptedHypotheses: BASE_HYPOTHESES,
        assumptions: BASE_ASSUMPTIONS,
        estimatedCostUsd: 100_000,
      });

      const persisted = mockSupabase._mockData.get("scenarios") as Array<Record<string, unknown>>;
      expect(persisted).toHaveLength(3);
      expect(persisted.every((s) => s.organization_id === "org-abc")).toBe(true);
      expect(persisted.every((s) => !("tenant_id" in s))).toBe(true);
    });

    it("records cost_input_usd, timeline_years, and investment_source on persisted scenarios", async () => {
      await builder.buildScenarios({
        organizationId: "org-1",
        caseId: "case-1",
        acceptedHypotheses: BASE_HYPOTHESES,
        assumptions: BASE_ASSUMPTIONS,
        estimatedCostUsd: 75_000,
        timelineYears: 4,
      });

      const persisted = mockSupabase._mockData.get("scenarios") as Array<Record<string, unknown>>;
      expect(persisted.every((s) => s.cost_input_usd === 75_000)).toBe(true);
      expect(persisted.every((s) => s.timeline_years === 4)).toBe(true);
      expect(persisted.every((s) => s.investment_source === "explicit")).toBe(true);
    });

    it("records investment_source = assumptions_register when cost comes from assumptions", async () => {
      const assumptions = [
        ...BASE_ASSUMPTIONS,
        { id: "asm-cost", name: "implementation_cost", value: 60_000, source_type: "customer-confirmed" },
      ];

      await builder.buildScenarios({
        organizationId: "org-1",
        caseId: "case-1",
        acceptedHypotheses: BASE_HYPOTHESES,
        assumptions,
      });

      const persisted = mockSupabase._mockData.get("scenarios") as Array<Record<string, unknown>>;
      expect(persisted.every((s) => s.investment_source === "assumptions_register")).toBe(true);
    });

    it("upside NPV > base NPV > conservative NPV for positive value", async () => {
      const result = await builder.buildScenarios({
        organizationId: "org-1",
        caseId: "case-1",
        acceptedHypotheses: BASE_HYPOTHESES,
        assumptions: BASE_ASSUMPTIONS,
        estimatedCostUsd: 100_000,
      });

      expect(result.upside.npv!).toBeGreaterThan(result.base.npv!);
      expect(result.base.npv!).toBeGreaterThan(result.conservative.npv!);
    });

    it("throws when no cost is resolvable — does not silently use 30%", async () => {
      await expect(
        builder.buildScenarios({
          organizationId: "org-1",
          caseId: "case-1",
          acceptedHypotheses: BASE_HYPOTHESES,
          assumptions: BASE_ASSUMPTIONS,
        }),
      ).rejects.toThrow(/no cost input provided/);
    });

    it("stores name and description in assumptions_snapshot_json", async () => {
      await builder.buildScenarios({
        organizationId: "org-1",
        caseId: "case-1",
        name: "My Scenario",
        description: "A test description",
        acceptedHypotheses: BASE_HYPOTHESES,
        assumptions: BASE_ASSUMPTIONS,
        estimatedCostUsd: 100_000,
      });

      const persisted = mockSupabase._mockData.get("scenarios") as Array<Record<string, unknown>>;
      const snapshots = persisted.map((s) => s.assumptions_snapshot_json as Record<string, unknown>);
      const metas = snapshots.map((snap) => snap.__meta as { name: string; description: string });
      expect(metas.every((m) => m.name === "My Scenario")).toBe(true);
      expect(metas.every((m) => m.description === "A test description")).toBe(true);
    });

    it("is deterministic — same inputs produce same outputs", async () => {
      const input = {
        organizationId: "org-1",
        caseId: "case-1",
        acceptedHypotheses: BASE_HYPOTHESES,
        assumptions: BASE_ASSUMPTIONS,
        estimatedCostUsd: 100_000,
        timelineYears: 3,
        discountRate: 0.10,
      };

      const result1 = await builder.buildScenarios(input);
      mockSupabase._clearMocks();
      const result2 = await builder.buildScenarios(input);

      expect(result1.base.roi).toBe(result2.base.roi);
      expect(result1.base.npv).toBe(result2.base.npv);
      expect(result1.conservative.payback_months).toBe(result2.conservative.payback_months);
    });
  });
});
