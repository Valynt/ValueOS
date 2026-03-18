import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ReadinessScorer } from "../../integrity/ReadinessScorer.js";
import { createMockSupabase, createMockLogger, factories } from "../helpers/testHelpers.js";
import { SQL_INJECTION_PAYLOADS, TENANT_ISOLATION_SCENARIOS } from "../fixtures/securityFixtures.js";

describe("ReadinessScorer", () => {
  let scorer: ReadinessScorer;
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    scorer = new ReadinessScorer();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockSupabase._clearMocks();
  });

  describe("Security & Tenant Isolation", () => {
    it("should reject SQL injection in caseId", async () => {
      for (const payload of SQL_INJECTION_PAYLOADS.slice(0, 3)) {
        await expect(scorer.calculateReadiness(payload, "tenant-1")).rejects.toThrow();
      }
    });

    it("should enforce tenant isolation", async () => {
      const tenantId = TENANT_ISOLATION_SCENARIOS.crossTenantAccess.authenticatedTenant;
      const caseId = "case-1";

      // Seed mock data with correct tenant
      mockSupabase._mockData.set("assumptions", [
        factories.assumption({ tenant_id: tenantId, case_id: caseId }),
      ]);

      const result = await scorer.calculateReadiness(caseId, tenantId);
      expect(result.tenant_id).toBe(tenantId);
    });

    it("should not leak data across tenants", async () => {
      const tenantA = "tenant-a";
      const tenantB = "tenant-b";
      const caseId = "case-1";

      // Seed data for both tenants
      mockSupabase._mockData.set("assumptions", [
        factories.assumption({ tenant_id: tenantA, case_id: caseId, confidence_score: 0.9 }),
        factories.assumption({ tenant_id: tenantB, case_id: caseId, confidence_score: 0.3 }),
      ]);

      const result = await scorer.calculateReadiness(caseId, tenantA);

      // Should only see tenant A's high confidence assumption
      expect(result.validation_rate).toBeGreaterThan(0.5);
    });
  });

  describe("Composite Score Calculation", () => {
    it("should mark presentation-ready when score >= 0.8", async () => {
      mockSupabase._mockData.set("assumptions", [
        factories.assumption({
          tenant_id: "tenant-1",
          case_id: "case-1",
          source_type: "customer-confirmed",
          confidence_score: 0.9,
          benchmark_reference_id: "bm-1",
        }),
      ]);

      const result = await scorer.calculateReadiness("case-1", "tenant-1");
      expect(result.is_presentation_ready).toBe(true);
    });

    it("should identify blockers when score < 0.6", async () => {
      mockSupabase._mockData.set("assumptions", [
        factories.assumption({
          tenant_id: "tenant-1",
          case_id: "case-1",
          source_type: "inferred",
          confidence_score: 0.3,
          benchmark_reference_id: null,
        }),
      ]);

      const result = await scorer.calculateReadiness("case-1", "tenant-1");
      expect(result.blockers.length).toBeGreaterThan(0);
    });

    it("should handle boundary case at exactly 0.8 validation rate", async () => {
      const assumptions = Array.from({ length: 10 }, (_, i) =>
        factories.assumption({
          tenant_id: "tenant-1",
          case_id: "case-1",
          source_type: i < 8 ? "customer-confirmed" : "inferred",
          confidence_score: 0.9,
        }),
      );

      mockSupabase._mockData.set("assumptions", assumptions);

      const result = await scorer.calculateReadiness("case-1", "tenant-1");
      expect(result.validation_rate).toBe(0.8);
      expect(result.is_presentation_ready).toBe(true);
    });
  });

  describe("Idempotency", () => {
    it("should return consistent scores for identical inputs", async () => {
      mockSupabase._mockData.set("assumptions", [
        factories.assumption({ tenant_id: "tenant-1", case_id: "case-1" }),
      ]);

      const result1 = await scorer.calculateReadiness("case-1", "tenant-1");
      const result2 = await scorer.calculateReadiness("case-1", "tenant-1");

      expect(result1.composite_score).toBe(result2.composite_score);
    });
  });

  describe("Benchmark Coverage", () => {
    it("should calculate benchmark coverage percentage correctly", async () => {
      const assumptions = [
        factories.assumption({ tenant_id: "tenant-1", case_id: "case-1", benchmark_reference_id: "bm-1" }),
        factories.assumption({ tenant_id: "tenant-1", case_id: "case-1", benchmark_reference_id: null }),
        factories.assumption({ tenant_id: "tenant-1", case_id: "case-1", benchmark_reference_id: "bm-2" }),
      ];

      mockSupabase._mockData.set("assumptions", assumptions);

      const result = await scorer.calculateReadiness("case-1", "tenant-1");
      expect(result.benchmark_coverage_pct).toBe((2 / 3) * 100);
    });
  });

  describe("Unsupported Assumption Detection", () => {
    it("should count unsupported assumptions correctly", async () => {
      const assumptions = [
        factories.assumption({
          tenant_id: "tenant-1",
          case_id: "case-1",
          source_type: "inferred",
          benchmark_reference_id: null,
          confidence_score: 0.3,
        }),
      ];

      mockSupabase._mockData.set("assumptions", assumptions);

      const result = await scorer.calculateReadiness("case-1", "tenant-1");
      expect(result.unsupported_assumption_count).toBe(1);
    });

    it("should not count supported assumptions as unsupported", async () => {
      const assumptions = [
        factories.assumption({
          tenant_id: "tenant-1",
          case_id: "case-1",
          source_type: "customer-confirmed",
          benchmark_reference_id: "bm-1",
          confidence_score: 0.9,
        }),
      ];

      mockSupabase._mockData.set("assumptions", assumptions);

      const result = await scorer.calculateReadiness("case-1", "tenant-1");
      expect(result.unsupported_assumption_count).toBe(0);
    });
  });
});
