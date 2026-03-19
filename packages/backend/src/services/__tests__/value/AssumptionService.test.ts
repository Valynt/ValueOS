import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AssumptionService,
  type AssumptionCreateInput,
} from "../../value/AssumptionService.js";

// Mock dependencies
vi.mock("../../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../../../lib/supabase.js", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockImplementation((payload: Record<string, unknown>) => ({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockReturnValue({
            data: payload,
            error: null,
          }),
        }),
      })),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation((column: string) => {
          if (column === "id") {
            return {
              single: vi.fn().mockReturnValue({
                data: {
                  id: "asm-test-123",
                  organization_id: "org-123",
                  case_id: "case-456",
                  name: "Test Assumption",
                  value: 100000,
                  unit: "USD",
                  source_type: "customer-confirmed",
                  confidence_score: 0.9,
                  benchmark_reference_id: null,
                  original_value: null,
                  overridden_by_user_id: null,
                  is_unsupported: false,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
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
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ error: null }),
      }),
      update: vi.fn().mockImplementation((payload: Record<string, unknown>) => ({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue({
              data: {
                id: "asm-test-123",
                organization_id: "org-123",
                case_id: "case-456",
                name: "Test Assumption",
                unit: "USD",
                confidence_score: 0.9,
                benchmark_reference_id: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                ...payload,
              },
              error: null,
            }),
          }),
        }),
      })),
    }),
  },
}));

vi.mock("../integrity/VetoController.js", () => ({
  vetoController: {
    evaluate: vi.fn().mockReturnValue({
      vetoed: false,
      overrideUsed: false,
      reasonCodes: [],
      remediation: "",
      context: { justificationPresent: false },
    }),
  },
}));

vi.mock("../workflows/SagaAdapters.js", () => ({
  DomainSagaEventEmitter: vi.fn().mockImplementation(() => ({
    emit: vi.fn(),
  })),
}));

describe("AssumptionService", () => {
  let service: AssumptionService;

  beforeEach(() => {
    service = new AssumptionService();
  });

  describe("createAssumption", () => {
    it("should require source_type on creation", async () => {
      const input: AssumptionCreateInput = {
        organizationId: "org-123",
        caseId: "case-456",
        name: "Test Assumption",
        value: 100000,
        unit: "USD",
        sourceType: "",
        confidenceScore: 0.9,
        createdBy: "user-001",
      };

      await expect(service.createAssumption(input)).rejects.toThrow(
        "Assumption MUST have a source_type on creation"
      );
    });

    it("should flag unsupported assumptions without benchmark reference", async () => {
      const input: AssumptionCreateInput = {
        organizationId: "org-123",
        caseId: "case-456",
        name: "Inferred Assumption",
        value: 50000,
        unit: "USD",
        sourceType: "inferred",
        confidenceScore: 0.6,
        createdBy: "user-001",
      };

      const result = await service.createAssumption(input);

      expect(result.data.isUnsupported).toBe(true);
    });

    it("should not flag assumptions with benchmark reference", async () => {
      const input: AssumptionCreateInput = {
        organizationId: "org-123",
        caseId: "case-456",
        name: "Benchmarked Assumption",
        value: 50000,
        unit: "USD",
        sourceType: "inferred",
        confidenceScore: 0.6,
        benchmarkReferenceId: "bench-789",
        createdBy: "user-001",
      };

      const result = await service.createAssumption(input);

      expect(result.data.isUnsupported).toBe(false);
    });

    it("should log audit trail on creation", async () => {
      const input: AssumptionCreateInput = {
        organizationId: "org-123",
        caseId: "case-456",
        name: "Test Assumption",
        value: 100000,
        unit: "USD",
        sourceType: "customer-confirmed",
        confidenceScore: 0.9,
        createdBy: "user-001",
      };

      const result = await service.createAssumption(input);

      expect(result.assumptionId).toBeDefined();
      expect(result.data.sourceType).toBe("customer-confirmed");
    });
  });

  describe("overrideAssumption", () => {
    it("should change source to manually-overridden on override", async () => {
      const result = await service.overrideAssumption(
        "asm-test-123",
        120000,
        "Updated based on new data",
        "user-789"
      );

      expect(result.data.sourceType).toBe("manually-overridden");
    });

    it("should preserve original value in audit trail", async () => {
      const result = await service.overrideAssumption(
        "asm-test-123",
        120000,
        "Updated value",
        "user-789"
      );

      expect(result.data.originalValue).toBe(100000);
      expect(result.data.value).toBe(120000);
    });

    it("should record overridden_by_user_id", async () => {
      const result = await service.overrideAssumption(
        "asm-test-123",
        120000,
        "Updated",
        "user-789"
      );

      expect(result.data.overriddenByUserId).toBe("user-789");
    });
  });

  describe("CRUD operations", () => {
    it("should get assumptions by case", async () => {
      const result = await service.getAssumptionsByCase("org-123", "case-456");

      expect(Array.isArray(result)).toBe(true);
    });

    it("should delete assumption with audit log", async () => {
      const result = await service.deleteAssumption("asm-test-123", "user-001");

      expect(result.deleted).toBe(true);
    });
  });
});
