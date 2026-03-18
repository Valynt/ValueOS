import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ScenarioBuilder } from "../../value/ScenarioBuilder.js";
import { createMockSupabase, factories } from "../helpers/testHelpers.js";
import { SQL_INJECTION_PAYLOADS, BOUNDARY_VALUES } from "../fixtures/securityFixtures.js";

describe("ScenarioBuilder", () => {
  let builder: ScenarioBuilder;
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    builder = new ScenarioBuilder();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockSupabase._clearMocks();
  });

  describe("Security & Tenant Isolation", () => {
    it("should reject SQL injection in caseId", async () => {
      for (const payload of SQL_INJECTION_PAYLOADS.slice(0, 3)) {
        await expect(
          builder.buildScenarios({
            tenantId: "tenant-1",
            caseId: payload,
            acceptedHypotheses: [],
            assumptions: [],
          }),
        ).rejects.toThrow();
      }
    });

    it("should enforce tenant isolation on scenario persistence", async () => {
      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        acceptedHypotheses: [
          { id: "hyp-1", value_driver: "Cost", estimated_impact_min: 10, estimated_impact_max: 20, confidence_score: 0.8 },
        ],
        assumptions: [{ id: "asm-1", name: "Rate", value: 100, source_type: "confirmed" }],
      };

      await builder.buildScenarios(input);

      const persisted = mockSupabase._mockData.get("scenarios");
      expect(persisted?.every((s: unknown) => (s as Record<string, unknown>).tenant_id === "tenant-1")).toBe(true);
    });
  });

  describe("EVF Decomposition", () => {
    it("should calculate EVF correctly for conservative scenario", async () => {
      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        acceptedHypotheses: [
          { id: "hyp-1", value_driver: "Revenue Growth", estimated_impact_min: 100, estimated_impact_max: 200, confidence_score: 0.8 },
          { id: "hyp-2", value_driver: "Cost Reduction", estimated_impact_min: 50, estimated_impact_max: 100, confidence_score: 0.8 },
        ],
        assumptions: [],
      };

      const result = await builder.buildScenarios(input);
      expect(result.conservative.evf_decomposition_json.revenue_uplift).toBeGreaterThan(0);
      expect(result.conservative.evf_decomposition_json.cost_reduction).toBeGreaterThan(0);
    });

    it("should scale EVF correctly for upside scenario", async () => {
      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        acceptedHypotheses: [
          { id: "hyp-1", value_driver: "Revenue", estimated_impact_min: 100, estimated_impact_max: 200, confidence_score: 0.8 },
        ],
        assumptions: [],
      };

      const result = await builder.buildScenarios(input);
      expect(result.upside.evf_decomposition_json.revenue_uplift).toBeGreaterThan(
        result.base.evf_decomposition_json.revenue_uplift,
      );
    });
  });

  describe("Idempotency", () => {
    it("should produce deterministic results for identical inputs", async () => {
      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        acceptedHypotheses: [
          { id: "hyp-1", value_driver: "Test", estimated_impact_min: 100, estimated_impact_max: 200, confidence_score: 0.8 },
        ],
        assumptions: [{ id: "asm-1", name: "Rate", value: 100, source_type: "confirmed" }],
      };

      const result1 = await builder.buildScenarios(input);
      const result2 = await builder.buildScenarios(input);

      expect(result1.base.roi).toBe(result2.base.roi);
      expect(result1.conservative.npv).toBe(result2.conservative.npv);
    });
  });

  describe("Boundary Values", () => {
    it("should handle extreme hypothesis values", async () => {
      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        acceptedHypotheses: [
          {
            id: "hyp-1",
            value_driver: "Extreme",
            estimated_impact_min: BOUNDARY_VALUES.numbers.maxInt,
            estimated_impact_max: BOUNDARY_VALUES.numbers.maxInt,
            confidence_score: 0.8,
          },
        ],
        assumptions: [],
      };

      const result = await builder.buildScenarios(input);
      expect(result.base.roi).toBeDefined();
    });

    it("should handle zero assumptions", async () => {
      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        acceptedHypotheses: [],
        assumptions: [],
      };

      const result = await builder.buildScenarios(input);
      expect(result.base).toBeDefined();
    });
  });

  describe("Three Scenario Output", () => {
    it("should always produce exactly three scenarios", async () => {
      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        acceptedHypotheses: [{ id: "hyp-1", value_driver: "Test", estimated_impact_min: 100, estimated_impact_max: 200, confidence_score: 0.8 }],
        assumptions: [],
      };

      const result = await builder.buildScenarios(input);

      expect(result.conservative).toBeDefined();
      expect(result.base).toBeDefined();
      expect(result.upside).toBeDefined();
      expect(result.conservative.scenario_type).toBe("conservative");
      expect(result.base.scenario_type).toBe("base");
      expect(result.upside.scenario_type).toBe("upside");
    });

    it("should order scenarios by risk level", async () => {
      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        acceptedHypotheses: [{ id: "hyp-1", value_driver: "Test", estimated_impact_min: 100, estimated_impact_max: 200, confidence_score: 0.8 }],
        assumptions: [],
      };

      const result = await builder.buildScenarios(input);

      expect(result.conservative.roi).toBeLessThanOrEqual(result.base.roi || 0);
      expect(result.base.roi).toBeLessThanOrEqual(result.upside.roi || 0);
    });
  });
});
