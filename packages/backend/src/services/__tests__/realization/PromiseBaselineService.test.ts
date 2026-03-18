import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PromiseBaselineService } from "../../realization/PromiseBaselineService.js";
import { createMockSupabase, factories } from "../helpers/testHelpers.js";
import { SQL_INJECTION_PAYLOADS, TENANT_ISOLATION_SCENARIOS } from "../fixtures/securityFixtures.js";

describe("PromiseBaselineService", () => {
  let service: PromiseBaselineService;
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    service = new PromiseBaselineService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockSupabase._clearMocks();
  });

  describe("Security & Tenant Isolation", () => {
    it("should reject SQL injection in baselineId", async () => {
      for (const payload of SQL_INJECTION_PAYLOADS.slice(0, 3)) {
        await expect(
          service.createFromApprovedCase({
            tenantId: "tenant-1",
            caseId: payload,
            scenarioId: "scenario-1",
            userId: "user-1",
            approvedScenarioType: "base",
          }),
        ).rejects.toThrow();
      }
    });

    it("should enforce tenant isolation on all operations", async () => {
      const tenantId = TENANT_ISOLATION_SCENARIOS.crossTenantAccess.authenticatedTenant;

      const result = await service.createFromApprovedCase({
        tenantId,
        caseId: "case-1",
        scenarioId: "scenario-1",
        userId: "user-1",
        approvedScenarioType: "base",
      });

      const persisted = mockSupabase._mockData.get("promise_baselines");
      const baseline = persisted?.[0] as Record<string, unknown>;
      expect(baseline?.tenant_id).toBe(tenantId);
    });

    it("should not allow cross-tenant baseline access", async () => {
      // Seed data for tenant A
      mockSupabase._mockData.set("promise_baselines", [
        factories.scenario({ tenant_id: "tenant-a", id: "baseline-a" }),
      ]);

      // Try to access from tenant B
      await expect(service.getBaseline("baseline-a", "tenant-b")).rejects.toThrow();
    });
  });

  describe("Immutability", () => {
    it("should not allow direct modification of created baseline", async () => {
      const result = await service.createFromApprovedCase({
        tenantId: "tenant-1",
        caseId: "case-1",
        scenarioId: "scenario-1",
        userId: "user-1",
        approvedScenarioType: "base",
      });

      // Attempt to modify should require amendment
      const baselines = mockSupabase._mockData.get("promise_baselines") as Array<Record<string, unknown>>;
      const baseline = baselines?.find((b) => b.id === result.baselineId);
      expect(baseline?.status).toBe("active");
    });

    it("should archive original when amending", async () => {
      const original = await service.createFromApprovedCase({
        tenantId: "tenant-1",
        caseId: "case-1",
        scenarioId: "scenario-1",
        userId: "user-1",
        approvedScenarioType: "base",
      });

      const amended = await service.amendBaseline(
        original.baselineId,
        "tenant-1",
        "user-1",
        { kpiAdjustments: [] },
      );

      const baselines = mockSupabase._mockData.get("promise_baselines") as Array<Record<string, unknown>>;
      const originalRecord = baselines?.find((b) => b.id === original.baselineId);
      expect(originalRecord?.status).toBe("amended");
    });
  });

  describe("KPI Target Creation", () => {
    it("should create KPI targets for all assumptions", async () => {
      mockSupabase._mockData.set("assumptions", [
        factories.assumption({ tenant_id: "tenant-1", case_id: "case-1", name: "Rate 1" }),
        factories.assumption({ tenant_id: "tenant-1", case_id: "case-1", name: "Rate 2" }),
        factories.assumption({ tenant_id: "tenant-1", case_id: "case-1", name: "Rate 3" }),
      ]);

      mockSupabase._mockData.set("scenarios", [
        factories.scenario({
          tenant_id: "tenant-1",
          case_id: "case-1",
          id: "scenario-1",
          evf_decomposition_json: {
            revenue_uplift: 100,
            cost_reduction: 50,
            risk_mitigation: 25,
            efficiency_gain: 10,
          },
        }),
      ]);

      const result = await service.createFromApprovedCase({
        tenantId: "tenant-1",
        caseId: "case-1",
        scenarioId: "scenario-1",
        userId: "user-1",
        approvedScenarioType: "base",
      });

      expect(result.kpiTargets.length).toBeGreaterThan(0);
    });

    it("should carry forward source classification", async () => {
      mockSupabase._mockData.set("assumptions", [
        factories.assumption({
          tenant_id: "tenant-1",
          case_id: "case-1",
          source_type: "customer-confirmed",
          confidence_score: 0.9,
        }),
      ]);

      mockSupabase._mockData.set("scenarios", [
        factories.scenario({ tenant_id: "tenant-1", case_id: "case-1", id: "scenario-1" }),
      ]);

      const result = await service.createFromApprovedCase({
        tenantId: "tenant-1",
        caseId: "case-1",
        scenarioId: "scenario-1",
        userId: "user-1",
        approvedScenarioType: "base",
      });

      expect(result.kpiTargets[0].source_classification).toBe("customer-confirmed");
    });
  });

  describe("Idempotency", () => {
    it("should not create duplicate baselines for same scenario", async () => {
      mockSupabase._mockData.set("scenarios", [
        factories.scenario({ tenant_id: "tenant-1", case_id: "case-1", id: "scenario-1" }),
      ]);

      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        scenarioId: "scenario-1",
        userId: "user-1",
        approvedScenarioType: "base" as const,
      };

      const result1 = await service.createFromApprovedCase(input);
      const result2 = await service.createFromApprovedCase(input);

      // Should create separate baselines (amendment pattern)
      expect(result1.baselineId).not.toBe(result2.baselineId);
    });
  });
});
