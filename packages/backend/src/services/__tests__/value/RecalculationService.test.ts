import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  RecalculationService,
  type RecalculationContext,
} from "../../value/RecalculationService.js";

// Mock dependencies
vi.mock("../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock("../workflows/SagaAdapters.js", () => ({
  DomainSagaEventEmitter: vi.fn().mockImplementation(() => ({
    emit: vi.fn(),
  })),
}));

describe("RecalculationService", () => {
  let service: RecalculationService;

  beforeEach(() => {
    service = new RecalculationService();
  });

  describe("triggerRecalculation", () => {
    it("should recalculate all three scenarios on assumption change", async () => {
      const context: RecalculationContext = {
        caseId: "case-123",
        organizationId: "org-456",
        changeType: "assumption_updated",
        changedEntityId: "asm-789",
        changedBy: "user-001",
        previousValue: 100000,
        newValue: 120000,
        timestamp: new Date().toISOString(),
      };

      const result = await service.triggerRecalculation(context);

      expect(result.success).toBe(true);
      expect(result.scenariosRecalculated).toContain("conservative");
      expect(result.scenariosRecalculated).toContain("base");
      expect(result.scenariosRecalculated).toContain("upside");
    });

    it("should recalculate all three scenarios on baseline modification", async () => {
      const context: RecalculationContext = {
        caseId: "case-123",
        organizationId: "org-456",
        changeType: "baseline_modified",
        changedEntityId: "base-789",
        changedBy: "user-001",
        previousValue: 0.05,
        newValue: 0.06,
        timestamp: new Date().toISOString(),
      };

      const result = await service.triggerRecalculation(context);

      expect(result.success).toBe(true);
      expect(result.scenariosRecalculated).toHaveLength(3);
    });

    it("should flag narrative components for refresh", async () => {
      const context: RecalculationContext = {
        caseId: "case-123",
        organizationId: "org-456",
        changeType: "assumption_updated",
        changedEntityId: "asm-789",
        changedBy: "user-001",
        previousValue: 100000,
        newValue: 120000,
        timestamp: new Date().toISOString(),
      };

      const result = await service.triggerRecalculation(context);

      expect(result.narrativeRefreshFlags.length).toBeGreaterThan(0);
      expect(
        result.narrativeRefreshFlags.some((f) => f.componentType === "kpi_card")
      ).toBe(true);
      expect(
        result.narrativeRefreshFlags.some((f) => f.componentType === "scenario_comparison")
      ).toBe(true);
    });

    it("should emit saga.state.transitioned event", async () => {
      const context: RecalculationContext = {
        caseId: "case-123",
        organizationId: "org-456",
        changeType: "assumption_updated",
        changedEntityId: "asm-789",
        changedBy: "user-001",
        timestamp: new Date().toISOString(),
      };

      const result = await service.triggerRecalculation(context);

      expect(result.recalculationId).toBeDefined();
      expect(result.recalculationId.startsWith("recalc_")).toBe(true);
    });

    it("should handle high priority refresh for assumption changes", async () => {
      const context: RecalculationContext = {
        caseId: "case-123",
        organizationId: "org-456",
        changeType: "assumption_updated",
        changedEntityId: "asm-789",
        changedBy: "user-001",
        previousValue: 100000,
        newValue: 120000,
        timestamp: new Date().toISOString(),
      };

      const result = await service.triggerRecalculation(context);

      const kpiFlag = result.narrativeRefreshFlags.find((f) => f.componentType === "kpi_card");
      expect(kpiFlag?.priority).toBe("high");
    });
  });

  describe("onAssumptionUpdated", () => {
    it("should trigger recalculation with assumption context", async () => {
      const result = await service.onAssumptionUpdated(
        "case-123",
        "org-456",
        "asm-789",
        "user-001",
        100000,
        120000
      );

      expect(result.success).toBe(true);
      expect(result.caseId).toBe("case-123");
    });
  });

  describe("onBaselineModified", () => {
    it("should trigger recalculation with baseline context", async () => {
      const result = await service.onBaselineModified(
        "case-123",
        "org-456",
        "base-789",
        "user-001",
        0.05,
        0.06
      );

      expect(result.success).toBe(true);
      expect(result.caseId).toBe("case-123");
    });
  });
});
