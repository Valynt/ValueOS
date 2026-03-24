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
    execute = vi.fn().mockImplementation((fn: () => Promise<any>) => fn());
  },
}));

const { mockWriteCapability: mockExpWriteCapability, mockWriteEdge: mockExpWriteEdge, mockGetSafeContext: mockExpGetSafeContext, mockGenerateNodeId: mockExpGenerateNodeId, mockSafeWriteBatch: mockExpSafeWriteBatch } = vi.hoisted(() => {
  const mockWriteCapability = vi.fn().mockResolvedValue({ id: "cap-1" });
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
  return { mockWriteCapability, mockWriteEdge, mockGetSafeContext, mockGenerateNodeId, mockSafeWriteBatch };
});

vi.mock("../../BaseGraphWriter.js", () => ({
  BaseGraphWriter: class {
    getSafeContext = mockExpGetSafeContext;
    generateNodeId = mockExpGenerateNodeId;
    safeWriteBatch = mockExpSafeWriteBatch;
    writeCapability = mockExpWriteCapability;
    writeEdge = mockExpWriteEdge;
    writeMetric = vi.fn().mockResolvedValue({ id: "met-1" });
    writeValueDriver = vi.fn().mockResolvedValue({ id: "vd-1" });
    resolveOpportunityId = vi.fn().mockReturnValue("770e8400-e29b-41d4-a716-446655440002");
  },
  LifecycleContextError: class extends Error {},
}));

vi.mock("../../../../services/MCPGroundTruthService.js", () => ({
  mcpGroundTruthService: { getFinancialData: vi.fn().mockResolvedValue(null) },
}));

// --- Imports ---

import type { AgentConfig, LifecycleContext } from "../../../../types/agent";
import { CircuitBreaker } from "../../CircuitBreaker";
import { LLMGateway } from "../../LLMGateway";
import { MemorySystem } from "../../MemorySystem";
import { ExpansionAgent } from "../ExpansionAgent";

// --- Helpers ---

function makeConfig(): AgentConfig {
  return {
    id: "expansion-agent", name: "expansion", type: "expansion" as any,
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
    lifecycle_stage: "expansion", workspace_data: {}, user_inputs: {},
    ...overrides,
  };
}

// Proof points as stored by RealizationAgent
const STORED_PROOF_POINTS = [
  {
    id: "mem_pp_1", agent_id: "realization", workspace_id: "ws-123",
    content: "ProofPoint: procurement_cost_per_unit — committed: 32, realized: 33 currency. Variance: 3.1% (on_target).",
    memory_type: "semantic", importance: 0.7,
    created_at: "2024-01-01T00:00:00Z", accessed_at: "2024-01-01T00:00:00Z", access_count: 0,
    metadata: {
      type: "proof_point", kpi_id: "kpi-1", kpi_name: "procurement_cost_per_unit",
      committed_value: 32, realized_value: 33, direction: "on_target",
      variance_percentage: 3.1, confidence: 0.85,
      organization_id: "org-456",
    },
  },
  {
    id: "mem_pp_2", agent_id: "realization", workspace_id: "ws-123",
    content: "ProofPoint: customer_retention_rate — committed: 92, realized: 95 percentage. Variance: 3.3% (over).",
    memory_type: "semantic", importance: 0.7,
    created_at: "2024-01-01T00:00:00Z", accessed_at: "2024-01-01T00:00:00Z", access_count: 0,
    metadata: {
      type: "proof_point", kpi_id: "kpi-2", kpi_name: "customer_retention_rate",
      committed_value: 92, realized_value: 95, direction: "over",
      variance_percentage: 3.3, confidence: 0.9,
      organization_id: "org-456",
    },
  },
];

// Expansion signals as stored by RealizationAgent
const STORED_EXPANSION_SIGNALS = [
  {
    id: "mem_es_1", agent_id: "realization", workspace_id: "ws-123",
    content: "ExpansionSignal: Customer retention exceeded target by 3pp, indicating potential for upsell. (KPI: kpi-2, type: exceeded_target)",
    memory_type: "semantic", importance: 0.85,
    created_at: "2024-01-01T00:00:00Z", accessed_at: "2024-01-01T00:00:00Z", access_count: 0,
    metadata: {
      type: "expansion_signal", kpi_id: "kpi-2", signal_type: "exceeded_target",
      estimated_additional_value: 150000,
      organization_id: "org-456",
    },
  },
];

