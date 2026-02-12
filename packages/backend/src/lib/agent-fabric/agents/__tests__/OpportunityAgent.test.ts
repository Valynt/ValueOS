import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks (must be before imports) ---

vi.mock("../../../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../LLMGateway.js", () => ({
  LLMGateway: class MockLLMGateway {
    constructor(_provider?: string) {}
    complete = vi.fn();
  },
}));

vi.mock("../../MemorySystem.js", () => ({
  MemorySystem: class MockMemorySystem {
    constructor(_config?: any) {}
    store = vi.fn().mockResolvedValue("mem_1");
    retrieve = vi.fn().mockResolvedValue([]);
    storeSemanticMemory = vi.fn().mockResolvedValue("mem_1");
    clear = vi.fn().mockResolvedValue(0);
  },
}));

vi.mock("../../CircuitBreaker.js", () => ({
  CircuitBreaker: class MockCircuitBreaker {
    constructor() {}
    execute = vi.fn().mockImplementation((fn: () => Promise<any>) => fn());
  },
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

// --- Imports ---

import { OpportunityAgent } from "../OpportunityAgent";
import { LLMGateway } from "../../LLMGateway";
import { MemorySystem } from "../../MemorySystem";
import { CircuitBreaker } from "../../CircuitBreaker";
import type { AgentConfig, LifecycleContext } from "../../../../types/agent";

// --- Helpers ---

function makeConfig(): AgentConfig {
  return {
    id: "opportunity-agent",
    name: "opportunity",
    type: "opportunity" as any,
    lifecycle_stage: "opportunity",
    capabilities: [],
    model: { provider: "custom", model_name: "test" },
    prompts: { system_prompt: "", user_prompt_template: "" },
    parameters: {
      timeout_seconds: 30,
      max_retries: 3,
      retry_delay_ms: 1000,
      enable_caching: false,
      enable_telemetry: false,
    },
    constraints: {
      max_input_tokens: 4096,
      max_output_tokens: 4096,
      allowed_actions: [],
      forbidden_actions: [],
      required_permissions: [],
    },
  };
}

function makeContext(overrides: Partial<LifecycleContext> = {}): LifecycleContext {
  return {
    workspace_id: "ws-123",
    organization_id: "org-456",
    user_id: "user-789",
    lifecycle_stage: "opportunity",
    workspace_data: {},
    user_inputs: { query: "Analyze Acme Corp for cost reduction opportunities" },
    ...overrides,
  };
}

const VALID_LLM_RESPONSE = JSON.stringify({
  company_summary: "Acme Corp is a mid-market manufacturing company.",
  industry_context: "Manufacturing sector facing margin pressure from supply chain costs.",
  hypotheses: [
    {
      title: "Supply Chain Optimization",
      description: "Reduce procurement costs through vendor consolidation.",
      category: "cost_reduction",
      estimated_impact: { low: 500000, high: 1200000, unit: "usd", timeframe_months: 12 },
      confidence: 0.75,
      evidence: ["Current vendor count exceeds industry median by 40%"],
      assumptions: ["Vendor consolidation is feasible within 6 months"],
      kpi_targets: ["procurement_cost_per_unit", "vendor_count"],
    },
    {
      title: "Operational Efficiency Gains",
      description: "Automate manual QA processes to reduce cycle time.",
      category: "operational_efficiency",
      estimated_impact: { low: 200000, high: 600000, unit: "usd", timeframe_months: 18 },
      confidence: 0.65,
      evidence: ["Manual QA accounts for 30% of production cycle time"],
      assumptions: ["Automation tooling is compatible with existing systems"],
      kpi_targets: ["cycle_time_hours", "defect_rate"],
    },
  ],
  stakeholder_roles: [
    {
      role: "VP Operations",
      relevance: "Owns supply chain and production processes",
      likely_concerns: ["Implementation disruption", "ROI timeline"],
    },
  ],
  recommended_next_steps: [
    "Schedule discovery call with VP Operations",
    "Request current vendor spend breakdown",
  ],
});

// --- Tests ---

describe("OpportunityAgent", () => {
  let agent: OpportunityAgent;
  let mockLLMGateway: any;
  let mockMemorySystem: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockLLMGateway = new LLMGateway("custom");
    mockMemorySystem = new MemorySystem({} as any);
    const mockCircuitBreaker = new CircuitBreaker() as any;

    agent = new OpportunityAgent(
      makeConfig(),
      "org-456",
      mockMemorySystem,
      mockLLMGateway,
      mockCircuitBreaker,
    );

    // Default: LLM returns valid response
    mockLLMGateway.complete.mockResolvedValue({
      id: "resp-1",
      model: "test-model",
      content: VALID_LLM_RESPONSE,
      finish_reason: "stop",
      usage: { prompt_tokens: 500, completion_tokens: 300, total_tokens: 800 },
    });

    // Default: no ground truth data
    mockGetFinancialData.mockResolvedValue(null);
  });

  describe("execute", () => {
    it("generates hypotheses from LLM and returns structured output", async () => {
      const result = await agent.execute(makeContext());

      expect(result.status).toBe("success");
      expect(result.agent_type).toBe("opportunity");
      expect(result.lifecycle_stage).toBe("opportunity");
      expect(result.result.hypotheses).toHaveLength(2);
      expect(result.result.hypotheses[0].title).toBe("Supply Chain Optimization");
      expect(result.result.hypotheses[1].title).toBe("Operational Efficiency Gains");
      expect(result.result.company_summary).toContain("Acme Corp");
      expect(result.result.recommended_next_steps).toHaveLength(2);
    });

    it("includes SDUI sections in the result", async () => {
      const result = await agent.execute(makeContext());

      expect(result.result.sdui_sections).toBeDefined();
      expect(result.result.sdui_sections.length).toBeGreaterThanOrEqual(3);

      // First section: AgentResponseCard
      expect(result.result.sdui_sections[0].component).toBe("AgentResponseCard");
      expect(result.result.sdui_sections[0].props.stage).toBe("opportunity");

      // Next sections: DiscoveryCards for each hypothesis
      expect(result.result.sdui_sections[1].component).toBe("DiscoveryCard");
      expect(result.result.sdui_sections[1].props.title).toBe("Supply Chain Optimization");
      expect(result.result.sdui_sections[2].component).toBe("DiscoveryCard");
    });

    it("stores hypotheses in memory for downstream agents", async () => {
      await agent.execute(makeContext());

      // secureInvoke stores 1 tracking memory, then 2 hypotheses = 3 total
      expect(mockMemorySystem.storeSemanticMemory).toHaveBeenCalledTimes(3);

      // Find the hypothesis storage calls (agent_id = "opportunity", not the tracking call)
      const hypothesisCalls = mockMemorySystem.storeSemanticMemory.mock.calls.filter(
        (call: any[]) => call[4]?.category !== undefined,
      );
      expect(hypothesisCalls).toHaveLength(2);

      const firstCall = hypothesisCalls[0];
      expect(firstCall[0]).toBe("ws-123"); // workspace_id
      expect(firstCall[1]).toBe("opportunity"); // agent_id
      expect(firstCall[2]).toBe("semantic"); // memory_type
      expect(firstCall[3]).toContain("Supply Chain Optimization");
      expect(firstCall[4].category).toBe("cost_reduction");
      expect(firstCall[4].verified).toBe(true);
      expect(firstCall[5]).toBe("org-456"); // organization_id
    });

    it("sets confidence level based on average hypothesis confidence", async () => {
      const result = await agent.execute(makeContext());

      // Average of 0.75 and 0.65 = 0.70 → "high"
      expect(result.confidence).toBe("high");
    });

    it("includes reasoning with hypothesis count", async () => {
      const result = await agent.execute(makeContext());

      expect(result.reasoning).toContain("2 value hypotheses");
      expect(result.reasoning).toContain("Acme Corp");
    });

    it("fails gracefully when no query is provided", async () => {
      const result = await agent.execute(makeContext({
        user_inputs: { query: "" },
      }));

      expect(result.status).toBe("failure");
      expect(result.confidence).toBe("low");
      expect(result.result.error).toContain("No query provided");
    });

    it("fails gracefully when LLM returns invalid JSON", async () => {
      mockLLMGateway.complete.mockResolvedValue({
        id: "resp-2",
        model: "test-model",
        content: "This is not JSON",
        finish_reason: "stop",
      });

      const result = await agent.execute(makeContext());

      expect(result.status).toBe("failure");
      expect(result.result.error).toContain("failed");
    });

    it("fails gracefully when LLM throws", async () => {
      mockLLMGateway.complete.mockRejectedValue(new Error("LLM service unavailable"));

      const result = await agent.execute(makeContext());

      expect(result.status).toBe("failure");
    });
  });

  describe("ground truth integration", () => {
    const mockFinancialData = {
      entityName: "Acme Corp",
      entityId: "ACME",
      period: "FY2024",
      metrics: {
        revenue: { value: 500000000, unit: "USD", source: "EDGAR", confidence: 0.95, asOfDate: "2024-12-31" },
        operatingMargin: { value: 0.12, unit: "ratio", source: "EDGAR", confidence: 0.95, asOfDate: "2024-12-31" },
      },
      industryBenchmarks: {
        operatingMargin: { median: 0.15, p25: 0.10, p75: 0.20 },
      },
      sources: ["EDGAR", "SEC 10-K"],
    };

    it("fetches ground truth when entity_id is provided", async () => {
      mockGetFinancialData.mockResolvedValue(mockFinancialData);

      const result = await agent.execute(makeContext({
        user_inputs: {
          query: "Analyze Acme Corp",
          entity_id: "ACME",
        },
      }));

      expect(mockGetFinancialData).toHaveBeenCalledWith(
        expect.objectContaining({ entityId: "ACME" }),
      );
      expect(result.result.financial_grounding).toBeDefined();
      expect(result.result.financial_grounding.entity).toBe("Acme Corp");
      expect(result.result.financial_grounding.sources).toContain("EDGAR");
    });

    it("includes KPIForm SDUI section when financial data is available", async () => {
      mockGetFinancialData.mockResolvedValue(mockFinancialData);

      const result = await agent.execute(makeContext({
        user_inputs: { query: "Analyze Acme Corp", entity_id: "ACME" },
      }));

      const kpiSection = result.result.sdui_sections.find(
        (s: any) => s.component === "KPIForm",
      );
      expect(kpiSection).toBeDefined();
      expect(kpiSection.props.title).toContain("Acme Corp");
    });

    it("proceeds without grounding when ground truth fails", async () => {
      mockGetFinancialData.mockRejectedValue(new Error("Service unavailable"));

      const result = await agent.execute(makeContext({
        user_inputs: { query: "Analyze Acme Corp", entity_id: "ACME" },
      }));

      expect(result.status).toBe("success");
      expect(result.result.financial_grounding).toBeNull();
    });

    it("proceeds without grounding when no entity_id is provided", async () => {
      const result = await agent.execute(makeContext());

      expect(mockGetFinancialData).not.toHaveBeenCalled();
      expect(result.result.financial_grounding).toBeNull();
    });

    it("includes grounding reference in reasoning when data is available", async () => {
      mockGetFinancialData.mockResolvedValue(mockFinancialData);

      const result = await agent.execute(makeContext({
        user_inputs: { query: "Analyze Acme Corp", entity_id: "ACME" },
      }));

      expect(result.reasoning).toContain("financial grounding");
      expect(result.reasoning).toContain("EDGAR");
    });
  });
});
