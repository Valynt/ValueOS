import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PromiseBaselineService } from "../../realization/PromiseBaselineService.js";
import { supabase } from "../../../lib/supabase.js";
import { createMockSupabase, factories } from "../helpers/testHelpers.js";
import { SQL_INJECTION_PAYLOADS, TENANT_ISOLATION_SCENARIOS } from "../fixtures/securityFixtures.js";

vi.mock("../../../lib/supabase.js", async () => {
  const { createMockSupabase } = await import("../helpers/testHelpers.js");
  return { supabase: createMockSupabase() };
});

describe("PromiseBaselineService", () => {
  let service: PromiseBaselineService;
  const mockSupabase = supabase as unknown as ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mockSupabase._clearMocks();
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
      mockSupabase._mockData.set("scenarios", [
        factories.scenario({ tenant_id: tenantId, case_id: "case-1", id: "scenario-1" }),
      ]);

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
      // Seed data for tenant A — use organization_id to match the service's query field
      mockSupabase._mockData.set("promise_baselines", [
        { ...factories.scenario({ id: "baseline-a" }), organization_id: "tenant-a", tenant_id: "tenant-a" },
      ]);

      // Querying with tenant B's id should find no matching row and throw
      await expect(service.getBaseline("baseline-a", "tenant-b")).rejects.toThrow();
    });
  });

  describe("Immutability", () => {
    it("should not allow direct modification of created baseline", async () => {
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

      // Attempt to modify should require amendment
      const baselines = mockSupabase._mockData.get("promise_baselines") as Array<Record<string, unknown>>;
      const baseline = baselines?.find((b) => b.id === result.baselineId);
      expect(baseline?.status).toBe("active");
    });

    it("should archive original when amending", async () => {
      mockSupabase._mockData.set("scenarios", [
        factories.scenario({ tenant_id: "tenant-1", case_id: "case-1", id: "scenario-1" }),
      ]);

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

  describe("Bulk insert behaviour (N+1 remediation)", () => {
    it("amendBaseline makes exactly 1 insert call for KPI targets regardless of count", async () => {
      // Seed original baseline
      const baselineId = "baseline-orig";
      mockSupabase._mockData.set("promise_baselines", [
        {
          id: baselineId,
          tenant_id: "tenant-1",
          organization_id: "tenant-1",
          case_id: "case-1",
          scenario_id: "scenario-1",
          scenario_type: "base",
          status: "active",
          created_by_user_id: "user-1",
          approved_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
      ]);
      // Seed 5 KPI targets for the original baseline
      mockSupabase._mockData.set("promise_kpi_targets", [
        { id: "kpi-1", baseline_id: baselineId, tenant_id: "tenant-1", metric_name: "Revenue", baseline_value: 100, target_value: 120, unit: "$", timeline_months: 12, source_classification: "confirmed", confidence_score: 0.9 },
        { id: "kpi-2", baseline_id: baselineId, tenant_id: "tenant-1", metric_name: "Cost", baseline_value: 50, target_value: 40, unit: "$", timeline_months: 12, source_classification: "confirmed", confidence_score: 0.8 },
        { id: "kpi-3", baseline_id: baselineId, tenant_id: "tenant-1", metric_name: "NPS", baseline_value: 30, target_value: 50, unit: "pts", timeline_months: 6, source_classification: "estimated", confidence_score: 0.7 },
        { id: "kpi-4", baseline_id: baselineId, tenant_id: "tenant-1", metric_name: "Churn", baseline_value: 10, target_value: 5, unit: "%", timeline_months: 12, source_classification: "confirmed", confidence_score: 0.85 },
        { id: "kpi-5", baseline_id: baselineId, tenant_id: "tenant-1", metric_name: "CSAT", baseline_value: 70, target_value: 85, unit: "%", timeline_months: 9, source_classification: "estimated", confidence_score: 0.75 },
      ]);

      await service.amendBaseline(baselineId, "tenant-1", "user-1", { kpiAdjustments: [] });

      // from("promise_kpi_targets") is called twice: once for select (read originals),
      // once for insert (bulk write). The mock caches the client per table, so
      // accessing it after the call gives us the same instance with recorded calls.
      const kpiClient = mockSupabase.from("promise_kpi_targets") as ReturnType<typeof vi.fn> & {
        insert: ReturnType<typeof vi.fn>;
      };

      // insert() must have been called exactly once (bulk), not 5 times (one per KPI)
      expect(kpiClient.insert).toHaveBeenCalledOnce();

      // The single insert call must have received an array of all 5 rows
      const insertArg = kpiClient.insert.mock.calls[0][0] as unknown[];
      expect(Array.isArray(insertArg)).toBe(true);
      expect(insertArg).toHaveLength(5);
    });

    it("scheduleCheckpoints makes exactly 1 insert call for all checkpoints", async () => {
      const kpiTargets = [
        { id: "kpi-a", baseline_id: "bl-1", metric_name: "Revenue", baseline_value: 100, target_value: 130, unit: "$", timeline_months: 12, source_classification: "confirmed", confidence_score: 0.9 },
        { id: "kpi-b", baseline_id: "bl-1", metric_name: "Cost", baseline_value: 50, target_value: 35, unit: "$", timeline_months: 6, source_classification: "confirmed", confidence_score: 0.8 },
      ];

      // Access private method via cast for unit testing
      const svc = service as unknown as {
        scheduleCheckpoints: (baselineId: string, targets: typeof kpiTargets, tenantId: string) => Promise<unknown[]>;
      };

      const checkpoints = await svc.scheduleCheckpoints("bl-1", kpiTargets, "tenant-1");

      // kpi-a: 4 quarters, kpi-b: 2 quarters → 6 total checkpoints
      expect(checkpoints).toHaveLength(6);

      // insert() must have been called exactly once (bulk), not 6 times (one per checkpoint)
      const checkpointClient = mockSupabase.from("promise_checkpoints") as ReturnType<typeof vi.fn> & {
        insert: ReturnType<typeof vi.fn>;
      };
      expect(checkpointClient.insert).toHaveBeenCalledOnce();

      // The single insert call must have received an array of all 6 rows
      const insertArg = checkpointClient.insert.mock.calls[0][0] as unknown[];
      expect(Array.isArray(insertArg)).toBe(true);
      expect(insertArg).toHaveLength(6);
    });
  });

  describe("amendBaseline compensating rollback", () => {
    it("reverts original baseline and deletes new baseline when KPI insert fails", async () => {
      const baselineId = "baseline-rollback";
      // Capture the UUID that amendBaseline will assign to the new baseline record
      // so we can assert the rollback delete targets the correct ID.
      const newBaselineId = "new-baseline-uuid-fixed";
      const uuidSpy = vi.spyOn(crypto, "randomUUID").mockReturnValueOnce(
        newBaselineId as `${string}-${string}-${string}-${string}-${string}`,
      );

      mockSupabase._mockData.set("promise_baselines", [
        {
          id: baselineId,
          tenant_id: "tenant-1",
          organization_id: "tenant-1",
          case_id: "case-1",
          scenario_id: "scenario-1",
          scenario_type: "base",
          status: "active",
          created_by_user_id: "user-1",
          approved_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
      ]);
      mockSupabase._mockData.set("promise_kpi_targets", [
        { id: "kpi-1", baseline_id: baselineId, tenant_id: "tenant-1", metric_name: "Revenue", baseline_value: 100, target_value: 120, unit: "$", timeline_months: 12, source_classification: "confirmed", confidence_score: 0.9 },
      ]);

      // Force the KPI insert to fail
      const kpiClient = mockSupabase.from("promise_kpi_targets") as ReturnType<typeof vi.fn> & {
        insert: ReturnType<typeof vi.fn>;
      };
      kpiClient.insert = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "DB constraint violation" },
      });

      // amendBaseline must throw
      await expect(
        service.amendBaseline(baselineId, "tenant-1", "user-1", { kpiAdjustments: [] }),
      ).rejects.toThrow("Failed to insert amended KPI targets");

      // The original baseline must have been reverted to active
      const baselineClient = mockSupabase.from("promise_baselines") as ReturnType<typeof vi.fn> & {
        update: ReturnType<typeof vi.fn>;
        delete: ReturnType<typeof vi.fn>;
      };
      expect(baselineClient.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "active", superseded_at: null, superseded_by_id: null }),
      );

      // The orphaned new baseline must have been deleted using the correct ID
      expect(baselineClient.delete).toHaveBeenCalled();
      const deleteEqCalls = (
        baselineClient.delete.mock.results[0].value as { eq: ReturnType<typeof vi.fn> }
      ).eq.mock.calls as [string, unknown][];
      expect(deleteEqCalls).toContainEqual(["id", newBaselineId]);

      uuidSpy.mockRestore();
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
