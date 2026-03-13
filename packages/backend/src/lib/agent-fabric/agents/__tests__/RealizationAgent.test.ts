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

vi.mock("../../../../services/MCPGroundTruthService.js", () => ({
  mcpGroundTruthService: { getFinancialData: vi.fn().mockResolvedValue(null) },
}));

// --- Imports ---

import type { AgentConfig, LifecycleContext } from "../../../../types/agent";
import { CircuitBreaker } from "../../CircuitBreaker";
import { LLMGateway } from "../../LLMGateway";
import { MemorySystem } from "../../MemorySystem";
import { RealizationAgent } from "../RealizationAgent";

// --- Helpers ---

function makeConfig(): AgentConfig {
  return {
    id: "realization-agent", name: "realization", type: "realization" as any,
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
    lifecycle_stage: "realization", workspace_data: {}, user_inputs: {},
    ...overrides,
  };
}

// KPIs as stored by TargetAgent
const STORED_KPIS = [
  {
    id: "mem_kpi_1", agent_id: "target", workspace_id: "ws-123",
    content: "KPI: procurement_cost_per_unit — baseline: 45.5 currency, target: 32 in 12mo",
    memory_type: "semantic", importance: 0.7,
    created_at: "2024-01-01T00:00:00Z", accessed_at: "2024-01-01T00:00:00Z", access_count: 0,
    metadata: {
      kpi_id: "kpi-1", category: "cost", unit: "currency",
      baseline: { value: 45.5, source: "ERP system Q4 2024", as_of_date: "2024-12-31" },
      target: { value: 32, timeframe_months: 12, confidence: 0.7 },
      measurement_method: "Monthly ERP procurement report",
      hypothesis_id: "hyp-1", causal_verified: true, causal_confidence: 0.8,
      organization_id: "org-456",
    },
  },
  {
    id: "mem_kpi_2", agent_id: "target", workspace_id: "ws-123",
    content: "KPI: customer_retention_rate — baseline: 78% percentage, target: 92% in 6mo",
    memory_type: "semantic", importance: 0.8,
    created_at: "2024-01-01T00:00:00Z", accessed_at: "2024-01-01T00:00:00Z", access_count: 0,
    metadata: {
      kpi_id: "kpi-2", category: "revenue", unit: "percentage",
      baseline: { value: 78, source: "CRM dashboard" },
      target: { value: 92, timeframe_months: 6 },
      organization_id: "org-456",
    },
  },
];

// Integrity validation result
const STORED_INTEGRITY = [
  {
    id: "mem_int_1", agent_id: "integrity", workspace_id: "ws-123",
    content: "Integrity validation: 2 claims checked. 2 supported. Passed.",
    memory_type: "semantic", importance: 0.95,
    created_at: "2024-01-01T00:00:00Z", accessed_at: "2024-01-01T00:00:00Z", access_count: 0,
    metadata: { type: "integrity_validation", claim_count: 2, supported_count: 2, veto: false, organization_id: "org-456" },
  },
];

// LLM response: on-target realization
const ON_TARGET_RESPONSE = JSON.stringify({
  proof_points: [
    {
      kpi_id: "kpi-1", kpi_name: "procurement_cost_per_unit",
      committed_value: 32, realized_value: 33, unit: "currency",
      measurement_date: "2025-06-15", variance_absolute: 1, variance_percentage: 3.1,
      direction: "on_target", evidence: ["ERP report Q2 2025 shows unit cost at 33"],
      confidence: 0.85, data_source: "ERP system",
    },
    {
      kpi_id: "kpi-2", kpi_name: "customer_retention_rate",
      committed_value: 92, realized_value: 95, unit: "percentage",
      measurement_date: "2025-06-15", variance_absolute: 3, variance_percentage: 3.3,
      direction: "over", evidence: ["CRM dashboard shows 95% retention"],
      confidence: 0.9, data_source: "CRM dashboard",
    },
  ],
  overall_realization_rate: 1.02,
  variance_summary: "Both KPIs are on or above target. Procurement costs are within 5% of target. Retention exceeded target by 3 percentage points.",
  interventions: [],
  expansion_signals: [
    {
      kpi_id: "kpi-2", signal_type: "exceeded_target",
      description: "Customer retention exceeded target by 3pp, indicating potential for upsell.",
      estimated_additional_value: 150000,
    },
  ],
  data_quality_assessment: "Both data sources are reliable and current.",
  recommended_next_steps: ["Explore upsell opportunities with retained customers", "Continue monitoring procurement costs"],
});

