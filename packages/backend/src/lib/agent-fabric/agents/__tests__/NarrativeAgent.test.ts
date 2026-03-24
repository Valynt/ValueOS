import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockStoreSemanticMemory, mockComplete, mockCreateDraft, mockPublish } = vi.hoisted(() => ({
  mockStoreSemanticMemory: vi.fn().mockResolvedValue("mem_1"),
  mockComplete: vi.fn(),
  mockCreateDraft: vi.fn().mockResolvedValue({ id: "draft-1" }),
  mockPublish: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("../../../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock("../../LLMGateway.js", () => ({
  LLMGateway: class {
    complete = mockComplete;
  },
}));

vi.mock("../../MemorySystem.js", () => ({
  MemorySystem: class {
    store = vi.fn().mockResolvedValue("mem_1");
    retrieve = vi.fn().mockResolvedValue([]);
    storeSemanticMemory = mockStoreSemanticMemory;
    clear = vi.fn().mockResolvedValue(0);
  },
}));

vi.mock("../../CircuitBreaker.js", () => ({
  CircuitBreaker: class {
    execute = vi.fn().mockImplementation((fn: () => Promise<unknown>) => fn());
  },
}));

vi.mock("../../../../repositories/NarrativeDraftRepository.js", () => ({
  NarrativeDraftRepository: class {
    createDraft = mockCreateDraft;
  },
}));

const { mockWriteValueDriver, mockWriteEdge, mockGetSafeContext, mockGenerateNodeId, mockSafeWriteBatch } = vi.hoisted(() => {
  const mockWriteValueDriver = vi.fn().mockResolvedValue({ id: "vd-1" });
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
  return { mockWriteValueDriver, mockWriteEdge, mockGetSafeContext, mockGenerateNodeId, mockSafeWriteBatch };
});

vi.mock("../../BaseGraphWriter.js", () => ({
  BaseGraphWriter: class {
    getSafeContext = mockGetSafeContext;
    generateNodeId = mockGenerateNodeId;
    safeWriteBatch = mockSafeWriteBatch;
    writeValueDriver = mockWriteValueDriver;
    writeEdge = mockWriteEdge;
    writeCapability = vi.fn().mockResolvedValue({ id: "cap-1" });
    writeMetric = vi.fn().mockResolvedValue({ id: "met-1" });
    resolveOpportunityId = vi.fn().mockReturnValue("770e8400-e29b-41d4-a716-446655440002");
    safeWrite = vi.fn().mockResolvedValue({ id: "edge-1" });
  },
  LifecycleContextError: class extends Error {},
}));

vi.mock("../../../../events/DomainEventBus.js", () => ({
  getDomainEventBus: () => ({ publish: mockPublish }),
  buildEventEnvelope: vi.fn().mockReturnValue({}),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import type { AgentConfig, LifecycleContext } from "../../../../types/agent";
import { CircuitBreaker } from "../../CircuitBreaker";
import { LLMGateway } from "../../LLMGateway";
import { MemorySystem } from "../../MemorySystem";
import { NarrativeAgent } from "../NarrativeAgent";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(): AgentConfig {
  return {
    id: "narrative-agent",
    name: "narrative",
    type: "narrative" as never,
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
    user_inputs: { value_case_id: "case-abc", format: "executive_summary" },
    previous_stage_outputs: {
      integrity: {
        claim_validations: [
          { claim_id: "c1", claim_text: "Revenue will increase 20%", verdict: "supported", confidence: 0.85, evidence_assessment: "Strong", issues: [] },
        ],
        scores: { overall: 0.87 },
        veto_decision: { veto: false },
      },
      target: {
        kpi_targets: [{ name: "Revenue Growth", target: 20, unit: "%", timeframe: "12 months" }],
      },
    },
    ...overrides,
  };
}

const VALID_LLM_RESPONSE = {
  executive_summary: "This business case demonstrates a compelling 20% revenue uplift opportunity.",
  value_proposition: "By deploying ValueOS, the customer achieves measurable ROI within 12 months.",
  key_proof_points: [
    "20% revenue growth validated by Q3 data",
    "Procurement cost reduction of 30%",
    "Customer retention improved by 15%",
  ],
  risk_mitigations: [
    "Market risk mitigated by phased rollout",
    "Integration risk addressed by dedicated support team",
  ],
  call_to_action: "Approve the business case and initiate Phase 1 deployment by Q2.",
  defense_readiness_score: 0.82,
  talking_points: [
    { audience: "executive", point: "20% revenue uplift with 12-month payback" },
    { audience: "financial", point: "IRR of 34% over 3 years" },
  ],
  hallucination_check: true,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("NarrativeAgent", () => {
  let agent: NarrativeAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    const config = makeConfig();
    const llm = new LLMGateway({} as never);
    const memory = new MemorySystem({} as never);
    const cb = new CircuitBreaker({} as never);
    agent = new NarrativeAgent(config, "org-456", memory, llm, cb);
  });

  it("has correct identity fields", () => {
    expect(agent.lifecycleStage).toBe("narrative");
    expect(agent.version).toBe("2.0.0");
    expect(agent.name).toBe("narrative");
  });

  function llmResponse(payload: unknown) {
    return {
      id: "resp-1",
      model: "test-model",
      content: JSON.stringify(payload),
      finish_reason: "stop",
      usage: { prompt_tokens: 400, completion_tokens: 300, total_tokens: 700 },
    };
  }

  describe("execute", () => {
    it("rejects context when organization_id mismatches agent tenant", async () => {
      await expect(
        agent.execute(makeContext({ organization_id: "org-other" }))
      ).rejects.toThrow(/Tenant context mismatch/);
    });

    it("returns success output with narrative content", async () => {
      mockComplete.mockResolvedValue(llmResponse(VALID_LLM_RESPONSE));

      const output = await agent.execute(makeContext());

      expect(output.status).toBe("success");
      expect(output.result.executive_summary).toBe(VALID_LLM_RESPONSE.executive_summary);
      expect(output.result.defense_readiness_score).toBe(0.82);
      expect(output.result.key_proof_points).toHaveLength(3);
    });

    it("persists draft to NarrativeDraftRepository when value_case_id is present", async () => {
      mockComplete.mockResolvedValue(llmResponse(VALID_LLM_RESPONSE));

      await agent.execute(makeContext());

      expect(mockCreateDraft).toHaveBeenCalledWith(
        "case-abc",
        "org-456",
        expect.objectContaining({
          format: "executive_summary",
          defense_readiness_score: 0.82,
          hallucination_check: true,
        }),
      );
    });

    it("stores memory with organizationId for tenant isolation", async () => {
      mockComplete.mockResolvedValue(llmResponse(VALID_LLM_RESPONSE));

      await agent.execute(makeContext());

      expect(mockStoreSemanticMemory).toHaveBeenCalledWith(
        "ws-123",
        "narrative",
        "episodic",
        expect.stringContaining('"executive_summary"'),
        expect.objectContaining({
          organization_id: "org-456",
          lifecycle_stage: "narrative",
        }),
        "org-456",
      );
    });

    it("does not persist when value_case_id is absent", async () => {
      mockComplete.mockResolvedValue(llmResponse(VALID_LLM_RESPONSE));
      const ctx = makeContext({ user_inputs: {} });

      await agent.execute(ctx);

      expect(mockCreateDraft).not.toHaveBeenCalled();
    });

    it("returns failure when LLM throws", async () => {
      mockComplete.mockRejectedValue(new Error("LLM timeout"));

      const output = await agent.execute(makeContext());

      expect(output.status).toBe("failure");
      expect(output.result.error).toMatch(/failed/i);
    });

    it("returns high confidence when defense_readiness_score >= 0.8", async () => {
      mockComplete.mockResolvedValue(llmResponse({ ...VALID_LLM_RESPONSE, defense_readiness_score: 0.9 }));

      const output = await agent.execute(makeContext());

      expect(output.confidence).toBe("high");
    });

    it("returns medium confidence when defense_readiness_score is 0.6–0.79", async () => {
      mockComplete.mockResolvedValue(llmResponse({ ...VALID_LLM_RESPONSE, defense_readiness_score: 0.7 }));

      const output = await agent.execute(makeContext());

      expect(output.confidence).toBe("medium");
    });

    it("continues if DB persistence fails (non-fatal)", async () => {
      mockComplete.mockResolvedValue(llmResponse(VALID_LLM_RESPONSE));
      mockCreateDraft.mockRejectedValue(new Error("DB unavailable"));

      const output = await agent.execute(makeContext());

      // Agent should still succeed even if persistence fails
      expect(output.status).toBe("success");
    });

    it("publishes narrative.drafted domain event with normalized payload fields", async () => {
      mockComplete.mockResolvedValue(llmResponse(VALID_LLM_RESPONSE));

      await agent.execute(makeContext());

      expect(mockPublish).toHaveBeenCalledWith(
        "narrative.drafted",
        expect.objectContaining({
          valueCaseId: "case-abc",
          defenseReadinessScore: 0.82,
          format: "executive_summary",
        }),
      );

      const publishedPayload = mockPublish.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(publishedPayload).not.toHaveProperty("organization_id");
      expect(publishedPayload).not.toHaveProperty("value_case_id");
      expect(publishedPayload).not.toHaveProperty("defense_readiness_score");
    });
  });

  // -------------------------------------------------------------------------
  // Value Graph integration
  // -------------------------------------------------------------------------

  describe("Value Graph writes", () => {
    const VALID_OPP_ID = "770e8400-e29b-41d4-a716-446655440002";
    const VALID_ORG_ID = "660e8400-e29b-41d4-a716-446655440001";

    function makeGraphContext(): LifecycleContext {
      return makeContext({
        user_inputs: {
          value_case_id: "case-abc",
          format: "executive_summary",
          opportunity_id: VALID_OPP_ID,
        },
        previous_stage_outputs: {
          target: {
            kpi_targets: [{ name: "Revenue Growth", target: 20, unit: "%" }],
          },
        },
      });
    }

    it("writes VgValueDriver nodes and metric_maps_to_value_driver edges when opportunity_id is present", async () => {
      mockComplete.mockResolvedValue(llmResponse(VALID_LLM_RESPONSE));

      await agent.execute(makeGraphContext());

      // writeValueDriver is called as this.graphWriter.writeValueDriver(context, input)
      expect(mockWriteValueDriver).toHaveBeenCalledWith(
        expect.objectContaining({ organization_id: "org-456" }), // context arg
        expect.objectContaining({ name: "Revenue Growth" }),      // input arg
      );
      // writeEdge is called with (context, edgeInput)
      expect(mockWriteEdge).toHaveBeenCalledWith(
        expect.objectContaining({ organization_id: "org-456" }),
        expect.objectContaining({ edge_type: "metric_maps_to_value_driver" }),
      );
    });

    it("succeeds without graph writes when opportunity_id is absent", async () => {
      mockComplete.mockResolvedValue(llmResponse(VALID_LLM_RESPONSE));
      // Simulate getSafeContext throwing when opportunity_id is missing
      mockGetSafeContext.mockImplementationOnce(() => {
        throw new Error("opportunity_id is missing");
      });

      const output = await agent.execute(makeContext());

      expect(output.status).toBe("success");
    });
  });
});
