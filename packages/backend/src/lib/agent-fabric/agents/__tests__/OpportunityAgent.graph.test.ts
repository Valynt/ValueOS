/**
 * OpportunityAgent — Value Graph integration tests (Sprint 48)
 *
 * Verifies that OpportunityAgent writes VgCapability + VgValueDriver nodes
 * and use_case_enabled_by_capability + hypothesis_claims_value_driver edges to the
 * Value Graph after a successful run, and that graph write failures never
 * propagate to the primary output.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks (must be before imports) ---

vi.mock("../../../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../LLMGateway.js", () => ({
  LLMGateway: class {
    constructor(_provider?: string) {}
    complete = vi.fn();
  },
}));

vi.mock("../../MemorySystem.js", () => ({
  MemorySystem: class {
    constructor(_config?: unknown) {}
    store = vi.fn().mockResolvedValue("mem_1");
    retrieve = vi.fn().mockResolvedValue([]);
    storeSemanticMemory = vi.fn().mockResolvedValue("mem_1");
    clear = vi.fn().mockResolvedValue(0);
  },
}));

vi.mock("../../CircuitBreaker.js", () => ({
  CircuitBreaker: class {
    constructor() {}
    execute = vi.fn().mockImplementation((fn: () => Promise<unknown>) => fn());
  },
}));

vi.mock("../../../../services/agents/AgentKillSwitchService.js", () => ({
  agentKillSwitchService: { isKilled: vi.fn().mockResolvedValue(false) },
}));

vi.mock("../../../../repositories/AgentExecutionLineageRepository.js", () => ({
  agentExecutionLineageRepository: { appendLineage: vi.fn().mockResolvedValue(undefined) },
}));

const { mockGetFinancialData } = vi.hoisted(() => ({
  mockGetFinancialData: vi.fn(),
}));
vi.mock("../../../../services/MCPGroundTruthService.js", () => ({
  mcpGroundTruthService: {
    getFinancialData: mockGetFinancialData,
    verifyClaim: vi.fn().mockResolvedValue({ verified: false, confidence: 0 }),
    getIndustryBenchmarks: vi.fn().mockResolvedValue(null),
    initialize: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("../../../../services/domain-packs/MCPGroundTruthService.js", () => ({
  mcpGroundTruthService: {
    getFinancialData: mockGetFinancialData,
    verifyClaim: vi.fn().mockResolvedValue({ verified: false, confidence: 0 }),
    getIndustryBenchmarks: vi.fn().mockResolvedValue(null),
    initialize: vi.fn().mockResolvedValue(undefined),
  },
}));

// --- Imports ---

import type { AgentConfig, LifecycleContext } from "../../../../types/agent.js";
import { CircuitBreaker } from "../../CircuitBreaker.js";
import { LLMGateway } from "../../LLMGateway.js";
import { MemorySystem } from "../../MemorySystem.js";
import { OpportunityAgent } from "../OpportunityAgent.js";
import type { ValueGraphService } from "../../../../services/value-graph/ValueGraphService.js";

// --- Helpers ---

function makeConfig(): AgentConfig {
  return {
    id: "opportunity-agent",
    name: "opportunity",
    type: "opportunity" as never,
    lifecycle_stage: "opportunity",
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
    lifecycle_stage: "opportunity",
    workspace_data: {},
    user_inputs: {
      query: "Analyze Acme Corp for cost reduction opportunities",
      value_case_id: "case-001",
    },
    ...overrides,
  };
}

function makeVgsWriteChain(returnData: unknown) {
  return {
    insert: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: returnData, error: null }),
  };
}

const VALID_LLM_RESPONSE = JSON.stringify({
  company_summary: "Acme Corp is a mid-market manufacturing company.",
  industry_context: "Manufacturing sector facing margin pressure.",
  hypotheses: [
    {
      title: "Supply Chain Optimization",
      description: "Reduce procurement costs through vendor consolidation.",
      category: "cost_reduction",
      estimated_impact: { low: 500000, high: 1200000, unit: "usd", timeframe_months: 12 },
      confidence: 0.75,
      evidence: ["Current vendor count exceeds industry median by 40%"],
      assumptions: ["Vendor consolidation is feasible within 6 months"],
      kpi_targets: ["procurement_cost_per_unit"],
    },
    {
      title: "Revenue Expansion",
      description: "Upsell premium tier to existing accounts.",
      category: "revenue_growth",
      estimated_impact: { low: 200000, high: 600000, unit: "usd", timeframe_months: 6 },
      confidence: 0.8,
      evidence: ["30% of accounts eligible for premium tier"],
      assumptions: ["Sales team capacity available"],
      kpi_targets: ["arr_expansion"],
    },
  ],
  stakeholder_roles: [{ role: "VP Operations", relevance: "Owns supply chain", likely_concerns: ["ROI"] }],
  recommended_next_steps: ["Schedule discovery call"],
});

// --- Mock ValueGraphService ---

function makeMockVgs() {
  const capabilityResult = { id: "cap-001", organization_id: "org-456", opportunity_id: "case-001", name: "Supply Chain Optimization", description: "Reduce procurement costs", category: "other", ontology_version: "1.0", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" };
  const driverResult = { id: "driver-001", organization_id: "org-456", opportunity_id: "case-001", type: "cost_reduction", name: "Supply Chain Optimization", description: "Reduce procurement costs", ontology_version: "1.0", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" };
  const edgeResult = { id: "edge-001", organization_id: "org-456", opportunity_id: "case-001", from_entity_type: "use_case", from_entity_id: "case-001", to_entity_type: "vg_capability", to_entity_id: "cap-001", edge_type: "use_case_enabled_by_capability", confidence_score: 0.75, evidence_ids: [], created_by_agent: "OpportunityAgent", ontology_version: "1.0", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" };

  return {
    writeCapability: vi.fn().mockResolvedValue(capabilityResult),
    writeValueDriver: vi.fn().mockResolvedValue(driverResult),
    writeMetric: vi.fn().mockResolvedValue({}),
    writeEdge: vi.fn().mockResolvedValue(edgeResult),
    getGraphForOpportunity: vi.fn().mockResolvedValue({ nodes: [], edges: [], opportunity_id: "case-001", organization_id: "org-456", ontology_version: "1.0" }),
    getValuePaths: vi.fn().mockResolvedValue([]),
  } as unknown as ValueGraphService;
}

// --- Tests ---

describe("OpportunityAgent — Value Graph integration", () => {
  let agent: OpportunityAgent;
  let mockLLM: InstanceType<typeof LLMGateway>;
  let mockMemory: InstanceType<typeof MemorySystem>;
  let mockVgs: ValueGraphService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLLM = new LLMGateway("custom") as never;
    mockMemory = new MemorySystem({} as never) as never;
    mockVgs = makeMockVgs();

    agent = new OpportunityAgent(
      makeConfig(),
      "org-456",
      mockMemory as never,
      mockLLM as never,
      new CircuitBreaker() as never,
      mockVgs,
    );

    (mockLLM as never as { complete: ReturnType<typeof vi.fn> }).complete.mockResolvedValue({
      id: "resp-1", model: "test-model", content: VALID_LLM_RESPONSE,
      finish_reason: "stop", usage: { prompt_tokens: 500, completion_tokens: 300, total_tokens: 800 },
    });
    mockGetFinancialData.mockResolvedValue(null);
  });

  it("writes a VgCapability node for each hypothesis", async () => {
    await agent.execute(makeContext());

    // 2 hypotheses → 2 capability writes
    expect(mockVgs.writeCapability).toHaveBeenCalledTimes(2);
    expect(mockVgs.writeCapability).toHaveBeenCalledWith(
      expect.objectContaining({
        opportunity_id: "case-001",
        organization_id: "org-456",
        name: "Supply Chain Optimization",
        category: "other",
      })
    );
  });

  it("writes a VgValueDriver node with the correct mapped type", async () => {
    await agent.execute(makeContext());

    expect(mockVgs.writeValueDriver).toHaveBeenCalledTimes(2);

    const calls = (mockVgs.writeValueDriver as ReturnType<typeof vi.fn>).mock.calls;
    const costReductionCall = calls.find((c: unknown[]) => (c[0] as { type: string }).type === "cost_reduction");
    const revenueCall = calls.find((c: unknown[]) => (c[0] as { type: string }).type === "revenue_growth");

    expect(costReductionCall).toBeDefined();
    expect(revenueCall).toBeDefined();
  });

  it("writes use_case_enabled_by_capability edges", async () => {
    await agent.execute(makeContext());

    const edgeCalls = (mockVgs.writeEdge as ReturnType<typeof vi.fn>).mock.calls;
    const ucCapEdges = edgeCalls.filter(
      (c: unknown[]) => (c[0] as { edge_type: string }).edge_type === "use_case_enabled_by_capability"
    );
    expect(ucCapEdges).toHaveLength(2);
    expect(ucCapEdges[0][0]).toMatchObject({
      from_entity_type: "use_case",
      to_entity_type: "vg_capability",
      created_by_agent: "OpportunityAgent",
      organization_id: "org-456",
    });
  });

  it("writes hypothesis_claims_value_driver edges", async () => {
    await agent.execute(makeContext());

    const edgeCalls = (mockVgs.writeEdge as ReturnType<typeof vi.fn>).mock.calls;
    const claimEdges = edgeCalls.filter(
      (c: unknown[]) => (c[0] as { edge_type: string }).edge_type === "hypothesis_claims_value_driver"
    );
    expect(claimEdges).toHaveLength(2);
    expect(claimEdges[0][0]).toMatchObject({
      from_entity_type: "value_hypothesis",
      to_entity_type: "vg_value_driver",
      created_by_agent: "OpportunityAgent",
    });
    // from_entity_id must always be a valid UUID — never a plain string fallback
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(claimEdges[0][0].from_entity_id).toMatch(uuidRegex);
    expect(claimEdges[1][0].from_entity_id).toMatch(uuidRegex);
  });

  it("sets confidence_score from hypothesis.confidence", async () => {
    await agent.execute(makeContext());

    const edgeCalls = (mockVgs.writeEdge as ReturnType<typeof vi.fn>).mock.calls;
    const ucCapEdges = edgeCalls.filter(
      (c: unknown[]) => (c[0] as { edge_type: string }).edge_type === "use_case_enabled_by_capability"
    );
    // First hypothesis has confidence 0.75
    expect(ucCapEdges[0][0]).toMatchObject({ confidence_score: 0.75 });
    // Second hypothesis has confidence 0.8
    expect(ucCapEdges[1][0]).toMatchObject({ confidence_score: 0.8 });
  });

  it("returns successful output even when graph writes fail", async () => {
    (mockVgs.writeCapability as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("DB connection lost")
    );

    const output = await agent.execute(makeContext());

    // Primary output must succeed
    expect(output.status).toBe("success");
    expect(output.result).toHaveProperty("hypotheses");
    expect((output.result.hypotheses as unknown[]).length).toBe(2);
  });

  it("maps operational_efficiency category to cost_reduction driver type", async () => {
    const responseWithEfficiency = JSON.stringify({
      company_summary: "Test",
      industry_context: "Test",
      hypotheses: [{
        title: "Process Automation",
        description: "Automate manual workflows.",
        category: "operational_efficiency",
        estimated_impact: { low: 100000, high: 300000, unit: "usd", timeframe_months: 6 },
        confidence: 0.7,
        evidence: ["Manual processes identified"],
        assumptions: [],
        kpi_targets: [],
      }],
      stakeholder_roles: [],
      recommended_next_steps: [],
    });

    (mockLLM as never as { complete: ReturnType<typeof vi.fn> }).complete.mockResolvedValue({
      id: "resp-2", model: "test-model", content: responseWithEfficiency,
      finish_reason: "stop", usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
    });

    await agent.execute(makeContext());

    expect(mockVgs.writeValueDriver).toHaveBeenCalledWith(
      expect.objectContaining({ type: "cost_reduction" })
    );
  });

  it("maps risk_mitigation category correctly", async () => {
    const responseWithRisk = JSON.stringify({
      company_summary: "Test",
      industry_context: "Test",
      hypotheses: [{
        title: "Compliance Risk Reduction",
        description: "Reduce regulatory exposure.",
        category: "risk_mitigation",
        estimated_impact: { low: 50000, high: 200000, unit: "usd", timeframe_months: 3 },
        confidence: 0.6,
        evidence: ["Audit findings"],
        assumptions: [],
        kpi_targets: [],
      }],
      stakeholder_roles: [],
      recommended_next_steps: [],
    });

    (mockLLM as never as { complete: ReturnType<typeof vi.fn> }).complete.mockResolvedValue({
      id: "resp-3", model: "test-model", content: responseWithRisk,
      finish_reason: "stop", usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
    });

    await agent.execute(makeContext());

    expect(mockVgs.writeValueDriver).toHaveBeenCalledWith(
      expect.objectContaining({ type: "risk_mitigation" })
    );
  });
});
