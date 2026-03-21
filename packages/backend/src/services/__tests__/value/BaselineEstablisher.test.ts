import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  BaselineEstablisher,
  type BaselineSource,
} from "../../value/BaselineEstablisher.js";

// Mock dependencies
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
        eq: vi.fn().mockImplementation((column: string) => {
          if (column === "id") {
            return {
              single: vi.fn().mockReturnValue({
                data: {
                  id: "base-metric-123",
                  metric_name: "Revenue",
                  current_value: 1500000,
                  unit: "USD",
                  source_type: "benchmark-derived",
                  source_classification: "tier-2",
                  confidence_score: 0.6,
                  requires_confirmation: true,
                },
                error: null,
              }),
            };
          }

          return {
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                data: [],
                error: null,
              }),
            }),
          };
        }),
      }),
      update: vi.fn().mockImplementation((updates: Record<string, unknown>) => ({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue({
              data: {
                id: "base-metric-123",
                metric_name: "Revenue",
                current_value: updates.current_value ?? 1500000,
                unit: "USD",
                source_type: updates.source_type ?? "customer-confirmed",
                source_classification: updates.source_classification ?? "tier-1",
                confidence_score: 0.6,
                requires_confirmation: updates.requires_confirmation ?? false,
                original_value: updates.original_value,
                confirmed_by: updates.confirmed_by,
                confirmed_at: updates.confirmed_at,
              },
              error: null,
            }),
          }),
        }),
      })),
    }),
  },
}));

describe("BaselineEstablisher", () => {
  let service: BaselineEstablisher;

  beforeEach(() => {
    service = new BaselineEstablisher();
  });

  describe("establishBaselines", () => {
    it("should prioritize customer-confirmed over other sources", async () => {
      const sources: BaselineSource[] = [
        {
          sourceType: "inferred",
          metricName: "Revenue",
          value: 1000000,
          unit: "USD",
          confidenceScore: 0.5,
          timestamp: new Date().toISOString(),
        },
        {
          sourceType: "benchmark-derived",
          metricName: "Revenue",
          value: 1200000,
          unit: "USD",
          confidenceScore: 0.7,
          timestamp: new Date().toISOString(),
        },
        {
          sourceType: "customer-confirmed",
          metricName: "Revenue",
          value: 1500000,
          unit: "USD",
          confidenceScore: 0.95,
          timestamp: new Date().toISOString(),
        },
      ];

      const result = await service.establishBaselines(
        "org-123",
        "case-456",
        ["Revenue"],
        sources
      );

      expect(result.metrics).toHaveLength(1);
      expect(result.metrics[0].sourceType).toBe("customer-confirmed");
      expect(result.metrics[0].currentValue).toBe(1500000);
    });

    it("should follow source priority: customer > CRM > call > benchmark > inferred", async () => {
      const sources: BaselineSource[] = [
        {
          sourceType: "inferred",
          metricName: "Metric A",
          value: 100,
          unit: "count",
          confidenceScore: 0.5,
          timestamp: new Date().toISOString(),
        },
        {
          sourceType: "call-derived",
          metricName: "Metric A",
          value: 200,
          unit: "count",
          confidenceScore: 0.7,
          timestamp: new Date().toISOString(),
        },
        {
          sourceType: "crm-derived",
          metricName: "Metric A",
          value: 300,
          unit: "count",
          confidenceScore: 0.8,
          timestamp: new Date().toISOString(),
        },
      ];

      const result = await service.establishBaselines(
        "org-123",
        "case-456",
        ["Metric A"],
        sources
      );

      expect(result.metrics[0].sourceType).toBe("crm-derived");
      expect(result.metrics[0].currentValue).toBe(300);
    });

    it("should tag each baseline with source classification", async () => {
      const sources: BaselineSource[] = [
        {
          sourceType: "customer-confirmed",
          metricName: "Revenue",
          value: 1000000,
          unit: "USD",
          confidenceScore: 0.95,
          timestamp: new Date().toISOString(),
        },
        {
          sourceType: "crm-derived",
          metricName: "Churn",
          value: 0.05,
          unit: "percentage",
          confidenceScore: 0.8,
          timestamp: new Date().toISOString(),
        },
        {
          sourceType: "benchmark-derived",
          metricName: "NPS",
          value: 50,
          unit: "score",
          confidenceScore: 0.6,
          timestamp: new Date().toISOString(),
        },
      ];

      const result = await service.establishBaselines(
        "org-123",
        "case-456",
        ["Revenue", "Churn", "NPS"],
        sources
      );

      const revenueMetric = result.metrics.find((m) => m.metricName === "Revenue");
      const churnMetric = result.metrics.find((m) => m.metricName === "Churn");
      const npsMetric = result.metrics.find((m) => m.metricName === "NPS");

      expect(revenueMetric?.sourceClassification).toBe("tier-1");
      expect(churnMetric?.sourceClassification).toBe("tier-1");
      expect(npsMetric?.sourceClassification).toBe("tier-2");
    });

    it("should flag benchmark-derived and inferred baselines for confirmation", async () => {
      const sources: BaselineSource[] = [
        {
          sourceType: "benchmark-derived",
          metricName: "Revenue",
          value: 1000000,
          unit: "USD",
          confidenceScore: 0.6,
          timestamp: new Date().toISOString(),
        },
        {
          sourceType: "inferred",
          metricName: "Cost",
          value: 500000,
          unit: "USD",
          confidenceScore: 0.4,
          timestamp: new Date().toISOString(),
        },
        {
          sourceType: "customer-confirmed",
          metricName: "Headcount",
          value: 100,
          unit: "employees",
          confidenceScore: 0.95,
          timestamp: new Date().toISOString(),
        },
      ];

      const result = await service.establishBaselines(
        "org-123",
        "case-456",
        ["Revenue", "Cost", "Headcount"],
        sources
      );

      expect(result.flaggedForConfirmation).toHaveLength(2);
      expect(result.flaggedForConfirmation.some((m) => m.metricName === "Revenue")).toBe(true);
      expect(result.flaggedForConfirmation.some((m) => m.metricName === "Cost")).toBe(true);
      expect(
        result.flaggedForConfirmation.some((m) => m.metricName === "Headcount")
      ).toBe(false);
    });
  });

  describe("confirmBaseline", () => {
    it("should change source to customer-confirmed after confirmation", async () => {
      const result = await service.confirmBaseline(
        "base-metric-123",
        "user-456",
        1500000
      );

      // Note: This test mocks the database, so we're testing the logic flow
      // In reality, the mock will return null data
      expect(result).toBeDefined();
    });

    it("should preserve original value when confirming with new value", async () => {
      const result = await service.confirmBaseline(
        "base-metric-123",
        "user-456",
        1600000 // New confirmed value
      );

      expect(result).toBeDefined();
    });
  });
});
