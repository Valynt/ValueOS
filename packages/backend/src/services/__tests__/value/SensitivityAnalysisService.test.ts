import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SensitivityAnalysisService,
  type AssumptionInput,
} from "../../value/SensitivityAnalysisService.js";

// Mock dependencies
vi.mock("../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock("../../../lib/supabase.js", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({ error: null }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                single: vi.fn().mockReturnValue({ data: null, error: null }),
              }),
            }),
          }),
        }),
      }),
    }),
  },
}));

describe("SensitivityAnalysisService", () => {
  let service: SensitivityAnalysisService;

  beforeEach(() => {
    service = new SensitivityAnalysisService();
  });

  describe("analyzeSensitivity", () => {
    it("should vary assumptions by ±20%", async () => {
      const assumptions: AssumptionInput[] = [
        { id: "asm-1", name: "Churn Rate", value: 0.05, unit: "percentage" },
      ];

      const baseAssumptions: Record<string, number> = { "asm-1": 0.05 };

      const modelFunction = (inputs: Record<string, number>) => ({
        roi: inputs["asm-1"] * 100,
        npv: inputs["asm-1"] * 1000000,
      });

      const result = await service.analyzeSensitivity(
        "case-123",
        "org-456",
        assumptions,
        baseAssumptions,
        modelFunction,
        "base"
      );

      // Check that all variations are present
      const variations = result.allResults.map((r) => r.variationPercent);
      expect(variations).toContain(-20);
      expect(variations).toContain(-10);
      expect(variations).toContain(10);
      expect(variations).toContain(20);
    });

    it("should identify top-3 highest-leverage assumptions", async () => {
      const assumptions: AssumptionInput[] = [
        { id: "asm-1", name: "High Impact", value: 100000, unit: "USD" },
        { id: "asm-2", name: "Medium Impact", value: 50000, unit: "USD" },
        { id: "asm-3", name: "Low Impact", value: 25000, unit: "USD" },
        { id: "asm-4", name: "Very Low Impact", value: 10000, unit: "USD" },
      ];

      const baseAssumptions: Record<string, number> = {
        "asm-1": 100000,
        "asm-2": 50000,
        "asm-3": 25000,
        "asm-4": 10000,
      };

      // Model where first assumption has highest impact
      const modelFunction = (inputs: Record<string, number>) => ({
        roi: Object.values(inputs).reduce((a, b) => a + b, 0) / 1000000,
        npv:
          inputs["asm-1"] * 5 +
          inputs["asm-2"] * 3 +
          inputs["asm-3"] * 1.5 +
          inputs["asm-4"] * 0.5,
      });

      const result = await service.analyzeSensitivity(
        "case-123",
        "org-456",
        assumptions,
        baseAssumptions,
        modelFunction,
        "base"
      );

      expect(result.topLeverageAssumptions).toHaveLength(3);
      expect(result.topLeverageAssumptions[0].assumptionId).toBe("asm-1");
    });

    it("should calculate leverage score correctly", async () => {
      const assumptions: AssumptionInput[] = [
        { id: "asm-1", name: "Test Assumption", value: 100000, unit: "USD" },
      ];

      const baseAssumptions: Record<string, number> = { "asm-1": 100000 };

      // Simple linear model: 1% change = $1000 NPV change
      const modelFunction = (inputs: Record<string, number>) => ({
        roi: 0.1,
        npv: inputs["asm-1"] * 0.1,
      });

      const result = await service.analyzeSensitivity(
        "case-123",
        "org-456",
        assumptions,
        baseAssumptions,
        modelFunction,
        "base"
      );

      // With 20% variation on $100,000 = $20,000 change
      // NPV change = $20,000 * 0.1 = $2,000
      // Leverage score = $2,000 / 20 = $100 per 1%
      const result20pct = result.allResults.find((r) => r.variationPercent === 20);
      expect(result20pct?.leverageScore).toBeGreaterThan(0);
    });

    it("should skip assumptions with zero value", async () => {
      const assumptions: AssumptionInput[] = [
        { id: "asm-1", name: "Zero Value", value: 0, unit: "USD" },
        { id: "asm-2", name: "Non-Zero", value: 100000, unit: "USD" },
      ];

      const baseAssumptions: Record<string, number> = {
        "asm-1": 0,
        "asm-2": 100000,
      };

      const modelFunction = (inputs: Record<string, number>) => ({
        roi: 0.1,
        npv: inputs["asm-2"] * 0.1,
      });

      const result = await service.analyzeSensitivity(
        "case-123",
        "org-456",
        assumptions,
        baseAssumptions,
        modelFunction,
        "base"
      );

      // Should only have results for asm-2
      expect(result.allResults.every((r) => r.assumptionId === "asm-2")).toBe(true);
    });

    it("should persist analysis to database", async () => {
      const assumptions: AssumptionInput[] = [
        { id: "asm-1", name: "Test", value: 100000, unit: "USD" },
      ];

      const baseAssumptions: Record<string, number> = { "asm-1": 100000 };

      const modelFunction = (inputs: Record<string, number>) => ({
        roi: 0.1,
        npv: inputs["asm-1"] * 0.1,
      });

      const result = await service.analyzeSensitivity(
        "case-123",
        "org-456",
        assumptions,
        baseAssumptions,
        modelFunction,
        "base"
      );

      expect(result.caseId).toBe("case-123");
      expect(result.organizationId).toBe("org-456");
      expect(result.scenarioType).toBe("base");
      expect(result.analyzedAt).toBeDefined();
    });
  });

  describe("generateSDUIComponent", () => {
    it("should generate tornado chart component data", () => {
      const analysis = {
        caseId: "case-123",
        organizationId: "org-456",
        scenarioType: "base" as const,
        topLeverageAssumptions: [
          {
            assumptionId: "asm-1",
            assumptionName: "Churn Rate",
            baseValue: 0.05,
            variationPercent: 20,
            newValue: 0.06,
            impactOnRoi: 0.02,
            impactOnNpv: 50000,
            leverageScore: 2500,
          },
        ],
        allResults: [],
        analyzedAt: new Date().toISOString(),
      };

      const component = service.generateSDUIComponent(analysis) as {
        type: string;
        component: string;
        props: { title: string; assumptions: Array<Record<string, unknown>> };
      };

      expect(component.type).toBe("component");
      expect(component.component).toBe("SensitivityTornado");
      expect(component.props!.title).toContain("Base Scenario");
      expect(component.props!.assumptions).toHaveLength(1);
    });
  });

  describe("createSimpleModel", () => {
    it("should create a working model function", () => {
      const model = SensitivityAnalysisService.createSimpleModel(100000, 0.1);

      const result = model({ a: 50000, b: 50000 });

      expect(result.roi).toBeGreaterThanOrEqual(0);
      expect(result.npv).toBeDefined();
    });
  });
});
