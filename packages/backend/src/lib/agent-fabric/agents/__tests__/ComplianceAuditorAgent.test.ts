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
    it("returns success with LLM summary and coverage score", async () => {
      const result = await agent.execute(makeContext());

      expect(result.status).toBe("success");
      expect(result.agent_type).toBe("integrity");
      expect(result.result.summary).toBe("All controls are adequately covered.");
      expect(result.result.control_coverage_score).toBe(0.92);
      expect(result.result.control_gaps).toEqual([]);
      expect(result.result.recommended_actions).toEqual(["Continue monitoring quarterly"]);
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

      // secureInvoke tracking call + compliance summary store = 2 calls
      expect(mockStoreSemanticMemory).toHaveBeenCalledTimes(2);

      // The compliance summary call has content starting with "Compliance evidence summary:"
      const summaryCall = mockStoreSemanticMemory.mock.calls.find(
        (call: unknown[]) => typeof call[3] === "string" && (call[3] as string).startsWith("Compliance evidence summary:"),
      );
      expect(summaryCall).toBeDefined();
      // Tenant isolation: organizationId must be passed as the last argument
      expect(summaryCall![5]).toBe("org-456");
      expect(summaryCall![4]).toMatchObject({
        control_coverage_score: 0.92,
        tenant_id: "org-456",
      });
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
      ).rejects.toThrow("Tenant mismatch");
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
});
