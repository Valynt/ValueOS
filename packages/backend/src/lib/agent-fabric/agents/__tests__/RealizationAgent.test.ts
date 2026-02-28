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
    execute = vi.fn().mockImplementation((fn: () => Promise<unknown>) => fn());
  },
}));

vi.mock("../../../../config/featureFlags.js", () => ({
  featureFlags: { ENABLE_DOMAIN_PACK_CONTEXT: false },
}));

vi.mock("../../../../agents/context/loadDomainContext.js", () => ({
  loadDomainContext: vi.fn().mockResolvedValue({
    pack: undefined, kpis: [], assumptions: [], glossary: {}, complianceRules: [],
  }),
}));

// --- Imports ---

import { RealizationAgent } from "../RealizationAgent";
import { LLMGateway } from "../../LLMGateway";
import { MemorySystem } from "../../MemorySystem";
import { CircuitBreaker } from "../../CircuitBreaker";
import type { AgentConfig, LifecycleContext } from "../../../../types/agent";

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
    lifecycle_stage: "realization", workspace_data: {}, user_inputs: {},
    ...overrides,
  };
}

// Hypotheses as stored by OpportunityAgent
const STORED_HYPOTHESES = [
  {
    id: "mem_hyp_1", agent_id: "opportunity", workspace_id: "ws-123",
    content: "Hypothesis: Supply Chain Optimization — Reduce procurement costs.",
    memory_type: "semantic", importance: 0.75,
    created_at: "2024-01-01T00:00:00Z", accessed_at: "2024-01-01T00:00:00Z", access_count: 0,
    metadata: {
      verified: true, category: "cost_reduction",
      estimated_impact: { low: 500000, high: 1200000, unit: "usd", timeframe_months: 12 },
      confidence: 0.75, evidence: ["Current vendor count exceeds industry median by 40%"],
      organization_id: "org-456",
    },
  },
];

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
      organization_id: "org-456",
    },
  },
];

// Integrity results
const STORED_INTEGRITY = [
  {
    id: "mem_int_1", agent_id: "integrity", workspace_id: "ws-123",
    content: "Integrity validation: 2 claims checked. 2 supported. Passed.",
    memory_type: "semantic", importance: 0.95,
    created_at: "2024-01-01T00:00:00Z", accessed_at: "2024-01-01T00:00:00Z", access_count: 0,
    metadata: {
      type: "integrity_validation", claim_count: 2, supported_count: 2,
      veto: false, reRefine: false, organization_id: "org-456",
    },
  },
];

// Successful LLM response
const SUCCESS_RESPONSE = JSON.stringify({
  plans: [
    {
      hypothesis_id: "hyp-1",
      hypothesis_title: "Supply Chain Optimization",
      implementation_approach: "Consolidate vendors and implement e-procurement platform.",
      milestones: [
        {
          id: "ms-1", title: "Vendor Assessment", description: "Evaluate current vendor portfolio",
          target_date_months: 2, dependencies: [], success_criteria: "Complete vendor scorecard for top 20 vendors",
          status: "planned",
        },
        {
          id: "ms-2", title: "Platform Selection", description: "Select and contract e-procurement platform",
          target_date_months: 4, dependencies: ["ms-1"], success_criteria: "Signed contract with selected vendor",
          status: "planned",
        },
      ],
      resources: [
        { type: "personnel", description: "Procurement lead", estimated_cost: 120000, currency: "USD", priority: "required" },
        { type: "technology", description: "E-procurement platform license", estimated_cost: 50000, currency: "USD", priority: "required" },
      ],
      risks: [
        { description: "Vendor resistance to consolidation", likelihood: "medium", impact: "medium", mitigation: "Phased approach with clear communication" },
      ],
      expected_timeline_months: 12,
      confidence: 0.78,
    },
  ],
  overall_strategy: "Phased vendor consolidation with technology enablement.",
  total_estimated_investment: 170000,
  expected_roi_timeline_months: 18,
  tracking_metrics: [
    { name: "Cost per unit", description: "Track procurement cost per unit monthly", measurement_frequency: "monthly", target_value: "32", unit: "USD" },
  ],
  critical_success_factors: ["Executive sponsorship", "Vendor cooperation"],
});

// --- Tests ---

