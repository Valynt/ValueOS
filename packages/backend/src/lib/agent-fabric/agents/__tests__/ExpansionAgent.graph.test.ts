/**
 * ExpansionAgent — Value Graph integration tests (Sprint 49)
 *
 * Verifies that ExpansionAgent:
 *   - reads existing capability nodes to avoid duplicates
 *   - writes VgCapability nodes and expansion_extends_node edges for new_use_case/upsell opportunities
 *   - skips opportunities with duplicate capability names
 *   - skips non-qualifying opportunity types (cross_sell, geographic_expansion, deeper_adoption)
 *   - graph write failures never propagate to the primary output
 */

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

vi.mock("../../../../services/agents/AgentKillSwitchService.js", () => ({
  agentKillSwitchService: { isKilled: vi.fn().mockResolvedValue(false) },
}));

vi.mock("../../../../repositories/AgentExecutionLineageRepository.js", () => ({
  agentExecutionLineageRepository: { appendLineage: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("../../../../repositories/ExpansionOpportunityRepository.js", () => ({
  ExpansionOpportunityRepository: class {
    createOpportunity = vi.fn().mockResolvedValue({ id: "exp-001" });
  },
}));

// --- Imports ---

import type { AgentConfig, LifecycleContext } from "../../../../types/agent.js";
import { CircuitBreaker } from "../../CircuitBreaker.js";
import { LLMGateway } from "../../LLMGateway.js";
import { MemorySystem } from "../../MemorySystem.js";
import { ExpansionAgent } from "../ExpansionAgent.js";
import type { ValueGraphService } from "../../../../services/value-graph/ValueGraphService.js";

// --- Helpers ---

function makeConfig(): AgentConfig {
  return {
    id: "expansion-agent", name: "expansion", type: "expansion" as never,
    lifecycle_stage: "expansion", capabilities: [],
    model: { provider: "custom", model_name: "test" },
    prompts: { system_prompt: "", user_prompt_template: "" },
    parameters: { timeout_seconds: 30, max_retries: 3, retry_delay_ms: 1000, enable_caching: false, enable_telemetry: false },
    constraints: { max_input_tokens: 4096, max_output_tokens: 4096, allowed_actions: [], forbidden_actions: [], required_permissions: [] },
  };
}

function makeContext(overrides: Partial<LifecycleContext> = {}): LifecycleContext {
  return {
    workspace_id: "ws-123", organization_id: "org-456", user_id: "user-789",
    lifecycle_stage: "expansion", workspace_data: {},
    user_inputs: { value_case_id: "case-001" },
    ...overrides,
  };
}

function makeMockVgs(existingCapabilityNames: string[] = []) {
  const capabilityNodes = existingCapabilityNames.map((name, i) => ({
    entity_type: "vg_capability" as const,
    entity_id: `cap-existing-${i}`,
    data: { id: `cap-existing-${i}`, name },
  }));

  return {
    getGraphForOpportunity: vi.fn().mockResolvedValue({
      nodes: capabilityNodes, edges: [],
      opportunity_id: "case-001", organization_id: "org-456", ontology_version: "1.0",
    }),
    writeCapability: vi.fn().mockResolvedValue({
      id: "cap-new-001", organization_id: "org-456", opportunity_id: "case-001",
      name: "AI-Powered Analytics", description: "New analytics capability",
      category: "other", ontology_version: "1.0",
      created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
    }),
    writeEdge: vi.fn().mockResolvedValue({
      id: "edge-001", organization_id: "org-456", opportunity_id: "case-001",
      from_entity_type: "use_case", from_entity_id: "case-001",
      to_entity_type: "vg_capability", to_entity_id: "cap-new-001",
      edge_type: "expansion_extends_node", confidence_score: 0.75,
      evidence_ids: [], created_by_agent: "ExpansionAgent", ontology_version: "1.0",
      created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
    }),
    writeMetric: vi.fn().mockResolvedValue({}),
    writeValueDriver: vi.fn().mockResolvedValue({}),
    getValuePaths: vi.fn().mockResolvedValue([]),
  } as unknown as ValueGraphService;
}

const PROOF_POINT_MEMORY = {
  id: "mem-pp-1", agent_id: "realization", workspace_id: "ws-123",
  content: "Proof point: cost reduction achieved",
  memory_type: "semantic", importance: 0.8,
  created_at: "2024-01-01T00:00:00Z", accessed_at: "2024-01-01T00:00:00Z", access_count: 0,
  metadata: {
    type: "proof_point", kpi_id: "kpi-1", direction: "over",
    confidence: 0.85, variance_percentage: 5, organization_id: "org-456",
  },
};

function makeLlmResponse(opportunities: Array<{
  id: string; title: string; type: string; confidence: number;
}>) {
  return JSON.stringify({
    opportunities: opportunities.map(o => ({
      id: o.id,
      title: o.title,
      description: `Description for ${o.title}`,
      type: o.type,
      source_kpi_id: "kpi-1",
      estimated_additional_value: { low: 100000, high: 300000, unit: "usd", timeframe_months: 12 },
      confidence: o.confidence,
      evidence: ["Proof point evidence"],
      prerequisites: [],
      stakeholders: ["VP Sales"],
    })),
    gap_analysis: [],
    portfolio_summary: "Strong expansion potential identified.",
    total_expansion_potential: { low: 100000, high: 300000, currency: "USD" },
    new_cycle_recommendations: [],
    recommended_next_steps: ["Prioritize top opportunity"],
  });
}

// --- Tests ---

describe("ExpansionAgent — Value Graph integration", () => {
  let agent: ExpansionAgent;
  let mockVgs: ValueGraphService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRetrieve.mockImplementation(({ agent_id }: { agent_id: string }) => {
      if (agent_id === "realization") return Promise.resolve([PROOF_POINT_MEMORY]);
      return Promise.resolve([]);
    });

    mockComplete.mockResolvedValue({
      id: "resp-1", model: "test-model",
      content: makeLlmResponse([
        { id: "opp-1", title: "AI-Powered Analytics", type: "new_use_case", confidence: 0.75 },
      ]),
      finish_reason: "stop", usage: { prompt_tokens: 200, completion_tokens: 200, total_tokens: 400 },
    });

    mockVgs = makeMockVgs();
    agent = new ExpansionAgent(
      makeConfig(), "org-456",
      new MemorySystem({} as never) as never,
      new LLMGateway("custom") as never,
      new CircuitBreaker() as never,
      mockVgs,
    );
  });

  it("reads existing graph capabilities before writing", async () => {
    await agent.execute(makeContext());

    expect(mockVgs.getGraphForOpportunity).toHaveBeenCalledWith("case-001", "org-456");
  });

  it("writes a VgCapability node for a new_use_case opportunity", async () => {
    await agent.execute(makeContext());

    expect(mockVgs.writeCapability).toHaveBeenCalledWith(
      expect.objectContaining({
        opportunity_id: "case-001",
        organization_id: "org-456",
        name: "AI-Powered Analytics",
        category: "other",
      }),
    );
  });

  it("writes an expansion_extends_node edge: UseCase → VgCapability", async () => {
    await agent.execute(makeContext());

    expect(mockVgs.writeEdge).toHaveBeenCalledWith(
      expect.objectContaining({
        edge_type: "expansion_extends_node",
        from_entity_type: "use_case",
        from_entity_id: "case-001",
        to_entity_type: "vg_capability",
        to_entity_id: "cap-new-001",
        confidence_score: 0.75,
        created_by_agent: "ExpansionAgent",
      }),
    );
  });

  it("skips capability write when name already exists in graph", async () => {
    mockVgs = makeMockVgs(["AI-Powered Analytics"]); // already exists
    agent = new ExpansionAgent(
      makeConfig(), "org-456",
      new MemorySystem({} as never) as never,
      new LLMGateway("custom") as never,
      new CircuitBreaker() as never,
      mockVgs,
    );

    await agent.execute(makeContext());

    expect(mockVgs.writeCapability).not.toHaveBeenCalled();
    expect(mockVgs.writeEdge).not.toHaveBeenCalled();
  });

  it("skips non-qualifying opportunity types (cross_sell, geographic_expansion, deeper_adoption)", async () => {
    mockComplete.mockResolvedValue({
      id: "resp-2", model: "test-model",
      content: makeLlmResponse([
        { id: "opp-1", title: "Cross-sell Opportunity", type: "cross_sell", confidence: 0.7 },
        { id: "opp-2", title: "Geographic Expansion", type: "geographic_expansion", confidence: 0.6 },
        { id: "opp-3", title: "Deeper Adoption", type: "deeper_adoption", confidence: 0.8 },
      ]),
      finish_reason: "stop", usage: { prompt_tokens: 200, completion_tokens: 200, total_tokens: 400 },
    });

    await agent.execute(makeContext());

    expect(mockVgs.writeCapability).not.toHaveBeenCalled();
    expect(mockVgs.writeEdge).not.toHaveBeenCalled();
  });

  it("writes for upsell type as well as new_use_case", async () => {
    mockComplete.mockResolvedValue({
      id: "resp-3", model: "test-model",
      content: makeLlmResponse([
        { id: "opp-1", title: "Premium Tier Upsell", type: "upsell", confidence: 0.8 },
      ]),
      finish_reason: "stop", usage: { prompt_tokens: 200, completion_tokens: 200, total_tokens: 400 },
    });

    await agent.execute(makeContext());

    expect(mockVgs.writeCapability).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Premium Tier Upsell" }),
    );
  });

  it("returns successful output even when graph writes fail", async () => {
    (mockVgs.writeCapability as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB timeout"));

    const output = await agent.execute(makeContext());

    expect(output.status).toBe("success");
    expect(output.result).toHaveProperty("opportunities");
  });

  it("returns successful output even when getGraphForOpportunity fails", async () => {
    (mockVgs.getGraphForOpportunity as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("connection refused"),
    );

    const output = await agent.execute(makeContext());

    // Still writes — can't check for duplicates but proceeds
    expect(output.status).toBe("success");
  });
});