// LLM response: underperforming with interventions
const UNDERPERFORMING_RESPONSE = JSON.stringify({
  proof_points: [
    {
      kpi_id: "kpi-1", kpi_name: "procurement_cost_per_unit",
      committed_value: 32, realized_value: 42, unit: "currency",
      measurement_date: "2025-06-15", variance_absolute: 10, variance_percentage: 31.3,
      direction: "under", evidence: ["ERP report shows unit cost at 42, well above target"],
      confidence: 0.8, data_source: "ERP system",
    },
    {
      kpi_id: "kpi-2", kpi_name: "customer_retention_rate",
      committed_value: 92, realized_value: 80, unit: "percentage",
      measurement_date: "2025-06-15", variance_absolute: -12, variance_percentage: -13.0,
      direction: "under", evidence: ["CRM shows retention dropped to 80%"],
      confidence: 0.75, data_source: "CRM dashboard",
    },
  ],
  overall_realization_rate: 0.65,
  variance_summary: "Both KPIs are significantly below target. Procurement costs are 31% above target. Retention is 13% below target.",
  interventions: [
    {
      kpi_id: "kpi-1", type: "review_assumptions", priority: "high",
      description: "Vendor consolidation timeline was unrealistic. Review procurement strategy.",
      expected_impact: "Reduce unit cost by 15% within 3 months", owner_role: "VP Procurement",
    },
    {
      kpi_id: "kpi-2", type: "escalate_to_stakeholder", priority: "critical",
      description: "Retention drop requires immediate attention from customer success team.",
      expected_impact: "Stabilize retention at 85% within 2 months", owner_role: "VP Customer Success",
    },
  ],
  expansion_signals: [],
  data_quality_assessment: "Data sources are reliable but measurement frequency should increase.",
  recommended_next_steps: ["Address procurement cost overrun", "Launch retention recovery program"],
});

// --- Tests ---