describe("RealizationAgent", () => {
  let agent: RealizationAgent;

  beforeEach(() => {
    vi.clearAllMocks();

    agent = new RealizationAgent(
      makeConfig(), "org-456",
      new MemorySystem({} as never) as never,
      new LLMGateway("custom") as never,
      new CircuitBreaker() as never,
    );

    // Default: hypotheses, KPIs, and integrity results available
    mockRetrieve.mockImplementation((query: Record<string, unknown>) => {
      if (query.agent_id === "opportunity") return Promise.resolve(STORED_HYPOTHESES);
      if (query.agent_id === "target") return Promise.resolve(STORED_KPIS);
      if (query.agent_id === "integrity") return Promise.resolve(STORED_INTEGRITY);
      return Promise.resolve([]);
    });

    // Default: successful LLM response
    mockComplete.mockResolvedValue({
      id: "resp-1", model: "test-model",
      content: SUCCESS_RESPONSE, finish_reason: "stop",
      usage: { prompt_tokens: 800, completion_tokens: 600, total_tokens: 1400 },
    });
  });

  describe("execute — success scenario", () => {
    it("generates realization plans and returns success", async () => {
      const result = await agent.execute(makeContext());

      expect(result.status).toBe("success");
      expect(result.agent_type).toBe("realization");
      expect(result.lifecycle_stage).toBe("realization");
      expect(result.result.plans_count).toBe(1);
      expect(result.result.total_milestones).toBe(2);
    });

    it("includes investment and ROI timeline in result", async () => {
      const result = await agent.execute(makeContext());

      expect(result.result.total_estimated_investment).toBe(170000);
      expect(result.result.expected_roi_timeline_months).toBe(18);
      expect(result.result.tracking_metrics).toHaveLength(1);
      expect(result.result.critical_success_factors).toHaveLength(2);
    });

    it("includes SDUI sections with AgentResponseCard and ConfidenceDisplay", async () => {
      const result = await agent.execute(makeContext());

      const components = (result.result.sdui_sections as Array<Record<string, unknown>>).map(
        (s) => s.component,
      );
      expect(components).toContain("AgentResponseCard");
      expect(components).toContain("ConfidenceDisplay");
      expect(components).toContain("MilestoneTimeline");
    });

    it("includes reasoning with plan counts and investment", async () => {
      const result = await agent.execute(makeContext());

      expect(result.reasoning).toContain("1 realization plans");
      expect(result.reasoning).toContain("2 milestones");
      expect(result.reasoning).toContain("170,000");
    });

    it("stores realization summary and plans in memory", async () => {
      await agent.execute(makeContext());

      // 1 tracking call from secureInvoke + 1 summary + 1 plan = 3
      expect(mockStoreSemanticMemory).toHaveBeenCalledTimes(3);

      const summaryCall = mockStoreSemanticMemory.mock.calls.find(
        (call: unknown[]) => (call[4] as Record<string, unknown>)?.type === "realization_summary",
      );
      expect(summaryCall).toBeDefined();
      expect((summaryCall![4] as Record<string, unknown>).plans_count).toBe(1);

      const planCall = mockStoreSemanticMemory.mock.calls.find(
        (call: unknown[]) => (call[4] as Record<string, unknown>)?.type === "realization_plan",
      );
      expect(planCall).toBeDefined();
      expect((planCall![4] as Record<string, unknown>).hypothesis_id).toBe("hyp-1");
    });

    it("suggests next actions", async () => {
      const result = await agent.execute(makeContext());

      expect(result.suggested_next_actions).toContain("Review implementation milestones and resource requirements");
      expect(result.suggested_next_actions).toContain("Proceed to ExpansionAgent for growth opportunity analysis");
    });
  });

  describe("memory retrieval failures", () => {
    it("fails when no hypotheses or KPIs in memory", async () => {
      mockRetrieve.mockResolvedValue([]);

      const result = await agent.execute(makeContext());

      expect(result.status).toBe("failure");
      expect(result.result.error).toContain("No validated hypotheses or KPI targets found");
    });

    it("works with only hypotheses (no KPIs)", async () => {
      mockRetrieve.mockImplementation((query: Record<string, unknown>) => {
        if (query.agent_id === "opportunity") return Promise.resolve(STORED_HYPOTHESES);
        return Promise.resolve([]);
      });

      const result = await agent.execute(makeContext());

      expect(result.status).toBe("success");
      expect(result.result.plans_count).toBe(1);
    });

    it("handles memory retrieval failure gracefully", async () => {
      mockRetrieve.mockRejectedValue(new Error("Memory unavailable"));

      const result = await agent.execute(makeContext());

      expect(result.status).toBe("failure");
      expect(result.result.error).toContain("No validated hypotheses or KPI targets found");
    });
  });

  describe("LLM failure handling", () => {
    it("fails gracefully when LLM returns invalid JSON", async () => {
      mockComplete.mockResolvedValue({
        id: "resp-2", model: "test-model", content: "not json", finish_reason: "stop",
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

  describe("input validation", () => {
    it("throws on missing workspace_id", async () => {
      await expect(
        agent.execute(makeContext({ workspace_id: "" })),
      ).rejects.toThrow("Invalid input context");
    });

    it("throws on missing organization_id", async () => {
      await expect(
        agent.execute(makeContext({ organization_id: "" })),
      ).rejects.toThrow("Invalid input context");
    });
  });
});
