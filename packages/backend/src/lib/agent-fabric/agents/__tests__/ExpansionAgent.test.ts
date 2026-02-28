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

import { ExpansionAgent } from "../ExpansionAgent";
import { LLMGateway } from "../../LLMGateway";
import { MemorySystem } from "../../MemorySystem";
import { CircuitBreaker } from "../../CircuitBreaker";
import type { AgentConfig, LifecycleContext } from "../../../../types/agent";

// --- Helpers ---

function makeConfig(): AgentConfig {
  return {
    id: "expansion-agent", name: "expansion", type: "expansion" as never,
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

// Realization plans from RealizationAgent
const STORED_REALIZATION = [
  {
    id: "mem_real_1", agent_id: "realization", workspace_id: "ws-123",
    content: 'Realization plan for "Supply Chain Optimization": Consolidate vendors.',
    memory_type: "semantic", importance: 0.78,
    created_at: "2024-01-01T00:00:00Z", accessed_at: "2024-01-01T00:00:00Z", access_count: 0,
    metadata: {
      type: "realization_plan", hypothesis_id: "hyp-1",
      timeline_months: 12, confidence: 0.78, organization_id: "org-456",
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
      organization_id: "org-456",
    },
  },
];

// Successful LLM response
const SUCCESS_RESPONSE = JSON.stringify({
  opportunities: [
    {
      id: "exp-1",
      title: "Cross-sell Procurement Analytics",
      description: "Offer procurement analytics dashboard to existing supply chain optimization customers.",
      type: "cross_sell",
      source_hypothesis_id: "hyp-1",
      estimated_revenue_impact: { low: 200000, high: 500000, currency: "USD", timeframe_months: 18 },
      effort_level: "medium",
      priority_score: 0.82,
      prerequisites: ["Completed supply chain optimization implementation"],
      risks: ["Customer budget constraints"],
      confidence: 0.75,
    },
    {
      id: "exp-2",
      title: "Market Expansion to Adjacent Industries",
      description: "Apply procurement optimization methodology to manufacturing sector.",
      type: "market_expansion",
      estimated_revenue_impact: { low: 800000, high: 2000000, currency: "USD", timeframe_months: 24 },
      effort_level: "high",
      priority_score: 0.68,
      prerequisites: ["Case study from current engagement", "Manufacturing domain expertise"],
      risks: ["Different regulatory requirements", "Longer sales cycles"],
      confidence: 0.6,
    },
  ],
  market_assessment: "Strong expansion potential in adjacent procurement technology markets.",
  account_health_indicators: [
    { indicator: "NPS Score", status: "strong", description: "Customer satisfaction is high based on implementation progress." },
    { indicator: "Engagement Level", status: "moderate", description: "Regular touchpoints but could increase executive sponsorship." },
  ],
  recommended_sequence: [
    "Complete current supply chain optimization",
    "Launch procurement analytics cross-sell",
    "Develop manufacturing sector case study",
  ],
  total_addressable_expansion: { low: 1000000, high: 2500000, currency: "USD", timeframe_months: 24 },
  retention_risk_factors: [
    { factor: "Competitor pricing pressure", severity: "medium", mitigation: "Demonstrate unique ROI through value tracking" },
  ],
});

// --- Tests ---

describe("ExpansionAgent", () => {
  let agent: ExpansionAgent;

  beforeEach(() => {
    vi.clearAllMocks();

    agent = new ExpansionAgent(
      makeConfig(), "org-456",
      new MemorySystem({} as never) as never,
      new LLMGateway("custom") as never,
      new CircuitBreaker() as never,
    );

    // Default: all upstream data available
    mockRetrieve.mockImplementation((query: Record<string, unknown>) => {
      if (query.agent_id === "opportunity") return Promise.resolve(STORED_HYPOTHESES);
      if (query.agent_id === "realization") return Promise.resolve(STORED_REALIZATION);
      if (query.agent_id === "target") return Promise.resolve(STORED_KPIS);
      return Promise.resolve([]);
    });

    mockComplete.mockResolvedValue({
      id: "resp-1", model: "test-model",
      content: SUCCESS_RESPONSE, finish_reason: "stop",
    });
  });

  describe("execute — success scenario", () => {
    it("generates expansion opportunities and returns success", async () => {
      const result = await agent.execute(makeContext());

      expect(result.status).toBe("success");
      expect(result.agent_type).toBe("expansion");
      expect(result.lifecycle_stage).toBe("expansion");
      expect(result.result.opportunities_count).toBe(2);
    });

    it("includes total addressable expansion in result", async () => {
      const result = await agent.execute(makeContext());

      const tae = result.result.total_addressable_expansion as Record<string, unknown>;
      expect(tae.low).toBe(1000000);
      expect(tae.high).toBe(2500000);
    });

    it("includes account health indicators", async () => {
      const result = await agent.execute(makeContext());

      const indicators = result.result.account_health_indicators as Array<Record<string, unknown>>;
      expect(indicators).toHaveLength(2);
      expect(indicators[0].indicator).toBe("NPS Score");
    });

    it("includes SDUI sections with AgentResponseCard, ConfidenceDisplay, and DiscoveryCards", async () => {
      const result = await agent.execute(makeContext());

      const components = (result.result.sdui_sections as Array<Record<string, unknown>>).map(
        (s) => s.component,
      );
      expect(components).toContain("AgentResponseCard");
      expect(components).toContain("ConfidenceDisplay");
      expect(components.filter(c => c === "DiscoveryCard")).toHaveLength(2);
    });

    it("includes reasoning with opportunity count and addressable expansion", async () => {
      const result = await agent.execute(makeContext());

      expect(result.reasoning).toContain("2 expansion opportunities");
      expect(result.reasoning).toContain("1,000,000");
      expect(result.reasoning).toContain("2,500,000");
    });

    it("stores expansion summary and opportunities in memory", async () => {
      await agent.execute(makeContext());

      // 1 tracking call from secureInvoke + 1 summary + 2 opportunities = 4
      expect(mockStoreSemanticMemory).toHaveBeenCalledTimes(4);

      const summaryCall = mockStoreSemanticMemory.mock.calls.find(
        (call: unknown[]) => (call[4] as Record<string, unknown>)?.type === "expansion_summary",
      );
      expect(summaryCall).toBeDefined();
      expect((summaryCall![4] as Record<string, unknown>).opportunities_count).toBe(2);

      const oppCalls = mockStoreSemanticMemory.mock.calls.filter(
        (call: unknown[]) => (call[4] as Record<string, unknown>)?.type === "expansion_opportunity",
      );
      expect(oppCalls).toHaveLength(2);
    });

    it("suggests recommended sequence as next actions", async () => {
      const result = await agent.execute(makeContext());

      expect(result.suggested_next_actions).toContain("Complete current supply chain optimization");
    });
  });

  describe("memory retrieval failures", () => {
    it("fails when no hypotheses or realization plans in memory", async () => {
      mockRetrieve.mockResolvedValue([]);

      const result = await agent.execute(makeContext());

      expect(result.status).toBe("failure");
      expect(result.result.error).toContain("No hypotheses or realization plans found");
    });

    it("works with only hypotheses (no realization plans)", async () => {
      mockRetrieve.mockImplementation((query: Record<string, unknown>) => {
        if (query.agent_id === "opportunity") return Promise.resolve(STORED_HYPOTHESES);
        return Promise.resolve([]);
      });

      const result = await agent.execute(makeContext());

      expect(result.status).toBe("success");
    });

    it("works with only realization plans (no hypotheses)", async () => {
      mockRetrieve.mockImplementation((query: Record<string, unknown>) => {
        if (query.agent_id === "realization") return Promise.resolve(STORED_REALIZATION);
        return Promise.resolve([]);
      });

      const result = await agent.execute(makeContext());

      expect(result.status).toBe("success");
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
  });
});
