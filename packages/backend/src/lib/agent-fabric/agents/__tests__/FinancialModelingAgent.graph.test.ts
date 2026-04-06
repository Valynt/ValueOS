/**
 * FinancialModelingAgent — Value Graph integration tests (Sprint 48)
 *
 * Verifies that FinancialModelingAgent writes VgMetric nodes and
 * capability_impacts_metric + metric_maps_to_value_driver edges after a
 * successful run, and that graph write failures never propagate to the
 * primary output.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks ---

const { mockRetrieve, mockStoreSemanticMemory, mockComplete, mockSupabaseChain } = vi.hoisted(() => {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.upsert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: { id: "snap-001", tenant_id: "org-456" }, error: null });
  // Proper thenable: calls resolve with the result
  chain.then = (resolve: (v: unknown) => void) => { resolve({ data: [], error: null }); };
  return {
    mockRetrieve: vi.fn(),
    mockStoreSemanticMemory: vi.fn().mockResolvedValue("mem_1"),
    mockComplete: vi.fn(),
    mockSupabaseChain: chain,
  };
});

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

vi.mock("../../../../repositories/FinancialModelSnapshotRepository.js", () => ({
  FinancialModelSnapshotRepository: class {
    createSnapshot = vi.fn().mockResolvedValue({
      id: "snap-001", tenant_id: "org-456", case_id: "case-001",
      models_json: [], assumptions_json: [], outputs_json: {},
      created_at: "2026-01-01T00:00:00.000Z",
    });
  },
  financialModelSnapshotRepository: {
    createSnapshot: vi.fn().mockResolvedValue({
      id: "snap-001", tenant_id: "org-456", case_id: "case-001",
    }),
  },
}));

vi.mock("../../../../lib/agents/ProvenanceTracker.js", () => ({
  getProvenanceTracker: () => ({ record: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock("../../../../lib/supabase.js", () => ({
  assertNotTestEnv: vi.fn(),
  supabase: mockSupabaseChain,
  createServerSupabaseClient: vi.fn(() => mockSupabaseChain),
  createServiceRoleSupabaseClient: vi.fn(() => mockSupabaseChain),
}));

// --- Imports ---

import type { AgentConfig, LifecycleContext } from "../../../../types/agent.js";
import { CircuitBreaker } from "../../CircuitBreaker.js";
import { LLMGateway } from "../../LLMGateway.js";
import { MemorySystem } from "../../MemorySystem.js";
import { FinancialModelingAgent } from "../FinancialModelingAgent.js";
import type { ValueGraphService } from "../../../../services/value-graph/ValueGraphService.js";

// --- Helpers ---

function makeConfig(): AgentConfig {
  return {
    id: "financial-modeling-agent", name: "financial_modeling", type: "financial_modeling" as never,
    lifecycle_stage: "modeling", capabilities: [],
    model: { provider: "custom", model_name: "test" },
    prompts: { system_prompt: "", user_prompt_template: "" },
    parameters: { timeout_seconds: 30, max_retries: 3, retry_delay_ms: 1000, enable_caching: false, enable_telemetry: false },
    constraints: { max_input_tokens: 4096, max_output_tokens: 4096, allowed_actions: [], forbidden_actions: [], required_permissions: [] },
  };
}

function makeContext(overrides: Partial<LifecycleContext> = {}): LifecycleContext {
  return {
    workspace_id: "ws-123", organization_id: "org-456", user_id: "user-789",
    lifecycle_stage: "modeling", workspace_data: {},
    user_inputs: { value_case_id: "case-001" },
    ...overrides,
  };
}

const STORED_HYPOTHESES = [
  {
    id: "mem_hyp_1", agent_id: "opportunity", workspace_id: "ws-123",
    content: "Hypothesis: Supply Chain Optimization",
    memory_type: "semantic", importance: 0.75,
    created_at: "2024-01-01T00:00:00Z", accessed_at: "2024-01-01T00:00:00Z", access_count: 0,
    metadata: { verified: true, category: "cost_reduction", confidence: 0.8, organization_id: "org-456" },
  },
];

const LLM_RESPONSE = JSON.stringify({
  projections: [
    {
      hypothesis_id: "hyp-1",
      hypothesis_description: "Supply Chain Optimization",
      category: "cost_reduction",
      assumptions: ["Vendor consolidation reduces unit costs by 20%"],
      cash_flows: [-200000, 150000, 300000, 350000],
      currency: "USD",
      period_type: "annual",
      discount_rate: 0.10,
      total_investment: 200000,
      total_benefit: 800000,
      confidence: 0.8,
      risk_factors: ["Vendor switching costs"],
      data_sources: ["ERP data"],
    },
  ],
  portfolio_summary: "One model with positive NPV.",
  key_assumptions: ["Stable market conditions"],
  recommended_next_steps: ["Validate vendor quotes"],
});

// --- Mock ValueGraphService ---

function makeMockVgs(capabilityNodes: unknown[] = []) {
  const metricResult = {
    id: "metric-001", organization_id: "org-456", opportunity_id: "case-001",
    name: "Supply Chain Optimization", unit: "usd",
    baseline_value: 200000, target_value: 800000,
    ontology_version: "1.0",
    created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
  };
  const driverResult = {
    id: "driver-001", organization_id: "org-456", opportunity_id: "case-001",
    type: "cost_reduction", name: "Supply Chain Optimization",
    description: "Financial model", ontology_version: "1.0",
    created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
  };

  return {
    writeCapability: vi.fn().mockResolvedValue({}),
    writeValueDriver: vi.fn().mockResolvedValue(driverResult),
    writeMetric: vi.fn().mockResolvedValue(metricResult),
    writeEdge: vi.fn().mockResolvedValue({}),
    getGraphForOpportunity: vi.fn().mockResolvedValue({
      nodes: capabilityNodes,
      edges: [],
      opportunity_id: "case-001",
      organization_id: "org-456",
      ontology_version: "1.0",
    }),
    getValuePaths: vi.fn().mockResolvedValue([]),
  } as unknown as ValueGraphService;
}

// --- Tests ---

describe("FinancialModelingAgent — Value Graph integration", () => {
  let agent: FinancialModelingAgent;
  let mockVgs: ValueGraphService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockVgs = makeMockVgs();

    agent = new FinancialModelingAgent(
      makeConfig(), "org-456",
      new MemorySystem({} as never) as never,
      new LLMGateway("custom") as never,
      new CircuitBreaker() as never,
      mockVgs,
    );

    mockRetrieve.mockImplementation((query: { agent_id?: string }) => {
      if (query.agent_id === "opportunity") return Promise.resolve(STORED_HYPOTHESES);
      return Promise.resolve([]);
    });

    mockComplete.mockResolvedValue({
      id: "resp-1", model: "test-model", content: LLM_RESPONSE,
      finish_reason: "stop", usage: { prompt_tokens: 800, completion_tokens: 600, total_tokens: 1400 },
    });
  });

  it("writes a VgMetric node for each computed model", async () => {
    await agent.execute(makeContext());

    expect(mockVgs.writeMetric).toHaveBeenCalledTimes(1);
    expect(mockVgs.writeMetric).toHaveBeenCalledWith(
      expect.objectContaining({
        opportunity_id: "case-001",
        organization_id: "org-456",
        name: "Supply Chain Optimization",
        unit: "usd",
      })
    );
  });

  it("writes metric_maps_to_value_driver edge", async () => {
    await agent.execute(makeContext());

    const edgeCalls = (mockVgs.writeEdge as ReturnType<typeof vi.fn>).mock.calls;
    const driverEdges = edgeCalls.filter(
      (c: unknown[]) => (c[0] as { edge_type: string }).edge_type === "metric_maps_to_value_driver"
    );
    expect(driverEdges).toHaveLength(1);
    expect(driverEdges[0][0]).toMatchObject({
      from_entity_type: "vg_metric",
      to_entity_type: "vg_value_driver",
      created_by_agent: "FinancialModelingAgent",
      organization_id: "org-456",
    });
  });

  it("writes capability_impacts_metric edge when capability node exists", async () => {
    const capNode = {
      entity_type: "vg_capability",
      entity_id: "cap-001",
      data: { id: "cap-001", name: "Supply Chain Optimization", category: "other" },
    };
    mockVgs = makeMockVgs([capNode]);

    agent = new FinancialModelingAgent(
      makeConfig(), "org-456",
      new MemorySystem({} as never) as never,
      new LLMGateway("custom") as never,
      new CircuitBreaker() as never,
      mockVgs,
    );

    await agent.execute(makeContext());

    const edgeCalls = (mockVgs.writeEdge as ReturnType<typeof vi.fn>).mock.calls;
    const capMetricEdges = edgeCalls.filter(
      (c: unknown[]) => (c[0] as { edge_type: string }).edge_type === "capability_impacts_metric"
    );
    expect(capMetricEdges).toHaveLength(1);
    expect(capMetricEdges[0][0]).toMatchObject({
      from_entity_type: "vg_capability",
      from_entity_id: "cap-001",
      to_entity_type: "vg_metric",
      created_by_agent: "FinancialModelingAgent",
    });
  });

  it("skips capability_impacts_metric edge when no capability nodes exist", async () => {
    // mockVgs already has empty capabilityNodes
    await agent.execute(makeContext());

    const edgeCalls = (mockVgs.writeEdge as ReturnType<typeof vi.fn>).mock.calls;
    const capMetricEdges = edgeCalls.filter(
      (c: unknown[]) => (c[0] as { edge_type: string }).edge_type === "capability_impacts_metric"
    );
    expect(capMetricEdges).toHaveLength(0);
  });

  it("creates a new VgValueDriver node when none exists for the mapped type", async () => {
    // No value driver nodes in graph
    await agent.execute(makeContext());

    expect(mockVgs.writeValueDriver).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "cost_reduction",
        opportunity_id: "case-001",
        organization_id: "org-456",
      })
    );
  });

  it("does not create a new VgValueDriver when one already exists for the type", async () => {
    const driverNode = {
      entity_type: "vg_value_driver",
      entity_id: "driver-existing",
      data: { id: "driver-existing", type: "cost_reduction" },
    };
    mockVgs = makeMockVgs([]);
    // Override getGraphForOpportunity to return a driver node
    (mockVgs.getGraphForOpportunity as ReturnType<typeof vi.fn>).mockResolvedValue({
      nodes: [driverNode],
      edges: [],
      opportunity_id: "case-001",
      organization_id: "org-456",
      ontology_version: "1.0",
    });

    agent = new FinancialModelingAgent(
      makeConfig(), "org-456",
      new MemorySystem({} as never) as never,
      new LLMGateway("custom") as never,
      new CircuitBreaker() as never,
      mockVgs,
    );

    await agent.execute(makeContext());

    // Should NOT write a new driver — reuse existing
    expect(mockVgs.writeValueDriver).not.toHaveBeenCalled();

    // Edge should point to the existing driver
    const edgeCalls = (mockVgs.writeEdge as ReturnType<typeof vi.fn>).mock.calls;
    const driverEdges = edgeCalls.filter(
      (c: unknown[]) => (c[0] as { edge_type: string }).edge_type === "metric_maps_to_value_driver"
    );
    expect(driverEdges[0][0]).toMatchObject({ to_entity_id: "driver-existing" });
  });

  it("existing ROI output shape is unchanged when graph writes succeed", async () => {
    const output = await agent.execute(makeContext());

    expect(output.status).toBe("success");
    expect(output.result).toHaveProperty("models");
    expect(output.result).toHaveProperty("total_npv");
    expect(output.result).toHaveProperty("models_count", 1);
    expect(output.result).toHaveProperty("average_confidence");
  });

  it("returns successful output even when graph writes fail", async () => {
    (mockVgs.writeMetric as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("DB timeout")
    );

    const output = await agent.execute(makeContext());

    expect(output.status).toBe("success");
    expect(output.result).toHaveProperty("models_count", 1);
  });

  it("returns successful output even when getGraphForOpportunity fails", async () => {
    (mockVgs.getGraphForOpportunity as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error")
    );

    const output = await agent.execute(makeContext());

    expect(output.status).toBe("success");
    expect(output.result).toHaveProperty("models_count", 1);
  });
});
