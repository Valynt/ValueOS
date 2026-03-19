import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SensitivityAnalyzer } from "../../value/SensitivityAnalyzer.js";
import { supabase } from "../../../lib/supabase.js";
import { createMockSupabase } from "../helpers/testHelpers.js";
import { SQL_INJECTION_PAYLOADS, BOUNDARY_VALUES } from "../fixtures/securityFixtures.js";

vi.mock("../../../lib/supabase.js", async () => {
  const { createMockSupabase } = await import("../helpers/testHelpers.js");
  return { supabase: createMockSupabase() };
});

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

  describe("Security & Tenant Isolation", () => {
    it("should safely handle suspicious scenarioId inputs", async () => {
      for (const payload of SQL_INJECTION_PAYLOADS.slice(0, 3)) {
        await expect(
          analyzer.analyze({
            tenantId: "tenant-1",
            caseId: "case-1",
            scenarioId: payload,
            scenarioType: "base",
            assumptions: [],
            baseMetrics: { roi: 150, npv: 500000, payback_months: 12 },
          }),
        ).resolves.toEqual([]);
      }
    });

    it("should enforce tenant isolation on sensitivity results", async () => {
      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        scenarioId: "scenario-1",
        scenarioType: "base" as const,
        assumptions: [{ id: "asm-1", name: "Rate", value: 100 }],
        baseMetrics: { roi: 150, npv: 500000, payback_months: 12 },
      };

      await analyzer.analyze(input);

      const persisted = mockSupabase._mockData.get("sensitivity_analysis");
      const result = persisted?.[0] as Record<string, unknown>;
      expect(result?.tenant_id).toBe("tenant-1");
    });
  });

  describe("±20% Variance Analysis", () => {
    it("should calculate variance at exactly ±20%", async () => {
      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        scenarioId: "scenario-1",
        scenarioType: "base" as const,
        assumptions: [{ id: "asm-1", name: "Rate", value: 100 }],
        baseMetrics: { roi: 150, npv: 500000, payback_months: 12 },
      };

      const result = await analyzer.analyze(input);
      const sensitivity = result[0];

      expect(sensitivity.variance_negative_20).toBe(80); // 100 * 0.8
      expect(sensitivity.variance_positive_20).toBe(120); // 100 * 1.2
    });

    it("should calculate impact variance correctly", async () => {
      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        scenarioId: "scenario-1",
        scenarioType: "base" as const,
        assumptions: [{ id: "asm-1", name: "Rate", value: 100 }],
        baseMetrics: { roi: 150, npv: 500000, payback_months: 12 },
      };

      const result = await analyzer.analyze(input);

      expect(result[0].impact_variance).toBeGreaterThan(0);
    });
  });

  describe("Top 3 Assumptions", () => {
    it("should return exactly top 3 highest impact assumptions", async () => {
      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        scenarioId: "scenario-1",
        scenarioType: "base" as const,
        assumptions: [
          { id: "asm-1", name: "High Impact", value: 1000 },
          { id: "asm-2", name: "Medium Impact", value: 500 },
          { id: "asm-3", name: "Low Impact", value: 100 },
          { id: "asm-4", name: "Very Low", value: 10 },
          { id: "asm-5", name: "Minimal", value: 1 },
        ],
        baseMetrics: { roi: 150, npv: 500000, payback_months: 12 },
      };

      const result = await analyzer.analyze(input);

      expect(result).toHaveLength(3);
      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(2);
      expect(result[2].rank).toBe(3);
    });

    it("should order by impact variance descending", async () => {
      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        scenarioId: "scenario-1",
        scenarioType: "base" as const,
        assumptions: [
          { id: "asm-1", name: "A", value: 100 },
          { id: "asm-2", name: "B", value: 200 },
          { id: "asm-3", name: "C", value: 50 },
        ],
        baseMetrics: { roi: 150, npv: 500000, payback_months: 12 },
      };

      const result = await analyzer.analyze(input);

      expect(result[0].assumption_name).toBe("A");
      expect(result[1].assumption_name).toBe("B");
      expect(result[2].assumption_name).toBe("C");
    });
  });

  describe("Recalculation Triggers", () => {
    it("should emit recalculation event when assumptions change", async () => {
      mockSupabase._mockData.set("scenarios", [
        { id: "scenario-1", tenant_id: "tenant-1", case_id: "case-1", scenario_type: "base" },
      ]);

      await analyzer.triggerRecalculation("tenant-1", "case-1", ["asm-1"]);

      const events = mockSupabase._mockData.get("state_events");
      expect(events?.length).toBeGreaterThan(0);
    });

    it("should flag narrative components for refresh on assumption change", async () => {
      mockSupabase._mockData.set("scenarios", [
        { id: "scenario-1", tenant_id: "tenant-1", case_id: "case-1", scenario_type: "base" },
      ]);
      mockSupabase._mockData.set("case_artifacts", [
        { id: "art-1", tenant_id: "tenant-1", case_id: "case-1", status: "final" },
      ]);

      await analyzer.triggerRecalculation("tenant-1", "case-1", ["asm-1"]);

      const artifacts = mockSupabase._mockData.get("case_artifacts") as Array<Record<string, unknown>>;
      expect(artifacts?.[0]?.status).toBe("draft");
    });
  });

  describe("Boundary Values", () => {
    it("should handle extreme assumption values", async () => {
      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        scenarioId: "scenario-1",
        scenarioType: "base" as const,
        assumptions: [{ id: "asm-1", name: "Extreme", value: BOUNDARY_VALUES.numbers.maxInt }],
        baseMetrics: { roi: 150, npv: 500000, payback_months: 12 },
      };

      const result = await analyzer.analyze(input);
      expect(result).toBeDefined();
    });

    it("should handle zero assumption values", async () => {
      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        scenarioId: "scenario-1",
        scenarioType: "base" as const,
        assumptions: [{ id: "asm-1", name: "Zero", value: 0 }],
        baseMetrics: { roi: 150, npv: 500000, payback_months: 12 },
      };

      const result = await analyzer.analyze(input);
      expect(result).toBeDefined();
    });
  });
});
