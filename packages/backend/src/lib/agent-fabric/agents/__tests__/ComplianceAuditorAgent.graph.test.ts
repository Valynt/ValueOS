/**
 * ComplianceAuditorAgent — Value Graph integration tests (Sprint 49)
 *
 * Verifies that ComplianceAuditorAgent:
 *   - reads the graph for prompt context
 *   - writes one audit_verifies_node edge per VgValueDriver node
 *   - uses controlCoverageScore as confidence_score for all audit edges
 *   - graph read failure falls back to memory heuristic (no regression)
 *   - graph write failure never propagates to the primary output
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

// --- Imports ---

import type { AgentConfig, LifecycleContext } from "../../../../types/agent.js";
import { CircuitBreaker } from "../../CircuitBreaker.js";
import { LLMGateway } from "../../LLMGateway.js";
import { MemorySystem } from "../../MemorySystem.js";
import { ComplianceAuditorAgent } from "../ComplianceAuditorAgent.js";
import type { ValueGraphService } from "../../../../services/value-graph/ValueGraphService.js";

// --- Helpers ---

function makeConfig(): AgentConfig {
  return {
    id: "compliance-auditor", name: "compliance-auditor", type: "compliance_auditor" as never,
    lifecycle_stage: "validating", capabilities: [],
    model: { provider: "custom", model_name: "test" },
    prompts: { system_prompt: "", user_prompt_template: "" },
    parameters: { timeout_seconds: 30, max_retries: 3, retry_delay_ms: 1000, enable_caching: false, enable_telemetry: false },
    constraints: { max_input_tokens: 4096, max_output_tokens: 4096, allowed_actions: [], forbidden_actions: [], required_permissions: [] },
  };
}

function makeContext(overrides: Partial<LifecycleContext> = {}): LifecycleContext {
  return {
    workspace_id: "ws-123", organization_id: "org-456", user_id: "user-789",
    lifecycle_stage: "validating", workspace_data: {},
    user_inputs: { value_case_id: "case-001" },
    ...overrides,
  };
}

const DRIVER_NODE_1 = {
  entity_type: "vg_value_driver" as const,
  entity_id: "driver-001",
  data: { id: "driver-001", name: "Cost Reduction", type: "cost_reduction" },
};
const DRIVER_NODE_2 = {
  entity_type: "vg_value_driver" as const,
  entity_id: "driver-002",
  data: { id: "driver-002", name: "Revenue Growth", type: "revenue_growth" },
};
const METRIC_NODE = {
  entity_type: "vg_metric" as const,
  entity_id: "metric-001",
  data: { id: "metric-001", name: "Procurement Cost" },
};

function makeMockVgs(driverNodes = [DRIVER_NODE_1, DRIVER_NODE_2]) {
  return {
    getGraphForOpportunity: vi.fn().mockResolvedValue({
      nodes: [...driverNodes, METRIC_NODE],
      edges: [],
      opportunity_id: "case-001",
      organization_id: "org-456",
      ontology_version: "1.0",
    }),
    writeEdge: vi.fn().mockResolvedValue({
      id: "edge-001", organization_id: "org-456", opportunity_id: "case-001",
      from_entity_type: "evidence", from_entity_id: "ev-001",
      to_entity_type: "vg_value_driver", to_entity_id: "driver-001",
      edge_type: "audit_verifies_node", confidence_score: 0.833,
      evidence_ids: [], created_by_agent: "ComplianceAuditorAgent", ontology_version: "1.0",
      created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
    }),
    writeMetric: vi.fn().mockResolvedValue({}),
    writeCapability: vi.fn().mockResolvedValue({}),
    writeValueDriver: vi.fn().mockResolvedValue({}),
    getValuePaths: vi.fn().mockResolvedValue([]),
  } as unknown as ValueGraphService;
}

const VALID_LLM_RESPONSE = JSON.stringify({
  summary: "5 of 6 sources covered. Compliance posture is strong.",
  control_gaps: ["Missing deterministic evidence for expansion"],
  recommended_actions: ["Run ExpansionAgent to fill coverage gap"],
});

// --- Tests ---

describe("ComplianceAuditorAgent — Value Graph integration", () => {
  let agent: ComplianceAuditorAgent;
  let mockVgs: ValueGraphService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Return some evidence for most sources
    mockRetrieve.mockImplementation(({ agent_id }: { agent_id: string }) => {
      if (agent_id === "expansion") return Promise.resolve([]);
      return Promise.resolve([{
        id: `mem-${agent_id}`, agent_id, workspace_id: "ws-123",
        content: `Evidence from ${agent_id}`,
        memory_type: "semantic", importance: 0.7,
        created_at: "2024-01-01T00:00:00Z", accessed_at: "2024-01-01T00:00:00Z", access_count: 0,
        metadata: { organization_id: "org-456" },
      }]);
    });

    mockComplete.mockResolvedValue({
      id: "resp-1", model: "test-model", content: VALID_LLM_RESPONSE,
      finish_reason: "stop", usage: { prompt_tokens: 200, completion_tokens: 200, total_tokens: 400 },
    });

    mockVgs = makeMockVgs();
    agent = new ComplianceAuditorAgent(
      makeConfig(), "org-456",
      new MemorySystem({} as never) as never,
      new LLMGateway("custom") as never,
      new CircuitBreaker() as never,
      mockVgs,
    );
  });

  it("reads the graph for prompt context", async () => {
    await agent.execute(makeContext());

    expect(mockVgs.getGraphForOpportunity).toHaveBeenCalledWith("case-001", "org-456");
  });

  it("writes one audit_verifies_node edge per VgValueDriver node", async () => {
    await agent.execute(makeContext());

    // 2 driver nodes → 2 audit edges
    expect(mockVgs.writeEdge).toHaveBeenCalledTimes(2);
    expect(mockVgs.writeEdge).toHaveBeenCalledWith(
      expect.objectContaining({
        edge_type: "audit_verifies_node",
        from_entity_type: "evidence",
        to_entity_type: "vg_value_driver",
        created_by_agent: "ComplianceAuditorAgent",
        organization_id: "org-456",
        opportunity_id: "case-001",
      }),
    );
  });

  it("targets each driver node by its entity_id", async () => {
    await agent.execute(makeContext());

    const calls = (mockVgs.writeEdge as ReturnType<typeof vi.fn>).mock.calls;
    const targetIds = calls.map((c: unknown[]) => (c[0] as { to_entity_id: string }).to_entity_id);
    expect(targetIds).toContain("driver-001");
    expect(targetIds).toContain("driver-002");
  });

  it("uses controlCoverageScore as confidence_score for all audit edges", async () => {
    await agent.execute(makeContext());

    const calls = (mockVgs.writeEdge as ReturnType<typeof vi.fn>).mock.calls;
    // 5 of 6 sources covered → score = 5/6 ≈ 0.833
    const expectedScore = Number((5 / 6).toFixed(3));
    for (const call of calls) {
      expect((call[0] as { confidence_score: number }).confidence_score).toBeCloseTo(expectedScore, 2);
    }
  });

  it("uses fresh UUIDs for from_entity_id on each audit edge", async () => {
    await agent.execute(makeContext());

    const calls = (mockVgs.writeEdge as ReturnType<typeof vi.fn>).mock.calls;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const call of calls) {
      expect((call[0] as { from_entity_id: string }).from_entity_id).toMatch(uuidRegex);
    }
  });

  it("returns successful output even when getGraphForOpportunity fails (falls back to memory heuristic)", async () => {
    (mockVgs.getGraphForOpportunity as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("graph unavailable"),
    );

    const output = await agent.execute(makeContext());

    // Output must succeed — memory heuristic takes over
    expect(output.status).toBe("success");
    expect(output.result).toHaveProperty("control_coverage_score");
    // No audit edges written when graph read failed
    expect(mockVgs.writeEdge).not.toHaveBeenCalled();
  });

  it("returns successful output even when writeEdge fails", async () => {
    (mockVgs.writeEdge as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("write failed"));

    const output = await agent.execute(makeContext());

    expect(output.status).toBe("success");
    expect(output.result).toHaveProperty("summary");
  });

  it("writes no edges when graph has no VgValueDriver nodes", async () => {
    mockVgs = makeMockVgs([]); // no driver nodes
    agent = new ComplianceAuditorAgent(
      makeConfig(), "org-456",
      new MemorySystem({} as never) as never,
      new LLMGateway("custom") as never,
      new CircuitBreaker() as never,
      mockVgs,
    );

    await agent.execute(makeContext());

    expect(mockVgs.writeEdge).not.toHaveBeenCalled();
  });
});