// Variance report
const STORED_VARIANCE_REPORT = {
  id: "mem_vr_1", agent_id: "realization", workspace_id: "ws-123",
  content: "VarianceReport: Overall realization rate 102%. 2 KPIs tracked. 0 interventions. 1 expansion signals.",
  memory_type: "semantic", importance: 0.9,
  created_at: "2024-01-01T00:00:00Z", accessed_at: "2024-01-01T00:00:00Z", access_count: 0,
  metadata: {
    type: "variance_report", overall_realization_rate: 1.02,
    kpi_count: 2, intervention_count: 0, expansion_signal_count: 1,
    organization_id: "org-456",
  },
};

// Original hypotheses
const STORED_HYPOTHESES = [
  {
    id: "mem_hyp_1", agent_id: "opportunity", workspace_id: "ws-123",
    content: "Hypothesis: Supply Chain Optimization — Reduce procurement costs.",
    memory_type: "semantic", importance: 0.75,
    created_at: "2024-01-01T00:00:00Z", accessed_at: "2024-01-01T00:00:00Z", access_count: 0,
    metadata: {
      verified: true, category: "cost_reduction",
      estimated_impact: { low: 500000, high: 1200000, unit: "usd", timeframe_months: 12 },
      organization_id: "org-456",
    },
  },
];

// LLM response: expansion opportunities found
const EXPANSION_RESPONSE = JSON.stringify({
  opportunities: [
    {
      id: "exp-1", title: "Customer Success Upsell Program",
      description: "Leverage 95% retention rate to introduce premium support tier.",
      type: "upsell", source_kpi_id: "kpi-2",
      estimated_additional_value: { low: 200000, high: 450000, unit: "usd", timeframe_months: 12 },
      confidence: 0.8,
      evidence: ["Retention rate exceeded target by 3pp", "Customer satisfaction scores above 4.5/5"],
      prerequisites: ["Premium tier product definition", "Customer segmentation analysis"],
      stakeholders: ["VP Sales", "VP Customer Success"],
    },
    {
      id: "exp-2", title: "Procurement Automation Extension",
      description: "Extend procurement optimization to adjacent categories.",
      type: "new_use_case", source_kpi_id: "kpi-1",
      estimated_additional_value: { low: 100000, high: 300000, unit: "usd", timeframe_months: 18 },
      confidence: 0.65,
      evidence: ["Procurement cost on target, methodology proven"],
      prerequisites: ["Category analysis for adjacent spend areas"],
      stakeholders: ["VP Procurement", "CFO"],
    },
  ],
  gap_analysis: [
    {
      kpi_id: "kpi-1", kpi_name: "procurement_cost_per_unit",
      gap_type: "scope_limitation",
      description: "Current optimization covers only direct materials. Indirect spend is unaddressed.",
      root_cause: "Initial scope was limited to direct procurement.",
      recommended_action: "Expand scope to include indirect procurement categories.",
      priority: "medium",
    },
  ],
  portfolio_summary: "Strong realization across both KPIs. Retention overperformance creates upsell opportunity. Procurement methodology can be extended to adjacent categories.",
  total_expansion_potential: { low: 300000, high: 750000, currency: "USD" },
  new_cycle_recommendations: [
    {
      title: "Indirect Procurement Optimization",
      rationale: "Direct procurement methodology proven. Apply to indirect spend for additional savings.",
      priority: "high",
      seed_query: "Analyze indirect procurement spend categories for optimization opportunities using proven direct procurement methodology.",
    },
  ],
  recommended_next_steps: [
    "Present upsell opportunity to VP Sales",
    "Scope indirect procurement analysis",
    "Schedule expansion review with CFO",
  ],
});

// LLM response: no expansion opportunities (gaps only)
const GAPS_ONLY_RESPONSE = JSON.stringify({
  opportunities: [],
  gap_analysis: [
    {
      kpi_id: "kpi-1", kpi_name: "procurement_cost_per_unit",
      gap_type: "underperformance",
      description: "Procurement costs barely met target. No headroom for expansion.",
      root_cause: "Market conditions shifted, reducing savings potential.",
      recommended_action: "Re-evaluate vendor strategy for next cycle.",
      priority: "high",
    },
  ],
  portfolio_summary: "Limited expansion potential. Focus on gap remediation before pursuing new opportunities.",
  total_expansion_potential: { low: 0, high: 0, currency: "USD" },
  new_cycle_recommendations: [],
  recommended_next_steps: ["Address procurement gaps", "Re-evaluate value targets"],
});

