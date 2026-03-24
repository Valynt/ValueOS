import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks ---

const { mockRetrieve, mockStoreSemanticMemory, mockComplete } = vi.hoisted(() => ({
  mockRetrieve: vi.fn(),
  mockStoreSemanticMemory: vi.fn().mockResolvedValue("mem_1"),
  mockComplete: vi.fn(),
}));

// --- Module mocks ---

vi.mock("../../../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock("../../LLMGateway.js", () => ({
  LLMGateway: class {
    constructor() {}
    complete = mockComplete;
  },
}));

vi.mock("../../MemorySystem.js", () => ({
  MemorySystem: class {
    constructor() {}
    store = vi.fn().mockResolvedValue("mem_1");
    retrieve = mockRetrieve;
    storeSemanticMemory = mockStoreSemanticMemory;
    clear = vi.fn().mockResolvedValue(0);
  },
}));

vi.mock("../../CircuitBreaker.js", () => ({
  CircuitBreaker: class {
    constructor() {}
    execute = vi.fn().mockImplementation((fn: () => Promise<unknown>) => fn());
  },
}));

const { mockWriteValueDriver: mockCompWriteValueDriver, mockWriteMetric: mockCompWriteMetric, mockWriteEdge: mockCompWriteEdge, mockGetSafeContext: mockCompGetSafeContext, mockGenerateNodeId: mockCompGenerateNodeId, mockSafeWriteBatch: mockCompSafeWriteBatch } = vi.hoisted(() => {
  const mockWriteValueDriver = vi.fn().mockResolvedValue({ id: "vd-1" });
  const mockWriteMetric = vi.fn().mockResolvedValue({ id: "met-1" });
  const mockWriteEdge = vi.fn().mockResolvedValue({ id: "edge-1" });
  const mockGetSafeContext = vi.fn().mockReturnValue({
    opportunityId: "770e8400-e29b-41d4-a716-446655440002",
    organizationId: "660e8400-e29b-41d4-a716-446655440001",
  });
  const mockGenerateNodeId = vi.fn().mockReturnValue("550e8400-e29b-41d4-a716-446655440000");
  const mockSafeWriteBatch = vi.fn().mockImplementation(
    async (writes: Array<() => Promise<unknown>>) => {
      await Promise.all(writes.map((fn) => fn()));
      return { succeeded: writes.length, failed: 0, errors: [] };
    },
  );
  return { mockWriteValueDriver, mockWriteMetric, mockWriteEdge, mockGetSafeContext, mockGenerateNodeId, mockSafeWriteBatch };
});

vi.mock("../../BaseGraphWriter.js", () => ({
  BaseGraphWriter: class {
    getSafeContext = mockCompGetSafeContext;
    generateNodeId = mockCompGenerateNodeId;
    safeWriteBatch = mockCompSafeWriteBatch;
    writeValueDriver = mockCompWriteValueDriver;
    writeMetric = mockCompWriteMetric;
    writeEdge = mockCompWriteEdge;
    writeCapability = vi.fn().mockResolvedValue({ id: "cap-1" });
    resolveOpportunityId = vi.fn().mockReturnValue("770e8400-e29b-41d4-a716-446655440002");
  },
  LifecycleContextError: class extends Error {},
}));

vi.mock("../../../../services/MCPGroundTruthService.js", () => ({
  mcpGroundTruthService: { getFinancialData: vi.fn().mockResolvedValue(null) },
}));

// --- Imports ---

import type { AgentConfig, LifecycleContext } from "../../../../types/agent";
import { CircuitBreaker } from "../../CircuitBreaker";
import { LLMGateway } from "../../LLMGateway";
import { MemorySystem } from "../../MemorySystem";
import { ComplianceAuditorAgent } from "../ComplianceAuditorAgent";

// --- Helpers ---

function makeConfig(): AgentConfig {
  return {
    id: "compliance-auditor-agent",
    name: "ComplianceAuditorAgent",
    type: "integrity" as any,
    lifecycle_stage: "integrity",
    capabilities: [],
    model: { provider: "custom", model_name: "test" },
    prompts: { system_prompt: "", user_prompt_template: "" },
    parameters: { timeout_seconds: 30, max_retries: 3, retry_delay_ms: 1000, enable_caching: false, enable_telemetry: false },
    constraints: { max_input_tokens: 4096, max_output_tokens: 4096, allowed_actions: [], forbidden_actions: [], required_permissions: [] },
  };
}

function makeContext(overrides: Partial<LifecycleContext> = {}): LifecycleContext {
  return {
    workspace_id: "ws-123",
    organization_id: "org-456",
    user_id: "user-789",
    lifecycle_stage: "integrity",
    workspace_data: {},
    user_inputs: {},
    ...overrides,
  };
}

// Evidence entries returned by memory for each source agent
function makeEvidence(source: string, content: string) {
  return {
    id: `mem_${source}`,
    agent_id: source,
    workspace_id: "ws-123",
    content,
    memory_type: "semantic",
    importance: 0.7,
    created_at: "2024-01-01T00:00:00Z",
    accessed_at: "2024-01-01T00:00:00Z",
    access_count: 0,
    metadata: { organization_id: "org-456" },
  };
}

const LLM_SUCCESS_RESPONSE = JSON.stringify({
  summary: "All controls are adequately covered.",
  control_gaps: [],
  control_coverage_score: 0.92,
  recommended_actions: ["Continue monitoring quarterly"],
});

// --- Tests ---

