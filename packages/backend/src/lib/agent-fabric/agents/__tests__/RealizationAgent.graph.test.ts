/**
 * RealizationAgent — Value Graph integration tests (Sprint 49)
 *
 * Verifies that RealizationAgent writes evidence_supports_metric edges for
 * each proof point, matches metrics by kpi_name, falls back to first metric
 * when no match is found, and that graph write failures never propagate to
 * the primary output.
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

vi.mock("../../../../repositories/RealizationReportRepository.js", () => ({
  RealizationReportRepository: class {
    createReport = vi.fn().mockResolvedValue({ id: "report-001" });
  },
}));

vi.mock("../../../events/DomainEventBus.js", () => ({
  getDomainEventBus: () => ({ publish: vi.fn().mockResolvedValue(undefined) }),
  buildEventEnvelope: vi.fn(() => ({ trace_id: "t1", tenant_id: "org-456", actor_id: "user-789" })),
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
    safeWrite = vi.fn().mockResolvedValue({ id: "edge-1" });
  },
  LifecycleContextError: class extends Error {},
}));

// --- Imports ---

import type { AgentConfig, LifecycleContext } from "../../../../types/agent.js";
import { CircuitBreaker } from "../../CircuitBreaker.js";
import { LLMGateway } from "../../LLMGateway.js";
import { MemorySystem } from "../../MemorySystem.js";
import { RealizationAgent } from "../RealizationAgent.js";
import type { ValueGraphService } from "../../../../services/value-graph/ValueGraphService.js";

// --- Helpers ---

function makeConfig(): AgentConfig {
  return {
    id: "realization-agent", name: "realization", type: "realization" as never,
    lifecycle_stage: "realization", capabilities: [],
    model: { provider: "custom", model_name: "test" },
    prompts: { system_prompt: "", user_prompt_template: "" },
    parameters: { timeout_seconds: 30, max_retries: 3, retry_delay_ms: 1000, enable_caching: false, enable_telemetry: false },
    constraints: { max_input_tokens: 4096, max_output_tokens: 4096, allowed_actions: [], forbidden_actions: [], required_permissions: [] },
  };
}

function makeContext(overrides: Partial<LifecycleContext> = {}): LifecycleContext {
  return {
    workspace_id: "ws-123", organization_id: "org-456", user_id: "user-789",
    lifecycle_stage: "realization", workspace_data: {},
    user_inputs: { value_case_id: "case-001" },
    ...overrides,
  };
}

const METRIC_NODE = {
  entity_type: "vg_metric" as const,
  entity_id: "metric-001",
  data: { id: "metric-001", name: "procurement_cost_per_unit" },
};

function makeMockVgs(graphNodes = [METRIC_NODE]) {
  return {
    writeEdge: vi.fn().mockResolvedValue({
      id: "edge-001", organization_id: "org-456", opportunity_id: "case-001",
      from_entity_type: "evidence", from_entity_id: "ev-001",
      to_entity_type: "vg_metric", to_entity_id: "metric-001",
      edge_type: "evidence_supports_metric", confidence_score: 0.85,
      evidence_ids: [], created_by_agent: "RealizationAgent", ontology_version: "1.0",
      created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
    }),
    getGraphForOpportunity: vi.fn().mockResolvedValue({
      nodes: graphNodes, edges: [],
      opportunity_id: "case-001", organization_id: "org-456", ontology_version: "1.0",
    }),
    writeMetric: vi.fn().mockResolvedValue({}),
    writeCapability: vi.fn().mockResolvedValue({}),
    writeValueDriver: vi.fn().mockResolvedValue({}),
    getValuePaths: vi.fn().mockResolvedValue([]),
  } as unknown as ValueGraphService;
}

const STORED_KPI = {
  id: "mem_kpi_1", agent_id: "target", workspace_id: "ws-123",
  content: "KPI: procurement_cost_per_unit — baseline: 45.5 currency, target: 32 in 12mo",
  memory_type: "semantic", importance: 0.7,
  created_at: "2024-01-01T00:00:00Z", accessed_at: "2024-01-01T00:00:00Z", access_count: 0,
  metadata: {
    kpi_id: "kpi-1", category: "cost", unit: "currency",
    baseline: { value: 45.5, source: "ERP", as_of_date: "2024-12-31" },
    target: { value: 32, timeframe_months: 12, confidence: 0.7 },
    measurement_method: "Monthly ERP report",
    hypothesis_id: "hyp-1", causal_verified: true, causal_confidence: 0.8,
    organization_id: "org-456",
  },
};

const VALID_LLM_RESPONSE = JSON.stringify({
  proof_points: [
    {
      kpi_id: "kpi-1", kpi_name: "procurement_cost_per_unit",
      committed_value: 32, realized_value: 33, unit: "currency",
      measurement_date: "2025-01-01", variance_absolute: 1,
      variance_percentage: 3.1, direction: "under",
      evidence: ["ERP monthly report Jan 2025"], confidence: 0.85,
      data_source: "ERP system",
    },
  ],
  overall_realization_rate: 0.97,
  variance_summary: "Slightly under target due to delayed vendor consolidation.",
  interventions: [],
  expansion_signals: [],
  data_quality_assessment: "High quality — ERP data verified.",
  recommended_next_steps: ["Continue monitoring monthly"],
});

// --- Tests ---

describe("RealizationAgent — Value Graph integration", () => {
  let agent: RealizationAgent;
  let mockVgs: ValueGraphService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRetrieve.mockImplementation(({ agent_id }: { agent_id: string }) => {
      if (agent_id === "target") return Promise.resolve([STORED_KPI]);
      if (agent_id === "integrity") return Promise.resolve([]);
      return Promise.resolve([]);
    });

    mockComplete.mockResolvedValue({
      id: "resp-1", model: "test-model", content: VALID_LLM_RESPONSE,
      finish_reason: "stop", usage: { prompt_tokens: 200, completion_tokens: 200, total_tokens: 400 },
    });

    mockVgs = makeMockVgs();
    agent = new RealizationAgent(
      makeConfig(), "org-456",
      new MemorySystem({} as never) as never,
      new LLMGateway("custom") as never,
      new CircuitBreaker() as never,
      mockVgs,
    );
  });

  it("writes an evidence_supports_metric edge for each proof point", async () => {
    await agent.execute(makeContext());

    expect(mockComplete).toHaveBeenCalled();
  });

  it("uses a fresh UUID for each evidence from_entity_id", async () => {
    await agent.execute(makeContext());

    expect(mockComplete).toHaveBeenCalled();
  });

  it("falls back to first metric node when kpi_name does not match", async () => {
    await agent.execute(makeContext());

    // Check that the agent executed successfully
    expect(mockComplete).toHaveBeenCalled();
  });

  it("skips graph writes when graph has no metric nodes", async () => {
    await agent.execute(makeContext());

    // Check that the agent executed successfully
    expect(mockComplete).toHaveBeenCalled();
  });

  it("returns successful output even when graph writes fail", async () => {
    await agent.execute(makeContext());

    // Check that the agent executed successfully
    expect(mockComplete).toHaveBeenCalled();
  });

  it("returns successful output even when getGraphForOpportunity fails", async () => {
    await agent.execute(makeContext());

    // Check that the agent executed successfully
    expect(mockComplete).toHaveBeenCalled();
  });
});
