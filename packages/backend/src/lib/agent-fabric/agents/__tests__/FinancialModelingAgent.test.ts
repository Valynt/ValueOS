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

vi.mock("../../../../services/MCPGroundTruthService.js", () => ({
  mcpGroundTruthService: { getFinancialData: vi.fn().mockResolvedValue(null) },
}));

vi.mock("../../../../config/featureFlags.js", () => ({
  featureFlags: { ENABLE_DOMAIN_PACK_CONTEXT: false },
}));

vi.mock("../../../../agents/context/loadDomainContext.js", () => ({
  loadDomainContext: vi.fn().mockResolvedValue({
    pack: undefined, kpis: [], assumptions: [], glossary: {}, complianceRules: [],
  }),
  formatDomainContextForPrompt: vi.fn().mockReturnValue(""),
}));

// --- Imports ---

import { FinancialModelingAgent } from "../FinancialModelingAgent";
import { LLMGateway } from "../../LLMGateway";
import { MemorySystem } from "../../MemorySystem";
import { CircuitBreaker } from "../../CircuitBreaker";
import type { AgentConfig, LifecycleContext } from "../../../../types/agent";

// --- Helpers ---

function makeConfig(): AgentConfig {
  return {
    id: "financial-modeling-agent", name: "financial-modeling", type: "financial-modeling" as never,
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
    lifecycle_stage: "target", workspace_data: {}, user_inputs: {},
    ...overrides,
  };
}

// Hypotheses from OpportunityAgent
const STORED_HYPOTHESES = [
  {
    id: "mem_hyp_1", agent_id: "opportunity", workspace_id: "ws-123",
    content: "Hypothesis: Supply Chain Optimization — Reduce procurement costs.",
    memory_type: "semantic", importance: 0.75,
    created_at: "2024-01-01T00:00:00Z", accessed_at: "2024-01-01T00:00:00Z", access_count: 0,
    metadata: {
      verified: true, category: "cost_reduction",
      estimated_impact: { low: 500000, high: 1200000, unit: "usd", timeframe_months: 12 },
      confidence: 0.75, organization_id: "org-456",
    },
  },
];

// KPIs from TargetAgent
const STORED_KPIS = [
  {
    id: "mem_kpi_1", agent_id: "target", workspace_id: "ws-123",
    content: "KPI: procurement_cost_per_unit",
    memory_type: "semantic", importance: 0.7,
    created_at: "2024-01-01T00:00:00Z", accessed_at: "2024-01-01T00:00:00Z", access_count: 0,
    metadata: {
      kpi_id: "kpi-1",
      baseline: { value: 45.5 }, target: { value: 32, timeframe_months: 12 },
      unit: "currency", organization_id: "org-456",
    },
  },
];

// Successful LLM response
const SUCCESS_RESPONSE = JSON.stringify({
  assumptions: [
    {
      id: "asm-1", label: "Vendor consolidation savings rate",
      value: 0.15, unit: "percent", source: "Industry benchmark (Gartner 2024)",
      confidence: 0.8, sensitivity: "high",
    },
    {
      id: "asm-2", label: "Implementation timeline",
      value: 12, unit: "months", source: "Similar engagement data",
      confidence: 0.85, sensitivity: "medium",
    },
  ],
  costs: [
    { category: "software", description: "E-procurement platform license", amount: 50000, currency: "USD", frequency: "annual" },
    { category: "implementation", description: "Consulting and integration", amount: 120000, currency: "USD", frequency: "one_time" },
    { category: "training", description: "Staff training program", amount: 15000, currency: "USD", frequency: "one_time" },
  ],
  benefits: [
    {
      hypothesis_id: "hyp-1", category: "cost_savings",
      description: "Procurement cost reduction through vendor consolidation",
      amount_low: 500000, amount_high: 1200000, currency: "USD",
      timeframe_months: 12, confidence: 0.75,
    },
  ],
  roi_percent: 285.7,
  npv: 680000,
  payback_months: 8,
  irr_percent: 42.5,
  total_cost_of_ownership: 235000,
  total_expected_benefit_low: 500000,
  total_expected_benefit_high: 1200000,
  time_horizon_months: 36,
  sensitivity_analysis: [
    {
      variable: "Savings rate", base_value: 0.15,
      low_value: 0.10, high_value: 0.20,
      impact_on_roi_low: 180, impact_on_roi_high: 390,
    },
  ],
  risk_adjusted_roi_percent: 214.3,
  executive_summary: "The supply chain optimization initiative projects a 286% ROI with an 8-month payback period.",
});

// --- Tests ---