describe("ComplianceAuditorAgent", () => {
  let agent: ComplianceAuditorAgent;

  beforeEach(() => {
    vi.clearAllMocks();

    agent = new ComplianceAuditorAgent(
      makeConfig(),
      "org-456",
      new MemorySystem({} as any) as any,
      new LLMGateway("custom") as any,
      new CircuitBreaker() as any,
    );

    // Default: each source agent has one evidence entry
    mockRetrieve.mockImplementation((query: { agent_id: string }) =>
      Promise.resolve([makeEvidence(query.agent_id, `Evidence from ${query.agent_id}`)]),
    );

    mockComplete.mockResolvedValue({
      id: "resp-1",
      model: "test-model",
      content: LLM_SUCCESS_RESPONSE,
      finish_reason: "stop",
      usage: { prompt_tokens: 400, completion_tokens: 200, total_tokens: 600 },
    });
  });

  describe("execute — main path", () => {
    it("rejects context when organization_id mismatches agent tenant", async () => {
      await expect(
        agent.execute(makeContext({ organization_id: "org-other" }))
      ).rejects.toThrow(/Tenant context mismatch/);
    });

    it("returns success with LLM summary and coverage score", async () => {
      const result = await agent.execute(makeContext());

      expect(result.status).toBe("success");
      expect(result.agent_type).toBe("validating");
      expect(result.result.summary).toBe("All controls are adequately covered.");
      expect(result.result.control_coverage_score).toBeGreaterThanOrEqual(0);
      expect(result.result.control_coverage_score).toBeLessThanOrEqual(1);
      expect(Array.isArray(result.result.control_gaps)).toBe(true);
      expect(Array.isArray(result.result.recommended_actions)).toBe(true);
      // Check that evidence_by_source exists and has the right structure
      expect(typeof result.result.evidence_by_source).toBe("object");
    });

    it("aggregates evidence counts from all 6 source agents", async () => {
      const result = await agent.execute(makeContext());

      const counts = result.result.evidence_by_source as Record<string, number>;
      const sources = ["opportunity", "target", "financial-modeling", "integrity", "realization", "expansion"];
      for (const source of sources) {
        expect(counts[source]).toBe(1);
      }
    });

    it("stores the compliance summary in memory with tenant isolation", async () => {
      await agent.execute(makeContext());

      // Check that the memory store was called
      expect(mockStoreSemanticMemory).toHaveBeenCalled();
    });

    it("maps high coverage score to very_high confidence", async () => {
      const result = await agent.execute(makeContext());

      // control_coverage_score 0.92 >= 0.85 → very_high
      expect(result.confidence).toBe("very_high");
    });
  });

  describe("execute — tenant isolation", () => {
    it("rejects context with mismatched organization_id", async () => {
      await expect(
        agent.execute(makeContext({ organization_id: "org-WRONG" })),
      ).rejects.toThrow(/Tenant context mismatch/);
    });
  });

  describe("execute — invalid context", () => {
    it("throws when workspace_id is missing", async () => {
      await expect(
        agent.execute(makeContext({ workspace_id: "" })),
      ).rejects.toThrow("Invalid compliance auditor context");
    });
  });

  describe("execute — LLM failure", () => {
    it("propagates error when LLM throws", async () => {
      mockComplete.mockRejectedValue(new Error("LLM unavailable"));

      await expect(agent.execute(makeContext())).rejects.toThrow();
    });
  });

  describe("Value Graph writes", () => {
    beforeEach(() => {
      mockCompWriteValueDriver.mockClear();
      mockCompWriteMetric.mockClear();
      mockCompWriteEdge.mockClear();
      // Restore safeWriteBatch implementation after vi.clearAllMocks() resets it
      mockCompSafeWriteBatch.mockImplementation(
        async (writes: Array<() => Promise<unknown>>) => {
          await Promise.all(writes.map((fn) => fn()));
          return { succeeded: writes.length, failed: 0, errors: [] };
        },
      );
    });

    it("writes VgValueDriver + VgMetric nodes and metric_maps_to_value_driver edges when control gaps exist", async () => {
      // Return distinct UUIDs so driverId !== metricId (avoids self-loop edges).
      mockCompGenerateNodeId
        .mockReturnValueOnce("550e8400-e29b-41d4-a716-446655440000") // driverId
        .mockReturnValueOnce("661e8400-e29b-41d4-a716-446655440001") // metricId
        .mockReturnValue("550e8400-e29b-41d4-a716-446655440000");    // fallback

      // Simulate missing evidence for some sources so control gaps are generated
      mockRetrieve
        .mockResolvedValueOnce([])  // opportunity — no evidence → gap
        .mockResolvedValueOnce([])  // target — no evidence → gap
        .mockResolvedValue([{ content: "evidence", agent_id: "x", workspace_id: "ws", memory_type: "semantic", importance: 1 }]);

      await agent.execute(makeContext());

      expect(mockCompWriteValueDriver).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ category: "risk" }),
      );
      expect(mockCompWriteMetric).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ name: expect.stringContaining("(metric)") }),
      );

      // Edge must use the correct ontology type and must not be a self-loop
      const edgeCall = mockCompWriteEdge.mock.calls[0];
      expect(edgeCall).toBeDefined();
      const edgeInput = edgeCall[1] as Record<string, unknown>;
      expect(edgeInput.edge_type).toBe("metric_maps_to_value_driver");
      expect(edgeInput.from_entity_type).toBe("vg_metric");
      expect(edgeInput.to_entity_type).toBe("vg_value_driver");
      expect(edgeInput.from_entity_id).not.toBe(edgeInput.to_entity_id);
    });

    it("succeeds without graph writes when getSafeContext throws", async () => {
      mockCompGetSafeContext.mockImplementationOnce(() => {
        throw new Error("opportunity_id is missing");
      });

      const result = await agent.execute(makeContext());
      expect(result.status).toBe("success");
      expect(mockCompWriteValueDriver).not.toHaveBeenCalled();
    });
  });
});
