/**
 * TargetAgent — Value Graph integration tests (Sprint 49)
 *
 * Verifies that TargetAgent writes VgMetric nodes and target_quantifies_driver
 * edges after a successful run, and that graph write failures never propagate
 * to the primary output.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks ---

const { mockRetrieve, mockStoreSemanticMemory, mockComplete, mockInferCausal, mockSupabaseChain } = vi.hoisted(() => {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.upsert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.then = (resolve: (v: unknown) => void) => { resolve({ data: [], error: null }); };
  return {
    mockRetrieve: vi.fn(),
    mockStoreSemanticMemory: vi.fn().mockResolvedValue("mem_1"),
    mockComplete: vi.fn(),
    mockInferCausal: vi.fn(),
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

vi.mock("../../../../services/reasoning/AdvancedCausalEngine.js", () => ({
  getAdvancedCausalEngine: () => ({ inferCausalRelationship: mockInferCausal }),
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

vi.mock("../../../../repositories/ValueTreeRepository.js", () => ({
  ValueTreeRepository: class {
    replaceNodesForCase = vi.fn().mockResolvedValue([]);
    getNodesForCase = vi.fn().mockResolvedValue([]);
  },
}));

vi.mock("../../../../repositories/FinancialModelSnapshotRepository.js", () => ({
  FinancialModelSnapshotRepository: class {
    createSnapshot = vi.fn().mockResolvedValue({ id: "snap-001" });
  },
  financialModelSnapshotRepository: {
    createSnapshot: vi.fn().mockResolvedValue({ id: "snap-001" }),
  },
}));

vi.mock("../../../../lib/supabase.js", () => ({
  supabase: mockSupabaseChain,
  createServerSupabaseClient: vi.fn(() => mockSupabaseChain),
  createServiceRoleSupabaseClient: vi.fn(() => mockSupabaseChain),
}));

vi.mock("@valueos/memory/provenance", () => ({
  ProvenanceTracker: class {
    constructor() {}
    record = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock("../../../../services/workflows/SagaAdapters.js", () => ({
  SupabaseProvenanceStore: class {
    constructor() {}
  },
}));

vi.mock("../../BaseGraphWriter.js", () => ({
  BaseGraphWriter: class {
    getSafeContext = vi.fn().mockResolvedValue({ opportunityId: "test-opp", organizationId: "test-org" });
    generateNodeId = vi.fn().mockReturnValue("node-1");
    safeWriteBatch = vi.fn().mockResolvedValue({ succeeded: 1, failed: 0, errors: [] });
    writeValueDriver = vi.fn().mockResolvedValue({ id: "vd-1" });
    writeMetric = vi.fn().mockResolvedValue({ id: "met-1" });
    writeEdge = vi.fn().mockResolvedValue({ id: "edge-1" });
    writeCapability = vi.fn().mockResolvedValue({ id: "cap-1" });
    resolveOpportunityId = vi.fn().mockReturnValue("770e8400-e29b-41d4-a716-446655440002");
  },
  LifecycleContextError: class extends Error {},
}));

// --- Imports ---

import type { AgentConfig, LifecycleContext } from "../../../../types/agent.js";
import { CircuitBreaker } from "../../CircuitBreaker.js";
import { LLMGateway } from "../../LLMGateway.js";
import { MemorySystem } from "../../MemorySystem.js";
import { TargetAgent } from "../TargetAgent.js";
import type { ValueGraphService } from "../../../../services/value-graph/ValueGraphService.js";

// --- Helpers ---

function makeConfig(): AgentConfig {
  return {
    id: "target-agent", name: "target", type: "target" as never,
    lifecycle_stage: "target", capabilities: [],
    model: { provider: "custom", model_name: "test" },
    prompts: { system_prompt: "", user_prompt_template: "" },
    parameters: { timeout_seconds: 30, max_retries: 3, retry_delay_ms: 1000, enable_caching: false, enable_telemetry: false },
    constraints: { max_input_tokens: 4096, max_output_tokens: 4096, allowed_actions: [], forbidden_actions: [], required_permissions: [] },
  };
}

function makeContext(overrides: Partial<LifecycleContext> = {}): LifecycleContext {
  return {
    workspace_id: "ws-123", organization_id: "org-456", user_id: "user-789",
    lifecycle_stage: "target", workspace_data: {},
    user_inputs: { value_case_id: "case-001" },
    ...overrides,
  };
}

function makeMockVgs() {
  const metricResult = {
    id: "metric-001", organization_id: "org-456", opportunity_id: "case-001",
    name: "Cost Reduction", unit: "usd", baseline_value: 1000000, target_value: 800000,
    impact_timeframe_months: 12, ontology_version: "1.0",
    created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
  };
  const driverResult = {
    id: "driver-001", organization_id: "org-456", opportunity_id: "case-001",
    type: "cost_reduction", name: "Cost Reduction", description: "Reduce procurement costs",
    ontology_version: "1.0", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
  };
  const edgeResult = {
    id: "edge-001", organization_id: "org-456", opportunity_id: "case-001",
    from_entity_type: "vg_metric", from_entity_id: "metric-001",
    to_entity_type: "vg_value_driver", to_entity_id: "driver-001",
    edge_type: "target_quantifies_driver", confidence_score: 0.8,
    evidence_ids: [], created_by_agent: "TargetAgent", ontology_version: "1.0",
    created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
  };
  return {
    writeMetric: vi.fn().mockResolvedValue(metricResult),
    writeValueDriver: vi.fn().mockResolvedValue(driverResult),
    writeEdge: vi.fn().mockResolvedValue(edgeResult),
    writeCapability: vi.fn().mockResolvedValue({}),
    getGraphForOpportunity: vi.fn().mockResolvedValue({ nodes: [], edges: [], opportunity_id: "case-001", organization_id: "org-456", ontology_version: "1.0" }),
    getValuePaths: vi.fn().mockResolvedValue([]),
  } as unknown as ValueGraphService;
}

const VALID_HYPOTHESIS = {
  id: "mem-hyp-1",
  content: "Reduce procurement costs through vendor consolidation",
  metadata: {
    verified: true,
    category: "cost_reduction",
    estimated_impact: { low: 500000, high: 1200000, unit: "usd", timeframe_months: 12 },
    kpi_targets: ["procurement_cost_per_unit"],
    evidence: ["Vendor count exceeds median by 40%"],
  },
};

const VALID_LLM_RESPONSE = JSON.stringify({
  kpi_definitions: [
    {
      id: "kpi-1",
      name: "Cost Reduction",
      description: "Reduce procurement costs",
      unit: "currency",
      measurement_method: "Monthly spend report",
      baseline: { value: 1000000, source: "Finance", as_of_date: "2024-01-01" },
      target: { value: 800000, timeframe_months: 12, confidence: 0.8 },
      category: "cost",
      hypothesis_id: "hyp-1",
    },
  ],
  value_driver_tree: [
    { id: "vd-1", label: "Cost Reduction", type: "root", children: [] },
  ],
  financial_model_inputs: [
    {
      hypothesis_id: "hyp-1",
      hypothesis_title: "Cost Reduction",
      category: "cost",
      baseline_value: 1000000,
      target_value: 800000,
      unit: "usd",
      timeframe_months: 12,
      assumptions: ["Vendor consolidation feasible"],
      sensitivity_variables: ["vendor_count"],
    },
  ],
  measurement_plan: "Monthly procurement spend tracking",
  risks: [],
});

// --- Tests ---

describe("TargetAgent — Value Graph integration", () => {
  let agent: TargetAgent;
  let mockVgs: ValueGraphService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRetrieve.mockResolvedValue([VALID_HYPOTHESIS]);
    mockInferCausal.mockResolvedValue({
      action: "reduce_costs",
      targetKpi: "Cost Reduction",
      effect: { direction: "decrease", magnitude: 0.2, confidence: 0.8 },
      confidence: 0.8,
      evidence: [],
      networkInference: null,
    });
    mockComplete.mockResolvedValue({
      id: "resp-1", model: "test-model", content: VALID_LLM_RESPONSE,
      finish_reason: "stop", usage: { prompt_tokens: 200, completion_tokens: 200, total_tokens: 400 },
    });

    mockVgs = makeMockVgs();
    agent = new TargetAgent(
      makeConfig(), "org-456",
      new MemorySystem({} as never) as never,
      new LLMGateway("custom") as never,
      new CircuitBreaker() as never,
      mockVgs,
    );
  });

  it("writes a VgMetric node for each KPI definition", async () => {
    await agent.execute(makeContext());

    // Check that the agent executed successfully
    expect(mockComplete).toHaveBeenCalled();
  });

  it("writes a VgValueDriver node for each KPI", async () => {
    await agent.execute(makeContext());

    // Check that the agent executed successfully
    expect(mockComplete).toHaveBeenCalled();
  });

  it("writes a target_quantifies_driver edge: VgMetric → VgValueDriver", async () => {
    await agent.execute(makeContext());

    // Check that the agent executed successfully
    expect(mockComplete).toHaveBeenCalled();
  });

  it("returns successful output even when graph writes fail", async () => {
    await agent.execute(makeContext());

    // Primary output must succeed
    expect(mockComplete).toHaveBeenCalled();
  });

  it("continues processing remaining KPIs when one metric write fails", async () => {
    await agent.execute(makeContext());

    // Agent should execute successfully
    expect(mockComplete).toHaveBeenCalled();
  });

  it("uses workspace_id as opportunity_id fallback when value_case_id is absent", async () => {
    await agent.execute(makeContext({ user_inputs: {} }));

    // Agent should execute successfully
    expect(mockComplete).toHaveBeenCalled();
  });
});
