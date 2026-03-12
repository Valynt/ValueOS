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
import { FinancialModelingAgent } from "../FinancialModelingAgent";

// --- Helpers ---

function makeConfig(): AgentConfig {
  return {
    id: "financial-modeling-agent", name: "financial_modeling", type: "financial_modeling" as any,
    lifecycle_stage: "modeling", capabilities: [],
    model: { provider: "custom", model_name: "test" },
    prompts: { system_prompt: "", user_prompt_template: "" },
    parameters: { timeout_seconds: 30, max_retries: 3, retry_delay_ms: 1000, enable_caching: false, enable_telemetry: false },
    constraints: { max_input_tokens: 4096, max_output_tokens: 4096, allowed_actions: [], forbidden_actions: [], required_permissions: [] },
  };
}

function makeContext(overrides: Partial<LifecycleContext> = {}): LifecycleContext {
  return {
    workspace_id: "ws-123", organization_id: "org-456", user_id: "user-789",
    lifecycle_stage: "modeling", workspace_data: {}, user_inputs: {},
    ...overrides,
  };
}

// Hypotheses as stored by OpportunityAgent
const STORED_HYPOTHESES = [
  {
    id: "mem_hyp_1", agent_id: "opportunity", workspace_id: "ws-123",
    content: "Hypothesis: Supply Chain Optimization — Reduce procurement costs through vendor consolidation.",
    memory_type: "semantic", importance: 0.75,
    created_at: "2024-01-01T00:00:00Z", accessed_at: "2024-01-01T00:00:00Z", access_count: 0,
    metadata: {
      verified: true, category: "cost_reduction",
      confidence: 0.8,
      estimated_impact: { low: 500000, high: 1200000, unit: "usd" },
      organization_id: "org-456",
    },
  },
  {
    id: "mem_hyp_2", agent_id: "opportunity", workspace_id: "ws-123",
    content: "Hypothesis: Customer Retention Program — Reduce churn through proactive engagement.",
    memory_type: "semantic", importance: 0.8,
    created_at: "2024-01-01T00:00:00Z", accessed_at: "2024-01-01T00:00:00Z", access_count: 0,
    metadata: {
      verified: true, category: "revenue_growth",
      confidence: 0.7,
      estimated_impact: { low: 300000, high: 800000, unit: "usd" },
      organization_id: "org-456",
    },
  },
];

// LLM response with two projections
const LLM_RESPONSE = JSON.stringify({
  projections: [
    {
      hypothesis_id: "hyp-1",
      hypothesis_description: "Supply Chain Optimization",
      category: "cost_reduction",
      assumptions: [
        "Vendor consolidation reduces unit costs by 20%",
        "Implementation takes 6 months",
        "Annual procurement spend is $5M",
      ],
      cash_flows: [-200000, 150000, 300000, 350000],
      currency: "USD",
      period_type: "annual",
      discount_rate: 0.10,
      total_investment: 200000,
      total_benefit: 800000,
      confidence: 0.8,
      risk_factors: ["Vendor switching costs may exceed estimates", "Supply disruption during transition"],
      data_sources: ["ERP procurement data Q4 2024", "Vendor quotes"],
    },
    {
      hypothesis_id: "hyp-2",
      hypothesis_description: "Customer Retention Program",
      category: "revenue_growth",
      assumptions: [
        "Churn reduction from 22% to 15%",
        "Average customer LTV is $50K",
        "Program cost is $150K/year",
      ],
      cash_flows: [-150000, 100000, 200000, 250000],
      currency: "USD",
      period_type: "annual",
      discount_rate: 0.12,
      total_investment: 150000,
      total_benefit: 550000,
      confidence: 0.7,
      risk_factors: ["Customer behavior may not change as predicted"],
      data_sources: ["CRM churn analysis", "Customer survey data"],
    },
  ],
  portfolio_summary: "Two models with combined positive NPV. Supply chain optimization has stronger ROI.",
  key_assumptions: ["Stable market conditions", "No major regulatory changes"],
  sensitivity_parameters: [
    { name: "discount_rate", base_value: 0.10, perturbations: [0.06, 0.08, 0.10, 0.12, 0.14] },
  ],
  recommended_next_steps: ["Validate vendor quotes", "Run customer survey"],
});

