import { describe, it, expect, vi, beforeEach } from "vitest";
import { FinancialModelingAgent } from "../../lib/agent-fabric/agents/FinancialModelingAgent.js";

// Mock dependencies
vi.mock("../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock("../../lib/supabase.js", () => ({
  assertNotTestEnv: vi.fn(),
  createServerSupabaseClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({ error: null }),
    }),
  }),
  // Named export consumed by modules that import supabase directly
  supabase: { from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), insert: vi.fn().mockResolvedValue({ data: null, error: null }), update: vi.fn().mockReturnThis(), delete: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) })) },
}));

vi.mock("@valueos/memory/provenance", () => ({
  ProvenanceTracker: vi.fn().mockImplementation(() => ({
    record: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("../../../repositories/FinancialModelSnapshotRepository.js", () => ({
  FinancialModelSnapshotRepository: vi.fn().mockImplementation(() => ({
    createSnapshot: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("../../services/workflows/SagaAdapters.js", () => ({
  SupabaseProvenanceStore: vi.fn().mockImplementation(() => ({})),
}));

describe("FinancialModelingAgent - Scenario Builder", () => {
  let agent: FinancialModelingAgent;

  beforeEach(() => {
    agent = new FinancialModelingAgent();
  });

  describe("buildScenarios", () => {
    it("should build three scenarios (conservative, base, upside)", () => {
      const projections = [
        {
          hypothesis_id: "hyp-1",
          hypothesis_description: "Reduce churn",
          category: "cost_reduction" as const,
          assumptions: ["Lower churn by 5%"],
          cash_flows: [-100000, 50000, 60000, 70000],
          currency: "USD",
          period_type: "annual" as const,
          discount_rate: 0.1,
          total_investment: 100000,
          total_benefit: 180000,
          confidence: 0.8,
          risk_factors: [],
          data_sources: ["crm"],
        },
      ];

      const scenarios = (agent as unknown as { buildScenarios: typeof buildScenarios }).buildScenarios(
        projections,
        {}
      );

      expect(scenarios).toHaveLength(3);
      expect(scenarios.map((s) => s.scenarioType)).toContain("conservative");
      expect(scenarios.map((s) => s.scenarioType)).toContain("base");
      expect(scenarios.map((s) => s.scenarioType)).toContain("upside");
    });

    it("should use p25/p50/p75 percentiles for scenarios", () => {
      const projections = [
        {
          hypothesis_id: "hyp-1",
          hypothesis_description: "Test metric",
          category: "revenue_growth" as const,
          assumptions: [],
          cash_flows: [-100000, 100000],
          currency: "USD",
          period_type: "annual" as const,
          discount_rate: 0.1,
          total_investment: 100000,
          total_benefit: 100000,
          confidence: 0.8,
          risk_factors: [],
          data_sources: [],
        },
      ];

      const benchmarks = [
        { metric: "test", p25: 50000, p50: 100000, p75: 150000 },
      ];

      const scenarios = (agent as unknown as { buildScenarios: typeof buildScenarios }).buildScenarios(
        projections,
        { benchmarks }
      );

      const conservative = scenarios.find((s) => s.scenarioType === "conservative");
      const base = scenarios.find((s) => s.scenarioType === "base");
      const upside = scenarios.find((s) => s.scenarioType === "upside");

      expect(conservative?.assumptions["hyp-1"]).toBe(50000);
      expect(base?.assumptions["hyp-1"]).toBe(100000);
      expect(upside?.assumptions["hyp-1"]).toBe(150000);
    });

    it("should compute EVF decomposition for each scenario", () => {
      const projections = [
        {
          hypothesis_id: "hyp-1",
          hypothesis_description: "Revenue growth",
          category: "revenue_growth" as const,
          assumptions: [],
          cash_flows: [-100000, 200000],
          currency: "USD",
          period_type: "annual" as const,
          discount_rate: 0.1,
          total_investment: 100000,
          total_benefit: 200000,
          confidence: 0.8,
          risk_factors: [],
          data_sources: [],
        },
        {
          hypothesis_id: "hyp-2",
          hypothesis_description: "Cost reduction",
          category: "cost_reduction" as const,
          assumptions: [],
          cash_flows: [-50000, 100000],
          currency: "USD",
          period_type: "annual" as const,
          discount_rate: 0.1,
          total_investment: 50000,
          total_benefit: 100000,
          confidence: 0.8,
          risk_factors: [],
          data_sources: [],
        },
      ];

      const scenarios = (agent as unknown as { buildScenarios: typeof buildScenarios }).buildScenarios(
        projections,
        {}
      );

      scenarios.forEach((scenario) => {
        expect(scenario.evfDecomposition.revenueUplift).toBeGreaterThanOrEqual(0);
        expect(scenario.evfDecomposition.costReduction).toBeGreaterThanOrEqual(0);
        expect(scenario.evfDecomposition.riskMitigation).toBeGreaterThanOrEqual(0);
        expect(scenario.evfDecomposition.efficiencyGain).toBeGreaterThanOrEqual(0);
      });
    });

    it("should apply conservative multipliers to EVF components", () => {
      const projections = [
        {
          hypothesis_id: "hyp-1",
          hypothesis_description: "Revenue",
          category: "revenue_growth" as const,
          assumptions: [],
          cash_flows: [-100000, 200000],
          currency: "USD",
          period_type: "annual" as const,
          discount_rate: 0.1,
          total_investment: 100000,
          total_benefit: 200000,
          confidence: 0.8,
          risk_factors: [],
          data_sources: [],
        },
      ];

      const scenarios = (agent as unknown as { buildScenarios: typeof buildScenarios }).buildScenarios(
        projections,
        {}
      );

      const base = scenarios.find((s) => s.scenarioType === "base")!;
      const conservative = scenarios.find((s) => s.scenarioType === "conservative")!;
      const upside = scenarios.find((s) => s.scenarioType === "upside")!;

      // Conservative should be lower than base
      expect(conservative.evfDecomposition.revenueUplift).toBeLessThan(
        base.evfDecomposition.revenueUplift
      );

      // Upside should be higher than base
      expect(upside.evfDecomposition.revenueUplift).toBeGreaterThan(
        base.evfDecomposition.revenueUplift
      );
    });
  });

  describe("computeScenarioFinancials", () => {
    it("should compute ROI, NPV, payback for each scenario", () => {
      const scenarios = [
        {
          scenarioType: "base" as const,
          assumptions: { "hyp-1": 100000 },
          evfDecomposition: {
            revenueUplift: 50000,
            costReduction: 30000,
            riskMitigation: 10000,
            efficiencyGain: 10000,
          },
        },
      ];

      const projections = [
        {
          hypothesis_id: "hyp-1",
          hypothesis_description: "Test",
          category: "revenue_growth" as const,
          assumptions: [],
          cash_flows: [-100000, 60000, 60000],
          currency: "USD",
          period_type: "annual" as const,
          discount_rate: 0.1,
          total_investment: 100000,
          total_benefit: 120000,
          confidence: 0.8,
          risk_factors: [],
          data_sources: [],
        },
      ];

      const results = (agent as unknown as { computeScenarioFinancials: typeof computeScenarioFinancials }).computeScenarioFinancials(
        scenarios,
        projections
      );

      expect(results).toHaveLength(1);
      expect(results[0].roi).toBeDefined();
      expect(results[0].npv).toBeDefined();
      expect(results[0].paybackMonths).toBeDefined();
      expect(results[0].evfDecomposition).toBeDefined();
    });
  });
});

// Type helpers for accessing private methods
type buildScenarios = (projections: unknown[], dealContext?: Record<string, unknown>) => Array<{
  scenarioType: "conservative" | "base" | "upside";
  assumptions: Record<string, number>;
  evfDecomposition: {
    revenueUplift: number;
    costReduction: number;
    riskMitigation: number;
    efficiencyGain: number;
  };
}>;

type computeScenarioFinancials = (
  scenarios: unknown[],
  projections: unknown[]
) => Array<{
  scenarioType: "conservative" | "base" | "upside";
  roi: number;
  npv: number;
  paybackMonths: number | null;
  evfDecomposition: {
    revenueUplift: number;
    costReduction: number;
    riskMitigation: number;
    efficiencyGain: number;
  };
}>;