describe("RealizationAgent", () => {
  let agent: RealizationAgent;

  beforeEach(() => {
    vi.clearAllMocks();

    agent = new RealizationAgent(
      makeConfig(), "org-456",
      new MemorySystem({} as any) as any,
      new LLMGateway("custom") as any,
      new CircuitBreaker() as any,
    );

    // Default: KPIs and integrity results available
    mockRetrieve.mockImplementation((query: any) => {
      if (query.agent_id === "target") return Promise.resolve(STORED_KPIS);
      if (query.agent_id === "integrity") return Promise.resolve(STORED_INTEGRITY);
      return Promise.resolve([]);
    });

    // Default: on-target response
    mockComplete.mockResolvedValue({
      id: "resp-1", model: "test-model",
      content: ON_TARGET_RESPONSE, finish_reason: "stop",
      usage: { prompt_tokens: 800, completion_tokens: 500, total_tokens: 1300 },
    });
  });

  describe("execute — on-target scenario", () => {
    it("rejects context when organization_id mismatches agent tenant", async () => {
      await expect(
        agent.execute(makeContext({ organization_id: "org-other" }))
      ).rejects.toThrow(/Tenant context mismatch/);
    });

    it("produces proof points and returns success", async () => {
      const result = await agent.execute(makeContext());

      expect(result.status).toBe("success");
      expect(result.agent_type).toBe("realization");
      expect(result.lifecycle_stage).toBe("realization");
      expect(result.result.kpis_tracked).toBe(2);
      expect(result.result.kpis_on_target).toBe(2);
      expect(result.result.kpis_under_target).toBe(0);
    });

    it("includes proof points with variance data", async () => {
      const result = await agent.execute(makeContext());

      const proofPoints = result.result.proof_points;
      expect(proofPoints).toHaveLength(2);
      expect(proofPoints[0].kpi_id).toBe("kpi-1");
      expect(proofPoints[0].direction).toBe("on_target");
      expect(proofPoints[1].direction).toBe("over");
    });

    it("includes overall realization rate", async () => {
      const result = await agent.execute(makeContext());

      expect(result.result.overall_realization_rate).toBe(1.02);
    });

    it("detects expansion signals when KPIs exceed targets", async () => {
      const result = await agent.execute(makeContext());

      expect(result.result.expansion_signals).toHaveLength(1);
      expect(result.result.expansion_signals[0].signal_type).toBe("exceeded_target");
      expect(result.result.expansion_signals[0].kpi_id).toBe("kpi-2");
    });

    it("includes SDUI sections with chart and KPI form", async () => {
      const result = await agent.execute(makeContext());

      const components = result.result.sdui_sections.map((s: any) => s.component);
      expect(components).toContain("AgentResponseCard");
      expect(components).toContain("InteractiveChart");
      expect(components).toContain("KPIForm");
      // No NarrativeBlock when no interventions
      expect(components).not.toContain("NarrativeBlock");
    });

    it("stores proof points and expansion signals in memory", async () => {
      await agent.execute(makeContext());

      // 1 tracking call from secureInvoke + 2 proof points + 1 expansion signal + 1 variance report = 5
      expect(mockStoreSemanticMemory).toHaveBeenCalledTimes(5);

      const proofPointCalls = mockStoreSemanticMemory.mock.calls.filter(
        (call: any[]) => call[4]?.type === "proof_point",
      );
      expect(proofPointCalls).toHaveLength(2);

      const signalCalls = mockStoreSemanticMemory.mock.calls.filter(
        (call: any[]) => call[4]?.type === "expansion_signal",
      );
      expect(signalCalls).toHaveLength(1);

      const reportCalls = mockStoreSemanticMemory.mock.calls.filter(
        (call: any[]) => call[4]?.type === "variance_report",
      );
      expect(reportCalls).toHaveLength(1);
    });

    it("includes reasoning with KPI counts and realization rate", async () => {
      const result = await agent.execute(makeContext());

      expect(result.reasoning).toContain("2 KPIs");
      expect(result.reasoning).toContain("102%");
      expect(result.reasoning).toContain("1 expansion signals");
    });
  });

  describe("execute — underperforming scenario", () => {
    beforeEach(() => {
      mockComplete.mockResolvedValue({
        id: "resp-2", model: "test-model",
        content: UNDERPERFORMING_RESPONSE, finish_reason: "stop",
      });
    });

    it("returns partial_success when realization rate is below threshold", async () => {
      const result = await agent.execute(makeContext());

      expect(result.status).toBe("partial_success");
      expect(result.result.overall_realization_rate).toBe(0.65);
      expect(result.result.kpis_under_target).toBe(2);
    });

    it("includes interventions for underperforming KPIs", async () => {
      const result = await agent.execute(makeContext());

      expect(result.result.interventions).toHaveLength(2);
      expect(result.result.interventions[0].priority).toBe("high");
      expect(result.result.interventions[1].priority).toBe("critical");
    });

    it("includes NarrativeBlock for interventions in SDUI", async () => {
      const result = await agent.execute(makeContext());

      const components = result.result.sdui_sections.map((s: any) => s.component);
      expect(components).toContain("NarrativeBlock");
    });

    it("has no expansion signals when underperforming", async () => {
      const result = await agent.execute(makeContext());

      expect(result.result.expansion_signals).toHaveLength(0);
    });

    it("reasoning mentions interventions", async () => {
      const result = await agent.execute(makeContext());

      expect(result.reasoning).toContain("2 interventions recommended");
    });
  });

  describe("execute — telemetry from context", () => {
    it("passes telemetry data from user_inputs to the LLM prompt", async () => {
      const ctx = makeContext({
        user_inputs: {
          telemetry: [
            { kpi_id: "kpi-1", actual_value: 35, measurement_date: "2025-06-01", source: "ERP" },
          ],
        },
      });

      await agent.execute(ctx);

      const promptArg = mockComplete.mock.calls[0][0].messages[0].content;
      expect(promptArg).toContain("Actual Value: 35");
      expect(promptArg).toContain("source: ERP");
    });
  });

  describe("memory retrieval", () => {
    it("fails when no KPIs in memory", async () => {
      mockRetrieve.mockResolvedValue([]);

      const result = await agent.execute(makeContext());

      expect(result.status).toBe("failure");
      expect(result.result.error).toContain("No committed KPI targets");
    });

    it("retrieves KPIs from target agent and integrity results", async () => {
      await agent.execute(makeContext());

      expect(mockRetrieve).toHaveBeenCalledWith(
        expect.objectContaining({ agent_id: "target", organization_id: "org-456", workspace_id: "ws-123" }),
      );
      expect(mockRetrieve).toHaveBeenCalledWith(
        expect.objectContaining({ agent_id: "integrity", organization_id: "org-456", workspace_id: "ws-123" }),
      );
    });
  });

  describe("LLM failure", () => {
    it("returns failure when LLM call fails", async () => {
      mockComplete.mockRejectedValue(new Error("LLM timeout"));

      const result = await agent.execute(makeContext());

      expect(result.status).toBe("failure");
      expect(result.result.error).toContain("Realization analysis failed");
    });
  });

  describe("input validation", () => {
    it("throws when context is missing required fields", async () => {
      const ctx = makeContext({ workspace_id: "" });

      await expect(agent.execute(ctx)).rejects.toThrow("Invalid input context");
    });
  });

  it("rejects execution when context organization does not match agent tenant", async () => {
    await expect(
      agent.execute(makeContext({ organization_id: "org-mismatch" }))
    ).rejects.toThrow(/tenant context mismatch/i);
  });

});
