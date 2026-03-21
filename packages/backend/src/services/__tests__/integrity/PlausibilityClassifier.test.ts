import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PlausibilityClassifier } from "../../integrity/PlausibilityClassifier.js";
import { createMockSupabase, factories } from "../helpers/testHelpers.js";
import { SQL_INJECTION_PAYLOADS } from "../fixtures/securityFixtures.js";

vi.mock("../../../lib/supabase.js");

describe("PlausibilityClassifier", () => {
  let classifier: PlausibilityClassifier;
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    classifier = new PlausibilityClassifier();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockSupabase._clearMocks();
  });

  describe("Security & Tenant Isolation", () => {
    it("should reject SQL injection in kpiName", async () => {
      for (const payload of SQL_INJECTION_PAYLOADS.slice(0, 3)) {
        await expect(
          classifier.assessPlausibility({
            tenantId: "tenant-1",
            caseId: "case-1",
            kpiName: payload,
            currentValue: 100,
            proposedValue: 150,
          }),
        ).rejects.toThrow();
      }
    });

    it("should enforce tenant isolation on benchmark queries", async () => {
      await classifier.assessPlausibility({
        tenantId: "tenant-1",
        caseId: "case-1",
        kpiName: "ROI",
        currentValue: 100,
        proposedValue: 150,
      });

      const persisted = mockSupabase._mockData.get("plausibility_classifications");
      const classification = persisted?.[0] as Record<string, unknown>;
      expect(classification?.tenant_id).toBe("tenant-1");
    });
  });

  describe("p25/p75/p90 Boundary Classification", () => {
    it("should classify within p25-p75 as plausible", async () => {
      mockSupabase._mockData.set("benchmarks", [
        factories.benchmark({
          tenant_id: "tenant-1",
          metric_name: "ROI",
          p25: 100,
          p50: 150,
          p75: 200,
          p90: 250,
        }),
      ]);

      const result = await classifier.assessPlausibility({
        tenantId: "tenant-1",
        caseId: "case-1",
        kpiName: "ROI",
        currentValue: 100,
        proposedValue: 160, // 60% improvement, within p25-p75
      });

      expect(result.classification).toBe("plausible");
    });

    it("should classify p75-p90 as aggressive", async () => {
      mockSupabase._mockData.set("benchmarks", [
        factories.benchmark({
          tenant_id: "tenant-1",
          metric_name: "ROI",
          p25: 100,
          p50: 150,
          p75: 200,
          p90: 250,
        }),
      ]);

      const result = await classifier.assessPlausibility({
        tenantId: "tenant-1",
        caseId: "case-1",
        kpiName: "ROI",
        currentValue: 100,
        proposedValue: 225, // 125% improvement, in p75-p90 range
      });

      expect(result.classification).toBe("aggressive");
    });

    it("should classify > p90 as unrealistic", async () => {
      mockSupabase._mockData.set("benchmarks", [
        factories.benchmark({
          tenant_id: "tenant-1",
          metric_name: "ROI",
          p25: 100,
          p50: 150,
          p75: 200,
          p90: 250,
        }),
      ]);

      const result = await classifier.assessPlausibility({
        tenantId: "tenant-1",
        caseId: "case-1",
        kpiName: "ROI",
        currentValue: 100,
        proposedValue: 300, // 200% improvement, > p90
      });

      expect(result.classification).toBe("unrealistic");
    });

    it("should handle boundary at exactly p90", async () => {
      mockSupabase._mockData.set("benchmarks", [
        factories.benchmark({
          tenant_id: "tenant-1",
          metric_name: "ROI",
          p25: 100,
          p75: 200,
          p90: 150,
        }),
      ]);

      const result = await classifier.assessPlausibility({
        tenantId: "tenant-1",
        caseId: "case-1",
        kpiName: "ROI",
        currentValue: 100,
        proposedValue: 150, // Exactly at p90
      });

      expect(result.classification).toBe("aggressive");
    });
  });

  describe("Batch Assessment", () => {
    it("should assess multiple KPIs in batch", async () => {
      mockSupabase._mockData.set("benchmarks", [
        factories.benchmark({ tenant_id: "tenant-1", metric_name: "ROI", p25: 100, p75: 200, p90: 250 }),
        factories.benchmark({ tenant_id: "tenant-1", metric_name: "NPV", p25: 50000, p75: 100000, p90: 150000 }),
      ]);

      const results = await classifier.assessBatch({
        tenantId: "tenant-1",
        caseId: "case-1",
        improvements: [
          { kpiName: "ROI", currentValue: 100, proposedValue: 150 },
          { kpiName: "NPV", currentValue: 50000, proposedValue: 75000 },
        ],
      });

      expect(results).toHaveLength(2);
      expect(results[0].classification).toBeDefined();
      expect(results[1].classification).toBeDefined();
    });
  });

  describe("Confidence Calculation", () => {
    it("should calculate higher confidence with larger sample size", async () => {
      mockSupabase._mockData.set("benchmarks", [
        factories.benchmark({
          tenant_id: "tenant-1",
          metric_name: "ROI",
          p25: 100,
          p75: 200,
          p90: 250,
          sample_size: 1000,
          date: new Date().toISOString(),
        }),
      ]);

      const result = await classifier.assessPlausibility({
        tenantId: "tenant-1",
        caseId: "case-1",
        kpiName: "ROI",
        currentValue: 100,
        proposedValue: 150,
      });

      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("should lower confidence for stale benchmarks", async () => {
      const oldDate = new Date();
      oldDate.setMonth(oldDate.getMonth() - 6);

      mockSupabase._mockData.set("benchmarks", [
        factories.benchmark({
          tenant_id: "tenant-1",
          metric_name: "ROI",
          p25: 100,
          p75: 200,
          p90: 250,
          sample_size: 1000,
          date: oldDate.toISOString(),
        }),
      ]);

      const result = await classifier.assessPlausibility({
        tenantId: "tenant-1",
        caseId: "case-1",
        kpiName: "ROI",
        currentValue: 100,
        proposedValue: 150,
      });

      expect(result.confidence).toBeLessThan(0.8);
    });
  });
});