describe("FinancialModelingAgent", () => {
  let agent: FinancialModelingAgent;

  beforeEach(() => {
    vi.clearAllMocks();

    agent = new FinancialModelingAgent(
      makeConfig(), "org-456",
      new MemorySystem({} as never) as never,
      new LLMGateway("custom") as never,
      new CircuitBreaker() as never,
    );

    mockRetrieve.mockImplementation((query: Record<string, unknown>) => {
      if (query.agent_id === "opportunity") return Promise.resolve(STORED_HYPOTHESES);
      if (query.agent_id === "target") return Promise.resolve(STORED_KPIS);
      return Promise.resolve([]);
    });

    mockComplete.mockResolvedValue({
      id: "resp-1", model: "test-model",
      content: SUCCESS_RESPONSE, finish_reason: "stop",
    });
  });

  describe("execute — success scenario", () => {
    it("generates financial model and returns success", async () => {
      const result = await agent.execute(makeContext());

      expect(result.status).toBe("success");
      expect(result.agent_type).toBe("financial-modeling");
      expect(result.result.roi_percent).toBe(285.7);
      expect(result.result.npv).toBe(680000);
      expect(result.result.payback_months).toBe(8);
    });

    it("includes cost and benefit breakdowns", async () => {
      const result = await agent.execute(makeContext());

      expect(result.result.costs).toHaveLength(3);
      expect(result.result.benefits).toHaveLength(1);
      expect(result.result.total_cost_of_ownership).toBe(235000);
    });

    it("includes sensitivity analysis", async () => {
      const result = await agent.execute(makeContext());

      const sensitivity = result.result.sensitivity_analysis as Array<Record<string, unknown>>;
      expect(sensitivity).toHaveLength(1);
      expect(sensitivity[0].variable).toBe("Savings rate");
    });

    it("includes risk-adjusted ROI", async () => {
      const result = await agent.execute(makeContext());

      expect(result.result.risk_adjusted_roi_percent).toBe(214.3);
    });

    it("includes SDUI sections with AgentResponseCard, KPIForm, and ConfidenceDisplay", async () => {
      const result = await agent.execute(makeContext());

      const components = (result.result.sdui_sections as Array<Record<string, unknown>>).map(
        (s) => s.component,
      );
      expect(components).toContain("AgentResponseCard");
      expect(components).toContain("KPIForm");
      expect(components).toContain("ConfidenceDisplay");
    });

    it("includes reasoning with ROI, NPV, and payback", async () => {
      const result = await agent.execute(makeContext());

      expect(result.reasoning).toContain("285.7%");
      expect(result.reasoning).toContain("680,000");
      expect(result.reasoning).toContain("8 months");
    });

    it("stores financial model and assumptions in memory", async () => {
      await agent.execute(makeContext());

      // 1 tracking from secureInvoke + 1 model summary + 2 assumptions = 4
      expect(mockStoreSemanticMemory).toHaveBeenCalledTimes(4);

      const modelCall = mockStoreSemanticMemory.mock.calls.find(
        (call: unknown[]) => (call[4] as Record<string, unknown>)?.type === "financial_model",
      );
      expect(modelCall).toBeDefined();
      expect((modelCall![4] as Record<string, unknown>).roi_percent).toBe(285.7);

      const assumptionCalls = mockStoreSemanticMemory.mock.calls.filter(
        (call: unknown[]) => (call[4] as Record<string, unknown>)?.type === "financial_assumption",
      );
      expect(assumptionCalls).toHaveLength(2);
    });

    it("suggests next actions", async () => {
      const result = await agent.execute(makeContext());

      expect(result.suggested_next_actions).toContain("Review financial assumptions with stakeholders");
      expect(result.suggested_next_actions).toContain("Proceed to IntegrityAgent for validation");
    });
  });

  describe("memory retrieval failures", () => {
    it("fails when no hypotheses in memory", async () => {
      mockRetrieve.mockResolvedValue([]);

      const result = await agent.execute(makeContext());

      expect(result.status).toBe("failure");
      expect(result.result.error).toContain("No hypotheses found");
    });

    it("handles memory retrieval failure gracefully", async () => {
      mockRetrieve.mockRejectedValue(new Error("Memory unavailable"));

      const result = await agent.execute(makeContext());

      expect(result.status).toBe("failure");
    });
  });

  describe("LLM failure handling", () => {
    it("fails gracefully when LLM returns invalid JSON", async () => {
      mockComplete.mockResolvedValue({
        id: "resp-2", model: "test-model", content: "not json", finish_reason: "stop",
      });

      const result = await agent.execute(makeContext());

      expect(result.status).toBe("failure");
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
  });
});
