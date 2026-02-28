import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import type { GroundTruthIntegrationService } from "../../../services/GroundTruthIntegrationService";
import { KnowledgeFabricValidator } from "../KnowledgeFabricValidator";
import type { Memory, MemorySystem } from "../MemorySystem";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMemory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: "mem_1",
    agent_id: "target",
    workspace_id: "ws-1",
    content: "baseline: 45.5 currency, target: 32",
    memory_type: "semantic",
    importance: 0.7,
    created_at: "2024-01-01T00:00:00Z",
    accessed_at: "2024-01-01T00:00:00Z",
    access_count: 0,
    metadata: { organization_id: "org-1" },
    ...overrides,
  };
}

function makeMockMemorySystem(memories: Memory[] = []): MemorySystem {
  return {
    store: vi.fn().mockResolvedValue("mem_1"),
    retrieve: vi.fn().mockResolvedValue(memories),
    storeSemanticMemory: vi.fn().mockResolvedValue("mem_1"),
    clear: vi.fn().mockResolvedValue(0),
  } as unknown as MemorySystem;
}

function makeMockGroundTruth(
  overrides: Partial<GroundTruthIntegrationService> = {}
): GroundTruthIntegrationService {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    getBenchmark: vi.fn().mockResolvedValue({
      metricId: "ESO-KPI-001",
      name: "Test",
      value: 50,
      unit: "%",
      percentile: "p50",
      confidence: 0.9,
      source: "test",
    }),
    validateClaim: vi.fn().mockResolvedValue({
      valid: true,
      percentile: "p50",
      citation: "test source",
    }),
    getPersonaKPIs: vi.fn().mockResolvedValue({ kpis: [], financialDriver: "cost_reduction" }),
    getSimilarTraces: vi.fn().mockResolvedValue([]),
    enrichWithCitations: vi.fn().mockResolvedValue({
      benchmarks: {},
      validations: {},
      overallConfidence: 1,
    }),
    verifySourceId: vi.fn().mockResolvedValue(false),
    getStats: vi.fn().mockReturnValue({
      kpiCount: 0,
      vmrtCount: 0,
      industries: [],
      personas: [],
    }),
    ...overrides,
  } as unknown as GroundTruthIntegrationService;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("KnowledgeFabricValidator", () => {
  describe("validate — no contradictions", () => {
    it("passes when memory has no conflicting facts", async () => {
      const memorySystem = makeMockMemorySystem([]);
      const groundTruth = makeMockGroundTruth();
      const validator = new KnowledgeFabricValidator(memorySystem, groundTruth);

      const result = await validator.validate(
        "baseline: 45.5, target: 32",
        "org-1",
        "target"
      );

      expect(result.passed).toBe(true);
      expect(result.confidence).toBe(1);
      expect(result.contradictions).toHaveLength(0);
      expect(result.benchmarkMisalignments).toHaveLength(0);
      expect(result.method).toBe("knowledge_fabric");
    });
  });

  describe("validate — numeric contradictions", () => {
    it("detects when LLM response contradicts stored numeric values", async () => {
      const storedMemory = makeMemory({
        content: "baseline: 45.5 currency, target: 32",
        agent_id: "target",
      });
      const memorySystem = makeMockMemorySystem([storedMemory]);
      const groundTruth = makeMockGroundTruth();
      const validator = new KnowledgeFabricValidator(memorySystem, groundTruth);

      // Response claims baseline is 100 (>30% divergence from 45.5)
      const result = await validator.validate(
        "baseline: 100, target: 32",
        "org-1",
        "target"
      );

      expect(result.passed).toBe(false);
      expect(result.contradictions.length).toBeGreaterThanOrEqual(1);
      expect(result.contradictions[0]!.claim).toContain("baseline");
      expect(result.confidence).toBeLessThan(1);
    });

    it("passes when numeric values are within 30% tolerance", async () => {
      const storedMemory = makeMemory({
        content: "baseline: 45.5, target: 32",
        agent_id: "target",
      });
      const memorySystem = makeMockMemorySystem([storedMemory]);
      const groundTruth = makeMockGroundTruth();
      const validator = new KnowledgeFabricValidator(memorySystem, groundTruth);

      // 50 is within 30% of 45.5
      const result = await validator.validate(
        "baseline: 50, target: 32",
        "org-1",
        "target"
      );

      expect(result.passed).toBe(true);
      expect(result.contradictions).toHaveLength(0);
    });
  });

  describe("validate — negation contradictions", () => {
    it("detects when response negates a previously established fact", async () => {
      const storedMemory = makeMemory({
        content: "The KPI target is achievable based on current data.",
        agent_id: "target",
      });
      const memorySystem = makeMockMemorySystem([storedMemory]);
      const groundTruth = makeMockGroundTruth();
      const validator = new KnowledgeFabricValidator(memorySystem, groundTruth);

      const result = await validator.validate(
        "The KPI target is not achievable given resource constraints.",
        "org-1",
        "target"
      );

      expect(result.passed).toBe(false);
      expect(result.contradictions.length).toBeGreaterThanOrEqual(1);
    });

    it("detects supported vs unsupported contradiction", async () => {
      const storedMemory = makeMemory({
        content: "The hypothesis is supported by market data.",
        agent_id: "opportunity",
      });
      const memorySystem = makeMockMemorySystem([storedMemory]);
      const groundTruth = makeMockGroundTruth();
      const validator = new KnowledgeFabricValidator(memorySystem, groundTruth);

      const result = await validator.validate(
        "The hypothesis is unsupported by available evidence.",
        "org-1",
        "opportunity"
      );

      expect(result.passed).toBe(false);
      expect(result.contradictions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("validate — GroundTruth benchmark misalignment", () => {
    it("flags claims that fail benchmark validation", async () => {
      const memorySystem = makeMockMemorySystem([]);
      const groundTruth = makeMockGroundTruth({
        validateClaim: vi.fn().mockResolvedValue({
          valid: false,
          percentile: "p99",
          warning: "Value exceeds p99 benchmark",
          citation: "ESO 2024",
        }),
      });
      const validator = new KnowledgeFabricValidator(memorySystem, groundTruth);

      const result = await validator.validate(
        "ESO-KPI-procurement_cost_rate: 999.99",
        "org-1",
        "target"
      );

      expect(result.passed).toBe(false);
      expect(result.benchmarkMisalignments).toHaveLength(1);
      expect(result.benchmarkMisalignments[0]!.claimedValue).toBe(999.99);
    });

    it("passes when benchmarks align", async () => {
      const memorySystem = makeMockMemorySystem([]);
      const groundTruth = makeMockGroundTruth({
        validateClaim: vi.fn().mockResolvedValue({
          valid: true,
          percentile: "p50",
          citation: "ESO 2024",
        }),
      });
      const validator = new KnowledgeFabricValidator(memorySystem, groundTruth);

      const result = await validator.validate(
        "ESO-KPI-procurement_cost_rate: 42.5",
        "org-1",
        "target"
      );

      expect(result.passed).toBe(true);
      expect(result.benchmarkMisalignments).toHaveLength(0);
    });

    it("skips benchmark check when no GroundTruth service is provided", async () => {
      const memorySystem = makeMockMemorySystem([]);
      const validator = new KnowledgeFabricValidator(memorySystem, null);

      const result = await validator.validate(
        "ESO-KPI-procurement_cost_rate: 999.99",
        "org-1",
        "target"
      );

      expect(result.passed).toBe(true);
      expect(result.benchmarkMisalignments).toHaveLength(0);
    });
  });

  describe("validate — cross-agent memory retrieval", () => {
    it("checks related agents for contradictions", async () => {
      const memorySystem = makeMockMemorySystem([]);
      const groundTruth = makeMockGroundTruth();
      const validator = new KnowledgeFabricValidator(memorySystem, groundTruth);

      await validator.validate("some content", "org-1", "integrity");

      // integrity agent should check target and opportunity memories
      const retrieveCalls = (memorySystem.retrieve as ReturnType<typeof vi.fn>).mock.calls;
      const agentIds = retrieveCalls.map((call: Array<Record<string, unknown>>) => call[0].agent_id);
      expect(agentIds).toContain("integrity");
      expect(agentIds).toContain("target");
      expect(agentIds).toContain("opportunity");
    });
  });

  describe("validate — confidence scoring", () => {
    it("degrades confidence with each contradiction", async () => {
      // Two memories with contradicting values
      const memories = [
        makeMemory({ content: "baseline: 10", agent_id: "target" }),
        makeMemory({ content: "target: 5", agent_id: "target" }),
      ];
      const memorySystem = makeMockMemorySystem(memories);
      const groundTruth = makeMockGroundTruth();
      const validator = new KnowledgeFabricValidator(memorySystem, groundTruth);

      // Response contradicts both baseline and target
      const result = await validator.validate(
        "baseline: 100, target: 500",
        "org-1",
        "target"
      );

      expect(result.confidence).toBeLessThan(1);
      // Each contradiction penalizes 0.15
      expect(result.confidence).toBeLessThanOrEqual(0.7);
    });
  });

  describe("validate — resilience", () => {
    it("handles memory retrieval failure gracefully", async () => {
      const memorySystem = makeMockMemorySystem([]);
      (memorySystem.retrieve as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB connection failed")
      );
      const groundTruth = makeMockGroundTruth();
      const validator = new KnowledgeFabricValidator(memorySystem, groundTruth);

      const result = await validator.validate("some content", "org-1", "target");

      // Should not throw, should return passing result with no contradictions
      expect(result.passed).toBe(true);
      expect(result.contradictions).toHaveLength(0);
    });

    it("handles GroundTruth service failure gracefully", async () => {
      const memorySystem = makeMockMemorySystem([]);
      const groundTruth = makeMockGroundTruth({
        validateClaim: vi.fn().mockRejectedValue(new Error("Unknown metric")),
      });
      const validator = new KnowledgeFabricValidator(memorySystem, groundTruth);

      const result = await validator.validate(
        "ESO-KPI-unknown_metric_rate: 42",
        "org-1",
        "target"
      );

      // Unknown metrics are skipped, not failures
      expect(result.passed).toBe(true);
    });
  });

  describe("configuration", () => {
    it("respects custom contradiction threshold", async () => {
      const memories = [
        makeMemory({ content: "baseline: 45.5", agent_id: "target" }),
      ];
      // Return memories only for the "target" agent query, empty for related agents
      const retrieve = vi.fn().mockImplementation((query: { agent_id: string }) =>
        query.agent_id === "target" ? Promise.resolve(memories) : Promise.resolve([])
      );
      const memorySystem = {
        store: vi.fn().mockResolvedValue("mem_1"),
        retrieve,
        storeSemanticMemory: vi.fn().mockResolvedValue("mem_1"),
        clear: vi.fn().mockResolvedValue(0),
      } as unknown as MemorySystem;
      const groundTruth = makeMockGroundTruth();

      // Require 2 contradictions to fail
      const validator = new KnowledgeFabricValidator(memorySystem, groundTruth, {
        contradictionFailThreshold: 2,
      });

      // Only 1 contradiction (baseline 100 vs 45.5)
      const result = await validator.validate(
        "baseline: 100",
        "org-1",
        "target"
      );

      expect(result.contradictions.length).toBe(1);
      expect(result.passed).toBe(true); // Below threshold of 2
    });

    it("can disable benchmark checking", async () => {
      const memorySystem = makeMockMemorySystem([]);
      const groundTruth = makeMockGroundTruth();
      const validator = new KnowledgeFabricValidator(memorySystem, groundTruth, {
        enableBenchmarkCheck: false,
      });

      await validator.validate(
        "ESO-KPI-procurement_cost_rate: 999",
        "org-1",
        "target"
      );

      expect(groundTruth.validateClaim).not.toHaveBeenCalled();
    });
  });
});
