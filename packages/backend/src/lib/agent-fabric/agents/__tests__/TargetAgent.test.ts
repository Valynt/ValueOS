import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks ---

const { mockRetrieve, mockStoreSemanticMemory, mockComplete, mockInferCausal } = vi.hoisted(() => ({
  mockRetrieve: vi.fn(),
  mockStoreSemanticMemory: vi.fn().mockResolvedValue("mem_1"),
  mockComplete: vi.fn(),
  mockInferCausal: vi.fn(),
}));

// --- Module mocks ---

vi.mock("../../../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
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

vi.mock("../../../../services/reasoning/AdvancedCausalEngine.js", () => ({
  getAdvancedCausalEngine: () => ({
    inferCausalRelationship: mockInferCausal,
  }),
}));

vi.mock("../../../../services/MCPGroundTruthService.js", () => ({
  mcpGroundTruthService: {
    getFinancialData: vi.fn().mockResolvedValue(null),
  },
}));

// --- Imports ---

import type { AgentConfig, LifecycleContext } from "../../../../types/agent";
import { CircuitBreaker } from "../../CircuitBreaker";
import { LLMGateway } from "../../LLMGateway";
import { MemorySystem } from "../../MemorySystem";
import { TargetAgent } from "../TargetAgent";

// --- Helpers ---

function makeConfig(): AgentConfig {
  return {
    id: "target-agent",
    name: "target",
    type: "target" as any,
    lifecycle_stage: "target",
    capabilities: [],
    model: { provider: "custom", model_name: "test" },
    prompts: { system_prompt: "", user_prompt_template: "" },
    parameters: {
      timeout_seconds: 30, max_retries: 3, retry_delay_ms: 1000,
      enable_caching: false, enable_telemetry: false,
    },
    constraints: {
      max_input_tokens: 4096, max_output_tokens: 4096,
      allowed_actions: [], forbidden_actions: [], required_permissions: [],
    },
  };
}

function makeContext(overrides: Partial<LifecycleContext> = {}): LifecycleContext {
  return {
    workspace_id: "ws-123",
    organization_id: "org-456",
    user_id: "user-789",
    lifecycle_stage: "target",
    workspace_data: {},
    user_inputs: { query: "Generate KPI targets for Acme Corp" },
    ...overrides,
  };
}

// Hypotheses as stored by OpportunityAgent
const STORED_HYPOTHESES = [
  {
    id: "mem_hyp_1",
    agent_id: "opportunity",
    workspace_id: "ws-123",
    content: "Hypothesis: Supply Chain Optimization — Reduce procurement costs through vendor consolidation.",
    memory_type: "semantic",
    importance: 0.75,
    created_at: "2024-01-01T00:00:00Z",
    accessed_at: "2024-01-01T00:00:00Z",
    access_count: 0,
    metadata: {
      verified: true,
      category: "cost_reduction",
      estimated_impact: { low: 500000, high: 1200000, unit: "usd", timeframe_months: 12 },
      confidence: 0.75,
      evidence: ["Current vendor count exceeds industry median by 40%"],
      assumptions: ["Vendor consolidation is feasible within 6 months"],
      kpi_targets: ["procurement_cost_per_unit", "vendor_count"],
      relatedActions: ["reduce_costs"],
      targetKpis: ["procurement_cost_per_unit", "vendor_count"],
      organization_id: "org-456",
    },
  },
  {
    id: "mem_hyp_2",
    agent_id: "opportunity",
    workspace_id: "ws-123",
    content: "Hypothesis: Operational Efficiency — Automate manual QA processes.",
    memory_type: "semantic",
    importance: 0.65,
    created_at: "2024-01-01T00:00:00Z",
    accessed_at: "2024-01-01T00:00:00Z",
    access_count: 0,
    metadata: {
      verified: true,
      category: "operational_efficiency",
      estimated_impact: { low: 200000, high: 600000, unit: "usd", timeframe_months: 18 },
      confidence: 0.65,
      evidence: ["Manual QA accounts for 30% of production cycle time"],
      assumptions: ["Automation tooling is compatible"],
      kpi_targets: ["cycle_time_hours", "defect_rate"],
      relatedActions: ["improve_efficiency"],
      targetKpis: ["cycle_time_hours", "defect_rate"],
      organization_id: "org-456",
    },
  },
];

const VALID_LLM_RESPONSE = JSON.stringify({
  kpi_definitions: [
    {
      id: "kpi-1",
      name: "procurement_cost_per_unit",
      description: "Average procurement cost per unit across all vendors",
      unit: "currency",
      measurement_method: "Monthly ERP procurement report",
      baseline: { value: 45.50, source: "ERP system Q4 2024", as_of_date: "2024-12-31" },
      target: { value: 32.00, timeframe_months: 12, confidence: 0.7 },
      category: "cost",
      hypothesis_id: "hyp-1",
    },
    {
      id: "kpi-2",
      name: "cycle_time_hours",
      description: "Average QA cycle time per production batch",
      unit: "hours",
      measurement_method: "Production tracking system",
      baseline: { value: 48, source: "Production logs Q4 2024", as_of_date: "2024-12-31" },
      target: { value: 24, timeframe_months: 18, confidence: 0.6 },
      category: "efficiency",
      hypothesis_id: "hyp-2",
    },
  ],
  value_driver_tree: [
    {
      id: "root-1",
      label: "Total Value Impact",
      type: "root",
      status: "active",
      children: [
        {
          id: "branch-1",
          label: "Cost Reduction",
          type: "branch",
          status: "active",
          children: [
            { id: "leaf-1", label: "Procurement Cost", value: "$500K–$1.2M", type: "leaf", status: "active", children: [] },
          ],
        },
        {
          id: "branch-2",
          label: "Efficiency Gains",
          type: "branch",
          status: "active",
          children: [
            { id: "leaf-2", label: "QA Cycle Time", value: "50% reduction", type: "leaf", status: "active", children: [] },
          ],
        },
      ],
    },
  ],
  financial_model_inputs: [
    {
      hypothesis_id: "hyp-1",
      hypothesis_title: "Supply Chain Optimization",
      category: "cost",
      baseline_value: 45.50,
      target_value: 32.00,
      unit: "usd_per_unit",
      timeframe_months: 12,
      assumptions: ["10,000 units/month volume", "3 vendors consolidated to 1"],
      sensitivity_variables: ["unit_volume", "vendor_pricing"],
    },
    {
      hypothesis_id: "hyp-2",
      hypothesis_title: "Operational Efficiency",
      category: "efficiency",
      baseline_value: 48,
      target_value: 24,
      unit: "hours",
      timeframe_months: 18,
      assumptions: ["Automation covers 80% of manual steps"],
      sensitivity_variables: ["automation_coverage", "batch_size"],
    },
  ],
  measurement_plan: "Monthly KPI review with automated dashboards. Quarterly stakeholder check-ins.",
  risks: [
    {
      description: "Vendor consolidation may reduce negotiating leverage",
      likelihood: "medium",
      mitigation: "Maintain backup vendor relationships",
    },
  ],
});

// --- Tests ---

describe("TargetAgent", () => {
  let agent: TargetAgent;

  beforeEach(() => {
    vi.clearAllMocks();

    agent = new TargetAgent(
      makeConfig(),
      "org-456",
      new MemorySystem({} as any) as any,
      new LLMGateway("custom") as any,
      new CircuitBreaker() as any,
    );

    // Default: hypotheses available in memory
    mockRetrieve.mockResolvedValue(STORED_HYPOTHESES);

    // Default: LLM returns valid response
    mockComplete.mockResolvedValue({
      id: "resp-1",
      model: "test-model",
      content: VALID_LLM_RESPONSE,
      finish_reason: "stop",
      usage: { prompt_tokens: 800, completion_tokens: 500, total_tokens: 1300 },
    });

    // Default: causal engine returns positive inference
    mockInferCausal.mockResolvedValue({
      confidence: 0.8,
      effect: { direction: "positive", magnitude: 0.6 },
    });
  });

  describe("execute", () => {
    it("generates KPI targets from hypotheses and returns structured output", async () => {
      const result = await agent.execute(makeContext());

      expect(result.status).toBe("success");
      expect(result.agent_type).toBe("target");
      expect(result.lifecycle_stage).toBe("target");
      expect(result.result.kpi_definitions).toHaveLength(2);
      expect(result.result.kpi_definitions[0].name).toBe("procurement_cost_per_unit");
      expect(result.result.kpi_definitions[1].name).toBe("cycle_time_hours");
      expect(result.result.financial_model_inputs).toHaveLength(2);
      expect(result.result.value_driver_tree).toHaveLength(1);
      expect(result.result.measurement_plan).toContain("Monthly KPI review");
    });

    it("includes SDUI sections with KPIForm and ValueTreeCard", async () => {
      const result = await agent.execute(makeContext());

      expect(result.result.sdui_sections).toBeDefined();
      expect(result.result.sdui_sections.length).toBeGreaterThanOrEqual(3);

      const components = result.result.sdui_sections.map((s: any) => s.component);
      expect(components).toContain("AgentResponseCard");
      expect(components).toContain("KPIForm");
      expect(components).toContain("ValueTreeCard");
    });

    it("KPIForm section contains correct KPI data", async () => {
      const result = await agent.execute(makeContext());

      const kpiSection = result.result.sdui_sections.find((s: any) => s.component === "KPIForm");
      expect(kpiSection.props.kpis).toHaveLength(2);
      expect(kpiSection.props.kpis[0].label).toBe("procurement_cost_per_unit");
      expect(kpiSection.props.kpis[0].type).toBe("currency");
      expect(kpiSection.props.values["kpi-1"]).toBe(45.50);
    });

    it("ValueTreeCard section contains the value driver tree", async () => {
      const result = await agent.execute(makeContext());

      const treeSection = result.result.sdui_sections.find((s: any) => s.component === "ValueTreeCard");
      expect(treeSection.props.nodes).toHaveLength(1);
      expect(treeSection.props.nodes[0].label).toBe("Total Value Impact");
      expect(treeSection.props.title).toBe("Value Driver Tree");
    });

    it("validates causal traces for each KPI", async () => {
      const result = await agent.execute(makeContext());

      expect(result.result.causal_traces).toHaveLength(2);
      expect(result.result.causal_traces[0].verified).toBe(true);
      expect(result.result.causal_traces[0].confidence).toBe(0.8);
      expect(mockInferCausal).toHaveBeenCalledTimes(2);
    });

    it("stores KPI targets and model inputs in memory", async () => {
      await agent.execute(makeContext());

      // 1 tracking call from secureInvoke + 2 KPIs + 1 financial model inputs = 4
      expect(mockStoreSemanticMemory).toHaveBeenCalledTimes(4);

      // Find KPI storage calls
      const kpiCalls = mockStoreSemanticMemory.mock.calls.filter(
        (call: any[]) => call[4]?.kpi_id !== undefined,
      );
      expect(kpiCalls).toHaveLength(2);
      expect(kpiCalls[0][1]).toBe("target"); // agent_id
      expect(kpiCalls[0][3]).toContain("procurement_cost_per_unit");

      // Find financial model inputs call
      const modelCall = mockStoreSemanticMemory.mock.calls.find(
        (call: any[]) => call[4]?.type === "financial_model_inputs",
      );
      expect(modelCall).toBeDefined();
      expect(modelCall![4].inputs).toHaveLength(2);
    });

    it("sets confidence based on average causal confidence", async () => {
      const result = await agent.execute(makeContext());

      // Both causal traces return 0.8 → average 0.8 → "high"
      expect(result.confidence).toBe("high");
    });

    it("includes reasoning with KPI and hypothesis counts", async () => {
      const result = await agent.execute(makeContext());

      expect(result.reasoning).toContain("2 KPI targets");
      expect(result.reasoning).toContain("2 hypotheses");
      expect(result.reasoning).toContain("2/2 causal traces verified");
    });

    it("returns partial_success when some causal traces fail", async () => {
      // First call succeeds, second fails
      mockInferCausal
        .mockResolvedValueOnce({ confidence: 0.8, effect: { direction: "positive", magnitude: 0.6 } })
        .mockRejectedValueOnce(new Error("Causal engine error"));

      const result = await agent.execute(makeContext());

      expect(result.status).toBe("partial_success");
      expect(result.result.kpis_verified).toBe(1);
      expect(result.warnings).toBeDefined();
      expect(result.warnings![0]).toContain("1 of 2 KPIs lack verified causal links");
    });
  });

  describe("hypothesis retrieval", () => {
    it("fails when no hypotheses are in memory", async () => {
      mockRetrieve.mockResolvedValue([]);

      const result = await agent.execute(makeContext());

      expect(result.status).toBe("failure");
      expect(result.result.error).toContain("No opportunity hypotheses found");
    });

    it("filters out unverified hypotheses", async () => {
      mockRetrieve.mockResolvedValue([
        { ...STORED_HYPOTHESES[0] },
        {
          ...STORED_HYPOTHESES[1],
          metadata: { ...STORED_HYPOTHESES[1].metadata, verified: false },
        },
      ]);

      const result = await agent.execute(makeContext());

      // Only 1 verified hypothesis passed to LLM
      expect(result.result.hypotheses_linked).toBe(1);
      // LLM still returns 2 KPIs (mocked), but only 1 can be causally linked
      // to the single verified hypothesis, so status is partial_success
      expect(result.status).toBe("partial_success");
    });

    it("handles memory retrieval failure gracefully", async () => {
      mockRetrieve.mockRejectedValue(new Error("Memory unavailable"));

      const result = await agent.execute(makeContext());

      expect(result.status).toBe("failure");
      expect(result.result.error).toContain("No opportunity hypotheses found");
    });
  });

  describe("LLM failure handling", () => {
    it("fails gracefully when LLM returns invalid JSON", async () => {
      mockComplete.mockResolvedValue({
        id: "resp-2",
        model: "test-model",
        content: "not valid json",
        finish_reason: "stop",
      });

      const result = await agent.execute(makeContext());

      expect(result.status).toBe("failure");
      expect(result.result.error).toContain("failed");
    });

    it("fails gracefully when LLM throws", async () => {
      mockComplete.mockRejectedValue(new Error("LLM unavailable"));

      const result = await agent.execute(makeContext());

      expect(result.status).toBe("failure");
    });
  });
});
