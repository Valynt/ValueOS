/**
 * NarrativeAgent — Value Graph integration tests (Sprint 49)
 *
 * Verifies that NarrativeAgent:
 *   - reads top-3 value paths and injects them into the prompt
 *   - writes narrative_explains_hypothesis edges after LLM output
 *   - graph read failure does not affect output
 *   - graph write failure does not affect output
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks ---

const { mockStoreSemanticMemory, mockComplete, mockPublish } = vi.hoisted(() => ({
  mockStoreSemanticMemory: vi.fn().mockResolvedValue("mem_1"),
  mockComplete: vi.fn(),
  mockPublish: vi.fn().mockResolvedValue(undefined),
}));

// --- Module mocks ---

vi.mock("../../../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
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
    retrieve = vi.fn().mockResolvedValue([]);
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

vi.mock("../../../../services/agents/AgentKillSwitchService.js", () => ({
  agentKillSwitchService: { isKilled: vi.fn().mockResolvedValue(false) },
}));

vi.mock("../../../../repositories/AgentExecutionLineageRepository.js", () => ({
  agentExecutionLineageRepository: { appendLineage: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("../../../../repositories/NarrativeDraftRepository.js", () => ({
  NarrativeDraftRepository: class {
    createDraft = vi.fn().mockResolvedValue({ id: "draft-1" });
  },
}));

vi.mock("../../../../events/DomainEventBus.js", () => ({
  getDomainEventBus: () => ({ publish: mockPublish }),
  buildEventEnvelope: vi.fn().mockReturnValue({}),
}));

// Mock the full artifact services module
vi.mock("../../../../services/artifacts/index.js", () => {
  const mockArtifactResult = {
    output: { provenance_refs: [] },
    hallucinationCheck: true,
  };
  return {
    ArtifactRepository: class {
      create = vi.fn().mockResolvedValue({ id: "artifact-001" });
    },
    ArtifactEditService: class {},
    ExecutiveMemoGenerator: class {
      constructor() {}
      generate = vi.fn().mockResolvedValue(mockArtifactResult);
    },
    CFORecommendationGenerator: class {
      constructor() {}
      generate = vi.fn().mockResolvedValue(mockArtifactResult);
    },
    CustomerNarrativeGenerator: class {
      constructor() {}
      generate = vi.fn().mockResolvedValue(mockArtifactResult);
    },
    InternalCaseGenerator: class {
      constructor() {}
      generate = vi.fn().mockResolvedValue(mockArtifactResult);
    },
  };
});

// --- Imports ---

import type { AgentConfig, LifecycleContext } from "../../../../types/agent.js";
import { CircuitBreaker } from "../../CircuitBreaker.js";
import { LLMGateway } from "../../LLMGateway.js";
import { MemorySystem } from "../../MemorySystem.js";
import { NarrativeAgent } from "../NarrativeAgent.js";
import type { ValueGraphService } from "../../../../services/value-graph/ValueGraphService.js";

// --- Helpers ---

function makeConfig(): AgentConfig {
  return {
    id: "narrative-agent", name: "narrative", type: "narrative" as never,
    lifecycle_stage: "narrative", capabilities: [],
    model: { provider: "custom", model_name: "test" },
    prompts: { system_prompt: "", user_prompt_template: "" },
    parameters: { timeout_seconds: 30, max_retries: 3, retry_delay_ms: 1000, enable_caching: false, enable_telemetry: false },
    constraints: { max_input_tokens: 4096, max_output_tokens: 4096, allowed_actions: [], forbidden_actions: [], required_permissions: [] },
  };
}

function makeContext(overrides: Partial<LifecycleContext> = {}): LifecycleContext {
  return {
    workspace_id: "ws-123", organization_id: "org-456", user_id: "user-789",
    lifecycle_stage: "narrative", workspace_data: {},
    user_inputs: { value_case_id: "case-001" },
    ...overrides,
  };
}

const MOCK_VALUE_PATH = {
  edges: [],
  path_confidence: 0.72,
  value_driver: { id: "vd-1", name: "Cost Reduction", type: "cost_reduction", description: "", organization_id: "org-456", opportunity_id: "case-001", ontology_version: "1.0", created_at: "", updated_at: "" },
  use_case_id: "uc-1",
  metrics: [{ id: "m-1", name: "Procurement Cost", unit: "usd", organization_id: "org-456", opportunity_id: "case-001", ontology_version: "1.0", created_at: "", updated_at: "" }],
  capabilities: [{ id: "cap-1", name: "Vendor Consolidation", description: "", category: "other", organization_id: "org-456", opportunity_id: "case-001", ontology_version: "1.0", created_at: "", updated_at: "" }],
};

function makeMockVgs(valuePaths = [MOCK_VALUE_PATH]) {
  return {
    getValuePaths: vi.fn().mockResolvedValue(valuePaths),
    writeEdge: vi.fn().mockResolvedValue({
      id: "edge-001", organization_id: "org-456", opportunity_id: "case-001",
      from_entity_type: "narrative", from_entity_id: "narr-001",
      to_entity_type: "value_hypothesis", to_entity_id: "hyp-001",
      edge_type: "narrative_explains_hypothesis", confidence_score: 0.85,
      evidence_ids: [], created_by_agent: "NarrativeAgent", ontology_version: "1.0",
      created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
    }),
    getGraphForOpportunity: vi.fn().mockResolvedValue({ nodes: [], edges: [], opportunity_id: "case-001", organization_id: "org-456", ontology_version: "1.0" }),
    writeMetric: vi.fn().mockResolvedValue({}),
    writeCapability: vi.fn().mockResolvedValue({}),
    writeValueDriver: vi.fn().mockResolvedValue({}),
  } as unknown as ValueGraphService;
}

const VALID_LLM_RESPONSE = JSON.stringify({
  executive_summary: "This business case demonstrates significant cost reduction potential.",
  value_proposition: "Reduce procurement costs by 30% through vendor consolidation.",
  key_proof_points: [
    "Vendor count exceeds industry median by 40%",
    "Consolidation pilot reduced costs by 22%",
  ],
  risk_mitigations: ["Phased rollout to manage transition risk"],
  call_to_action: "Approve vendor consolidation program by Q2.",
  defense_readiness_score: 0.85,
  talking_points: [
    { audience: "executive", point: "30% cost reduction in 12 months" },
    { audience: "financial", point: "NPV positive at 18 months" },
  ],
  hallucination_check: true,
});

// --- Tests ---

describe("NarrativeAgent — Value Graph integration", () => {
  let agent: NarrativeAgent;
  let mockVgs: ValueGraphService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockComplete.mockResolvedValue({
      id: "resp-1", model: "test-model", content: VALID_LLM_RESPONSE,
      finish_reason: "stop", usage: { prompt_tokens: 300, completion_tokens: 300, total_tokens: 600 },
    });

    mockVgs = makeMockVgs();
    agent = new NarrativeAgent(
      makeConfig(), "org-456",
      new MemorySystem({} as never) as never,
      new LLMGateway("custom") as never,
      new CircuitBreaker() as never,
      mockVgs,
    );
  });

  it("reads value paths from the graph before LLM invocation", async () => {
    await agent.execute(makeContext());

    expect(mockVgs.getValuePaths).toHaveBeenCalledWith("case-001", "org-456");
  });

  it("writes one narrative_explains_hypothesis edge per proof point", async () => {
    await agent.execute(makeContext());

    // 2 proof points → 2 edges
    expect(mockVgs.writeEdge).toHaveBeenCalledTimes(2);
    expect(mockVgs.writeEdge).toHaveBeenCalledWith(
      expect.objectContaining({
        edge_type: "narrative_explains_hypothesis",
        from_entity_type: "narrative",
        to_entity_type: "value_hypothesis",
        confidence_score: 0.85,
        created_by_agent: "NarrativeAgent",
        organization_id: "org-456",
        opportunity_id: "case-001",
      }),
    );
  });

  it("uses fresh UUIDs for from_entity_id and to_entity_id", async () => {
    await agent.execute(makeContext());

    const calls = (mockVgs.writeEdge as ReturnType<typeof vi.fn>).mock.calls;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(calls[0][0].from_entity_id).toMatch(uuidRegex);
    expect(calls[0][0].to_entity_id).toMatch(uuidRegex);
  });

  it("returns successful output even when getValuePaths fails", async () => {
    (mockVgs.getValuePaths as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("graph unavailable"),
    );

    const output = await agent.execute(makeContext());

    expect(output.status).toBe("success");
    expect(output.result).toHaveProperty("executive_summary");
  });

  it("returns successful output even when writeEdge fails", async () => {
    (mockVgs.writeEdge as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("write failed"),
    );

    const output = await agent.execute(makeContext());

    expect(output.status).toBe("success");
    expect(output.result).toHaveProperty("executive_summary");
  });

  it("injects graph path context into the prompt when paths exist", async () => {
    await agent.execute(makeContext());

    // getValuePaths was called — paths were fetched for injection
    expect(mockVgs.getValuePaths).toHaveBeenCalledTimes(1);
    // complete receives an array of message objects; find the one containing graph context
    const callArgs = (mockComplete as ReturnType<typeof vi.fn>).mock.calls[0];
    const promptText = JSON.stringify(callArgs);
    expect(promptText).toContain("Vendor Consolidation");
  });

  it("proceeds without graph context when no paths exist", async () => {
    (mockVgs.getValuePaths as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const output = await agent.execute(makeContext());

    expect(output.status).toBe("success");
  });
});