// --- Tests ---

describe("FinancialModelingAgent", () => {
  let agent: FinancialModelingAgent;

  beforeEach(() => {
    vi.clearAllMocks();

    agent = new FinancialModelingAgent(
      makeConfig(), "org-456",
      new MemorySystem({} as any) as any,
      new LLMGateway("custom") as any,
      new CircuitBreaker() as any,
    );

    mockRetrieve.mockImplementation((query: any) => {
      if (query.agent_id === "opportunity") return Promise.resolve(STORED_HYPOTHESES);
      return Promise.resolve([]);
    });

    mockComplete.mockResolvedValue({
      id: "resp-1", model: "test-model",
      content: LLM_RESPONSE, finish_reason: "stop",
      usage: { prompt_tokens: 800, completion_tokens: 600, total_tokens: 1400 },
    });
  });

  describe("execute — successful modeling", () => {
    it("rejects context when organization_id mismatches agent tenant", async () => {
      await expect(
        agent.execute(makeContext({ organization_id: "org-other" }))
      ).rejects.toThrow(/Tenant context mismatch/);
    });

    it("produces financial models and returns success", async () => {
      const result = await agent.execute(makeContext());

      expect(result.status).toBe("success");
      expect(result.agent_type).toBe("modeling");
      expect(result.lifecycle_stage).toBe("modeling");
      expect(result.result.models_count).toBe(2);
    });

    it("computes NPV using decimal.js economic kernel", async () => {
      const result = await agent.execute(makeContext());

      const models = result.result.models as any[];
      // NPV for [-200000, 150000, 300000, 350000] at 10%:
      // = -200000 + 150000/1.1 + 300000/1.21 + 350000/1.331
      // ≈ -200000 + 136363.64 + 247933.88 + 262960.18 ≈ 447257.70
      expect(models[0].npv).toBeCloseTo(447257.70, -1);
      expect(models[0].npv).toBeGreaterThan(0);
    });

    it("computes ROI using decimal.js", async () => {
      const result = await agent.execute(makeContext());

      const models = result.result.models as any[];
      // ROI = (800000 - 200000) / 200000 = 3.0
      expect(models[0].roi).toBe(3);
    });

    it("computes IRR via Newton-Raphson", async () => {
      const result = await agent.execute(makeContext());

      const models = result.result.models as any[];
      expect(models[0].irr).not.toBeNull();
      expect(models[0].irr_converged).toBe(true);
      // IRR should be well above the discount rate given the positive NPV
      expect(models[0].irr).toBeGreaterThan(0.1);
    });

    it("computes payback period", async () => {
      const result = await agent.execute(makeContext());

      const models = result.result.models as any[];
      // Cumulative: -200000, -50000, 250000 → payback in period 2
      expect(models[0].payback_period).toBe(2);
      expect(models[0].payback_fractional).toBeGreaterThan(1);
      expect(models[0].payback_fractional).toBeLessThan(3);
    });

    it("runs sensitivity analysis on discount rate", async () => {
      const result = await agent.execute(makeContext());

      const models = result.result.models as any[];
      expect(models[0].sensitivity).toHaveLength(1);
      expect(models[0].sensitivity[0].parameter).toBe("discount_rate");
      expect(models[0].sensitivity[0].points).toHaveLength(5);
      // NPV should decrease as discount rate increases
      const npvs = models[0].sensitivity[0].points.map((p: any) => p.npv);
      for (let i = 1; i < npvs.length; i++) {
        expect(npvs[i]).toBeLessThan(npvs[i - 1]);
      }
    });

    it("includes total portfolio NPV", async () => {
      const result = await agent.execute(makeContext());

      expect(result.result.total_npv).toBeGreaterThan(0);
      expect(result.result.positive_npv_count).toBe(2);
    });

    it("includes SDUI sections with charts and value tree", async () => {
      const result = await agent.execute(makeContext());

      const components = (result.result.sdui_sections as any[]).map(s => s.component);
      expect(components).toContain("AgentResponseCard");
      expect(components).toContain("InteractiveChart");
      expect(components).toContain("ValueTreeCard");
    });

    it("stores models and portfolio summary in memory", async () => {
      await agent.execute(makeContext());

      // 1 tracking call from secureInvoke + 2 models + 1 portfolio summary = 4
      expect(mockStoreSemanticMemory).toHaveBeenCalledTimes(4);

      const modelCalls = mockStoreSemanticMemory.mock.calls.filter(
        (call: any[]) => call[4]?.type === "financial_model",
      );
      expect(modelCalls).toHaveLength(2);

      const summaryCalls = mockStoreSemanticMemory.mock.calls.filter(
        (call: any[]) => call[4]?.type === "portfolio_summary",
      );
      expect(summaryCalls).toHaveLength(1);
    });

    it("stores NPV and ROI in memory metadata for downstream agents", async () => {
      await agent.execute(makeContext());

      const modelCalls = mockStoreSemanticMemory.mock.calls.filter(
        (call: any[]) => call[4]?.type === "financial_model",
      );
      expect(modelCalls[0][4].npv).toBeGreaterThan(0);
      expect(modelCalls[0][4].roi).toBe(3);
      expect(modelCalls[0][4].organization_id).toBe("org-456");
    });

    it("includes reasoning with NPV and model counts", async () => {
      const result = await agent.execute(makeContext());

      expect(result.reasoning).toContain("2 financial models");
      expect(result.reasoning).toContain("2 hypotheses");
      expect(result.reasoning).toContain("2/2 models have positive NPV");
    });
  });

  describe("memory retrieval", () => {
    it("fails when no hypotheses in memory", async () => {
      mockRetrieve.mockResolvedValue([]);

      const result = await agent.execute(makeContext());

      expect(result.status).toBe("failure");
      expect(result.result.error).toContain("No hypotheses found");
    });

    it("filters for verified hypotheses only", async () => {
      const unverified = [{
        ...STORED_HYPOTHESES[0],
        metadata: { ...STORED_HYPOTHESES[0].metadata, verified: false },
      }];
      mockRetrieve.mockResolvedValue(unverified);

      const result = await agent.execute(makeContext());

      expect(result.status).toBe("failure");
    });

    it("retrieves from opportunity agent with tenant scope", async () => {
      await agent.execute(makeContext());

      expect(mockRetrieve).toHaveBeenCalledWith(
        expect.objectContaining({ agent_id: "opportunity", organization_id: "org-456" }),
      );
    });
  });

  describe("domain pack context", () => {
    it("passes domain pack info to LLM when available", async () => {
      const ctx = makeContext({
        workspace_data: {
          domain_pack: { sector: "manufacturing", discount_rate: 0.08, risk_profile: "conservative" },
        },
      });

      await agent.execute(ctx);

      const promptArg = mockComplete.mock.calls[0][0].messages[0].content;
      expect(promptArg).toContain("manufacturing");
      expect(promptArg).toContain("0.08");
      expect(promptArg).toContain("conservative");
    });
  });

  describe("LLM failure", () => {
    it("returns failure when LLM call fails", async () => {
      mockComplete.mockRejectedValue(new Error("LLM timeout"));

      const result = await agent.execute(makeContext());

      expect(result.status).toBe("failure");
      expect(result.result.error).toContain("Financial projection generation failed");
    });
  });

  describe("input validation", () => {
    it("throws when context is missing required fields", async () => {
      const ctx = makeContext({ workspace_id: "" });

      await expect(agent.execute(ctx)).rejects.toThrow("Invalid input context");
    });
  });
});