// --- Tests ---

describe("ExpansionAgent", () => {
  let agent: ExpansionAgent;

  beforeEach(() => {
    vi.clearAllMocks();

    agent = new ExpansionAgent(
      makeConfig(), "org-456",
      new MemorySystem({} as any) as any,
      new LLMGateway("custom") as any,
      new CircuitBreaker() as any,
    );

    // Default: proof points, signals, variance report, and hypotheses available
    mockRetrieve.mockImplementation((query: any) => {
      if (query.agent_id === "realization") {
        return Promise.resolve([
          ...STORED_PROOF_POINTS,
          ...STORED_EXPANSION_SIGNALS,
          STORED_VARIANCE_REPORT,
        ]);
      }
      if (query.agent_id === "opportunity") return Promise.resolve(STORED_HYPOTHESES);
      return Promise.resolve([]);
    });

    // Default: expansion opportunities found
    mockComplete.mockResolvedValue({
      id: "resp-1", model: "test-model",
      content: EXPANSION_RESPONSE, finish_reason: "stop",
      usage: { prompt_tokens: 900, completion_tokens: 600, total_tokens: 1500 },
    });
  });

  describe("execute — expansion opportunities found", () => {
    it("rejects context when organization_id mismatches agent tenant", async () => {
      await expect(
        agent.execute(makeContext({ organization_id: "org-other" }))
      ).rejects.toThrow(/Tenant context mismatch/);
    });

    it("identifies expansion opportunities and returns success", async () => {
      const result = await agent.execute(makeContext());

      expect(result.status).toBe("success");
      expect(result.agent_type).toBe("expansion");
      expect(result.lifecycle_stage).toBe("expansion");
      expect(result.result.opportunities_count).toBe(2);
    });

    it("includes expansion opportunities with value estimates", async () => {
      const result = await agent.execute(makeContext());

      const opportunities = result.result.opportunities;
      expect(opportunities).toHaveLength(2);
      expect(opportunities[0].type).toBe("upsell");
      expect(opportunities[0].estimated_additional_value.low).toBe(200000);
      expect(opportunities[1].type).toBe("new_use_case");
    });

    it("includes gap analysis", async () => {
      const result = await agent.execute(makeContext());

      expect(result.result.gap_analysis).toHaveLength(1);
      expect(result.result.gap_analysis[0].gap_type).toBe("scope_limitation");
      expect(result.result.gaps_identified).toBe(1);
    });

    it("includes total expansion potential", async () => {
      const result = await agent.execute(makeContext());

      expect(result.result.total_expansion_potential.low).toBe(300000);
      expect(result.result.total_expansion_potential.high).toBe(750000);
    });

    it("recommends new value cycles with seed queries", async () => {
      const result = await agent.execute(makeContext());

      expect(result.result.new_cycle_recommendations).toHaveLength(1);
      expect(result.result.new_cycles_recommended).toBe(1);
    });

    it("includes SDUI sections with DiscoveryCards and chart", async () => {
      const result = await agent.execute(makeContext());

      const components = result.result.sdui_sections.map((s: any) => s.component);
      expect(components).toContain("AgentResponseCard");
      expect(components).toContain("DiscoveryCard");
      expect(components).toContain("InteractiveChart");
      expect(components).toContain("NarrativeBlock");
    });

    it("creates one DiscoveryCard per opportunity", async () => {
      const result = await agent.execute(makeContext());

      const discoveryCards = result.result.sdui_sections.filter(
        (s: any) => s.component === "DiscoveryCard",
      );
      expect(discoveryCards).toHaveLength(2);
    });

    it("stores opportunities, gaps, and cycle seeds in memory", async () => {
      await agent.execute(makeContext());

      // 1 tracking call from secureInvoke + 2 opportunities + 1 gap + 1 cycle seed = 5
      expect(mockStoreSemanticMemory).toHaveBeenCalledTimes(5);

      const opportunityCalls = mockStoreSemanticMemory.mock.calls.filter(
        (call: any[]) => call[4]?.type === "expansion_opportunity",
      );
      expect(opportunityCalls).toHaveLength(2);

      const gapCalls = mockStoreSemanticMemory.mock.calls.filter(
        (call: any[]) => call[4]?.type === "gap_analysis",
      );
      expect(gapCalls).toHaveLength(1);

      const seedCalls = mockStoreSemanticMemory.mock.calls.filter(
        (call: any[]) => call[4]?.type === "new_cycle_seed",
      );
      expect(seedCalls).toHaveLength(1);
      expect(seedCalls[0][4].seed_query).toContain("indirect procurement");
    });

    it("includes reasoning with opportunity count and value range", async () => {
      const result = await agent.execute(makeContext());

      expect(result.reasoning).toContain("2 expansion opportunities");
      expect(result.reasoning).toContain("$300,000");
      expect(result.reasoning).toContain("$750,000");
      expect(result.reasoning).toContain("1 gaps analyzed");
      expect(result.reasoning).toContain("1 new value cycles");
    });
  });

  describe("execute — gaps only, no expansion", () => {
    beforeEach(() => {
      mockComplete.mockResolvedValue({
        id: "resp-2", model: "test-model",
        content: GAPS_ONLY_RESPONSE, finish_reason: "stop",
      });
    });

    it("returns success even with no opportunities", async () => {
      const result = await agent.execute(makeContext());

      expect(result.status).toBe("success");
      expect(result.result.opportunities_count).toBe(0);
      expect(result.result.gaps_identified).toBe(1);
    });

    it("does not include InteractiveChart when no opportunities", async () => {
      const result = await agent.execute(makeContext());

      const components = result.result.sdui_sections.map((s: any) => s.component);
      expect(components).toContain("AgentResponseCard");
      expect(components).not.toContain("InteractiveChart");
      expect(components).not.toContain("DiscoveryCard");
    });
  });

  describe("memory retrieval", () => {
    it("fails when no proof points or signals in memory", async () => {
      mockRetrieve.mockResolvedValue([]);

      const result = await agent.execute(makeContext());

      expect(result.status).toBe("failure");
      expect(result.result.error).toContain("No proof points or expansion signals");
    });

    it("retrieves from realization and opportunity agents", async () => {
      await agent.execute(makeContext());

      expect(mockRetrieve).toHaveBeenCalledWith(
        expect.objectContaining({ agent_id: "realization", organization_id: "org-456", workspace_id: "ws-123" }),
      );
      expect(mockRetrieve).toHaveBeenCalledWith(
        expect.objectContaining({ agent_id: "opportunity", organization_id: "org-456", workspace_id: "ws-123" }),
      );
    });
  });

  describe("LLM failure", () => {
    it("returns failure when LLM call fails", async () => {
      mockComplete.mockRejectedValue(new Error("LLM timeout"));

      const result = await agent.execute(makeContext());

      expect(result.status).toBe("failure");
      expect(result.result.error).toContain("Expansion analysis failed");
    });
  });

  describe("input validation", () => {
    it("throws when context is missing required fields", async () => {
      const ctx = makeContext({ organization_id: "" });

      await expect(agent.execute(ctx)).rejects.toThrow("Invalid input context");
    });
  });

  it("rejects execution when context organization does not match agent tenant", async () => {
    await expect(
      agent.execute(makeContext({ organization_id: "org-mismatch" }))
    ).rejects.toThrow(/tenant context mismatch/i);
  });

  describe("Value Graph writes", () => {
    beforeEach(() => {
      mockExpWriteCapability.mockClear();
      mockExpWriteEdge.mockClear();
    });

    it("writes VgCapability nodes and use_case_enabled_by_capability edges after successful execution", async () => {
      await agent.execute(makeContext());

      expect(mockExpWriteCapability).toHaveBeenCalledWith(
        expect.objectContaining({ organization_id: "org-456" }),
        expect.objectContaining({ name: expect.any(String) }),
      );
      expect(mockExpWriteEdge).toHaveBeenCalledWith(
        expect.objectContaining({ organization_id: "org-456" }),
        expect.objectContaining({ edge_type: "use_case_enabled_by_capability" }),
      );
    });

    it("does not propagate graph write errors to agent output", async () => {
      mockExpGetSafeContext.mockImplementationOnce(() => {
        throw new Error("opportunity_id is missing");
      });

      const result = await agent.execute(makeContext());
      expect(result.status).not.toBe("failure");
    });
  });
});
