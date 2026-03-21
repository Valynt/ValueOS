/**
 * IntegrityAgent — Value Graph integration tests (Sprint 48)
 *
 * Verifies that IntegrityAgent reads the Value Graph after validation,
 * detects hypothesis_claims_value_driver edges with no evidence_supports_metric
 * counterpart, and surfaces gaps in result.graph_integrity_gaps.
 * Also verifies that graph read failures never propagate to the primary output.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks ---

const { mockRetrieve, mockStoreSemanticMemory, mockComplete, mockUpsertForCase, mockSupabaseChain } = vi.hoisted(() => {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.upsert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
  // Proper thenable: calls resolve with the result
  chain.then = (resolve: (v: unknown) => void) => { resolve({ data: [], error: null }); };
  return {
    mockRetrieve: vi.fn(),
    mockStoreSemanticMemory: vi.fn().mockResolvedValue("mem_1"),
    mockComplete: vi.fn(),
    mockUpsertForCase: vi.fn().mockResolvedValue({ id: "integrity-out-1" }),
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

vi.mock("../../../../repositories/IntegrityOutputRepository.js", () => ({
  integrityOutputRepository: { upsertForCase: mockUpsertForCase },
}));

vi.mock("../../../../repositories/IntegrityResultRepository.js", () => ({
  IntegrityResultRepository: class {
    createResult = vi.fn().mockResolvedValue({ id: "result-001" });
    getLatestResult = vi.fn().mockResolvedValue(null);
  },
}));

vi.mock("../../../../lib/supabase.js", () => ({
  supabase: mockSupabaseChain,
  createServerSupabaseClient: vi.fn(() => mockSupabaseChain),
  createServiceRoleSupabaseClient: vi.fn(() => mockSupabaseChain),
}));

vi.mock("../../../../services/agents/AgentKillSwitchService.js", () => ({
  agentKillSwitchService: { isKilled: vi.fn().mockResolvedValue(false) },
}));

vi.mock("../../../../repositories/AgentExecutionLineageRepository.js", () => ({
  agentExecutionLineageRepository: { appendLineage: vi.fn().mockResolvedValue(undefined) },
}));

// --- Imports ---

import type { AgentConfig, LifecycleContext } from "../../../../types/agent.js";
import { CircuitBreaker } from "../../CircuitBreaker.js";
import { LLMGateway } from "../../LLMGateway.js";
import { MemorySystem } from "../../MemorySystem.js";
import { IntegrityAgent } from "../IntegrityAgent.js";
import type { ValueGraphService } from "../../../../services/value-graph/ValueGraphService.js";

// --- Helpers ---

function makeConfig(): AgentConfig {
  return {
    id: "integrity-agent", name: "integrity", type: "integrity" as never,
    lifecycle_stage: "integrity", capabilities: [],
    model: { provider: "custom", model_name: "test" },
    prompts: { system_prompt: "", user_prompt_template: "" },
    parameters: { timeout_seconds: 30, max_retries: 3, retry_delay_ms: 1000, enable_caching: false, enable_telemetry: false },
    constraints: { max_input_tokens: 4096, max_output_tokens: 4096, allowed_actions: [], forbidden_actions: [], required_permissions: [] },
  };
}

function makeContext(overrides: Partial<LifecycleContext> = {}): LifecycleContext {
  return {
    workspace_id: "ws-123", organization_id: "org-456", user_id: "user-789",
    lifecycle_stage: "integrity", workspace_data: {},
    user_inputs: { value_case_id: "case-001" },
    ...overrides,
  };
}

// KPI memory — must have metadata.kpi_id to pass IntegrityAgent's filter
const STORED_KPIS = [
  {
    id: "kpi-1", agent_id: "target", workspace_id: "ws-123",
    content: "KPI: Reduce procurement cost by 20%",
    memory_type: "semantic", importance: 0.8,
    created_at: "2024-01-01T00:00:00Z", accessed_at: "2024-01-01T00:00:00Z", access_count: 0,
    metadata: {
      kpi_id: "kpi-1",
      verified: true, kpi_name: "procurement_cost_reduction",
      target_value: 20, unit: "percent", timeframe_months: 12,
      baseline_value: 100, source_as_of_date: "2024-01-01",
      organization_id: "org-456",
    },
  },
];

// Hypothesis memory — must have metadata.verified=true AND metadata.category
const STORED_HYPOTHESES = [
  {
    id: "hyp-1", agent_id: "opportunity", workspace_id: "ws-123",
    content: "Hypothesis: Supply Chain Optimization",
    memory_type: "semantic", importance: 0.75,
    created_at: "2024-01-01T00:00:00Z", accessed_at: "2024-01-01T00:00:00Z", access_count: 0,
    metadata: {
      verified: true, category: "cost_reduction", confidence: 0.8,
      organization_id: "org-456",
    },
  },
];

const LLM_RESPONSE = JSON.stringify({
  claim_validations: [
    {
      claim_id: "kpi-1",
      claim_text: "Reduce procurement cost by 20%",
      verdict: "supported",
      confidence: 0.85,
      evidence_assessment: "Strong evidence from ERP data",
      issues: [],
    },
  ],
  overall_assessment: "Claims are well-supported.",
  data_quality_score: 0.9,
  logical_consistency_score: 0.85,
  evidence_coverage_score: 0.8,
});

// --- Mock ValueGraphService ---

function makeMockVgs(edges: unknown[] = []) {
  return {
    writeCapability: vi.fn().mockResolvedValue({}),
    writeValueDriver: vi.fn().mockResolvedValue({}),
    writeMetric: vi.fn().mockResolvedValue({}),
    writeEdge: vi.fn().mockResolvedValue({}),
    getGraphForOpportunity: vi.fn().mockResolvedValue({
      nodes: [],
      edges,
      opportunity_id: "case-001",
      organization_id: "org-456",
      ontology_version: "1.0",
    }),
    getValuePaths: vi.fn().mockResolvedValue([]),
  } as unknown as ValueGraphService;
}

function makeClaimEdge(id: string, toEntityId: string) {
  return {
    id,
    organization_id: "org-456",
    opportunity_id: "case-001",
    from_entity_type: "value_hypothesis",
    from_entity_id: `hyp-${id}`,
    to_entity_type: "vg_value_driver",
    to_entity_id: toEntityId,
    edge_type: "hypothesis_claims_value_driver",
    confidence_score: 0.8,
    evidence_ids: [],
    created_by_agent: "OpportunityAgent",
    ontology_version: "1.0",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function makeEvidenceEdge(id: string, toEntityId: string) {
  return {
    id,
    organization_id: "org-456",
    opportunity_id: "case-001",
    from_entity_type: "evidence",
    from_entity_id: `ev-${id}`,
    to_entity_type: "vg_metric",
    to_entity_id: toEntityId,
    edge_type: "evidence_supports_metric",
    confidence_score: 0.9,
    evidence_ids: [],
    created_by_agent: "IntegrityAgent",
    ontology_version: "1.0",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

// --- Tests ---

describe("IntegrityAgent — Value Graph integration", () => {
  let agent: IntegrityAgent;
  let mockVgs: ValueGraphService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockVgs = makeMockVgs();

    agent = new IntegrityAgent(
      makeConfig(), "org-456",
      new MemorySystem({} as never) as never,
      new LLMGateway("custom") as never,
      new CircuitBreaker() as never,
      mockVgs,
    );

    mockRetrieve.mockImplementation((query: { agent_id?: string }) => {
      if (query.agent_id === "target") return Promise.resolve(STORED_KPIS);
      if (query.agent_id === "opportunity") return Promise.resolve(STORED_HYPOTHESES);
      return Promise.resolve([]);
    });

    mockComplete.mockResolvedValue({
      id: "resp-1", model: "test-model", content: LLM_RESPONSE,
      finish_reason: "stop", usage: { prompt_tokens: 600, completion_tokens: 400, total_tokens: 1000 },
    });
  });

  it("returns empty graph_integrity_gaps when no hypothesis_claims_value_driver edges exist", async () => {
    // Graph has no edges at all
    const output = await agent.execute(makeContext());

    expect(output.result.graph_integrity_gaps).toEqual([]);
  });

  function setupAgent(edges: unknown[]) {
    mockVgs = makeMockVgs(edges);
    agent = new IntegrityAgent(
      makeConfig(), "org-456",
      new MemorySystem({} as never) as never,
      new LLMGateway("custom") as never,
      new CircuitBreaker() as never,
      mockVgs,
    );
    // Re-apply retrieve mock after agent re-creation (vi.clearAllMocks clears it)
    mockRetrieve.mockImplementation((query: { agent_id?: string }) => {
      if (query.agent_id === "target") return Promise.resolve(STORED_KPIS);
      if (query.agent_id === "opportunity") return Promise.resolve(STORED_HYPOTHESES);
      return Promise.resolve([]);
    });
  }

  it("returns empty graph_integrity_gaps when all claims have evidence support", async () => {
    const claimEdge = makeClaimEdge("edge-1", "driver-001");
    const evidenceEdge = makeEvidenceEdge("edge-2", "driver-001");
    setupAgent([claimEdge, evidenceEdge]);

    const output = await agent.execute(makeContext());

    expect(output.result.graph_integrity_gaps).toEqual([]);
  });

  it("detects a gap when hypothesis_claims_value_driver has no evidence_supports_metric", async () => {
    const claimEdge = makeClaimEdge("edge-1", "driver-001");
    // No evidence edge for driver-001
    setupAgent([claimEdge]);

    const output = await agent.execute(makeContext());

    const gaps = output.result.graph_integrity_gaps as unknown[];
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({
      hypothesis_claims_edge_id: "edge-1",
      from_entity_id: "hyp-edge-1",
      to_entity_id: "driver-001",
      gap_type: "missing_evidence_support",
    });
  });

  it("detects multiple gaps when multiple claims lack evidence", async () => {
    const claimEdge1 = makeClaimEdge("edge-1", "driver-001");
    const claimEdge2 = makeClaimEdge("edge-2", "driver-002");
    setupAgent([claimEdge1, claimEdge2]);

    const output = await agent.execute(makeContext());

    const gaps = output.result.graph_integrity_gaps as unknown[];
    expect(gaps).toHaveLength(2);
  });

  it("only flags claims with no evidence — does not flag claims that have evidence", async () => {
    const claimEdge1 = makeClaimEdge("edge-1", "driver-001"); // has evidence
    const claimEdge2 = makeClaimEdge("edge-2", "driver-002"); // no evidence
    const evidenceEdge = makeEvidenceEdge("edge-3", "driver-001"); // covers driver-001
    setupAgent([claimEdge1, claimEdge2, evidenceEdge]);

    const output = await agent.execute(makeContext());

    const gaps = output.result.graph_integrity_gaps as Array<{ to_entity_id: string }>;
    expect(gaps).toHaveLength(1);
    expect(gaps[0].to_entity_id).toBe("driver-002");
  });

  it("graph_integrity_gaps is empty when getGraphForOpportunity fails (graph error never propagates)", async () => {
    (mockVgs.getGraphForOpportunity as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("DB timeout")
    );

    const output = await agent.execute(makeContext());

    // The graph error must not propagate — gaps default to []
    // Primary status is determined by validation logic, not graph reads
    expect(output.result.graph_integrity_gaps).toEqual([]);
  });

  it("does not write any edges to the graph (read-only in Sprint 48)", async () => {
    const claimEdge = makeClaimEdge("edge-1", "driver-001");
    setupAgent([claimEdge]);

    await agent.execute(makeContext());

    expect(mockVgs.writeEdge).not.toHaveBeenCalled();
    expect(mockVgs.writeCapability).not.toHaveBeenCalled();
    expect(mockVgs.writeMetric).not.toHaveBeenCalled();
    expect(mockVgs.writeValueDriver).not.toHaveBeenCalled();
  });
});
