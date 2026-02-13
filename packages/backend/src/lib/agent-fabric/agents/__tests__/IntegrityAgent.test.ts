import { describe, it, expect, vi, beforeEach } from "vitest";

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

import { IntegrityAgent } from "../IntegrityAgent";
import { LLMGateway } from "../../LLMGateway";
import { MemorySystem } from "../../MemorySystem";
import { CircuitBreaker } from "../../CircuitBreaker";
import type { AgentConfig, LifecycleContext } from "../../../../types/agent";

// --- Helpers ---

function makeConfig(): AgentConfig {
  return {
    id: "integrity-agent", name: "integrity", type: "integrity" as any,
    lifecycle_stage: "integrity", capabilities: [],
    model: { provider: "custom", model_name: "test" },
    prompts: { system_prompt: "", user_prompt_template: "" },
    parameters: { timeout_seconds: 30, max_retries: 3, retry_delay_ms: 1000, enable_caching: false, enable_telemetry: false },
    constraints: { max_input_tokens: 4096, max_output_tokens: 4096, allowed_actions: [], forbidden_actions: [], required_permissions: [] },
  };
}

function makeContext(overrides: Partial<LifecycleContext> = {}): LifecycleContext {
  return {
    workspace_id: "ws-123", organization_id: "org-456", user_id: "user-789",
    lifecycle_stage: "integrity", workspace_data: {}, user_inputs: {},
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
];

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

// LLM response: all claims supported, high scores
const ALL_SUPPORTED_RESPONSE = JSON.stringify({
  claim_validations: [
    {
      claim_id: "kpi-kpi-1",
      claim_text: 'KPI "procurement_cost_per_unit" can move from 45.5 to 32',
      verdict: "supported",
      confidence: 0.85,
      evidence_assessment: "Baseline is sourced from ERP, causal link verified.",
      issues: [],
    },
    {
      claim_id: "hyp-mem_hyp_1",
      claim_text: "Supply Chain Optimization with estimated impact 500000-1200000",
      verdict: "supported",
      confidence: 0.80,
      evidence_assessment: "Vendor count data supports the hypothesis.",
      issues: [],
    },
  ],
  overall_assessment: "Both claims are well-supported by evidence.",
  data_quality_score: 0.9,
  logical_consistency_score: 0.88,
  evidence_coverage_score: 0.85,
});

// LLM response: one claim has a high-severity data integrity issue → triggers veto
const VETO_RESPONSE = JSON.stringify({
  claim_validations: [
    {
      claim_id: "kpi-kpi-1",
      claim_text: 'KPI "procurement_cost_per_unit" can move from 45.5 to 32',
      verdict: "unsupported",
      confidence: 0.3,
      evidence_assessment: "Baseline data is from 2 years ago and likely stale.",
      issues: [
        { type: "stale_data", severity: "high", description: "Baseline data is over 18 months old" },
        { type: "unsupported_assumption", severity: "high", description: "Vendor consolidation timeline is unrealistic" },
      ],
      suggested_fix: "Update baseline with current ERP data",
    },
    {
      claim_id: "hyp-mem_hyp_1",
      claim_text: "Supply Chain Optimization",
      verdict: "partially_supported",
      confidence: 0.5,
      evidence_assessment: "Some evidence, but vendor count data is unverified.",
      issues: [
        { type: "data_integrity", severity: "medium", description: "Vendor count not independently verified" },
      ],
    },
  ],
  overall_assessment: "Significant data quality concerns. Baseline data is stale.",
  data_quality_score: 0.4,
  logical_consistency_score: 0.6,
  evidence_coverage_score: 0.5,
});

// LLM response: low scores but no high-severity issues → triggers re-refine
const REREFINE_RESPONSE = JSON.stringify({
  claim_validations: [
    {
      claim_id: "kpi-kpi-1",
      claim_text: 'KPI "procurement_cost_per_unit"',
      verdict: "partially_supported",
      confidence: 0.6,
      evidence_assessment: "Some gaps in evidence.",
      issues: [
        { type: "unsupported_assumption", severity: "medium", description: "Timeline assumption needs validation" },
      ],
    },
    {
      claim_id: "hyp-mem_hyp_1",
      claim_text: "Supply Chain Optimization",
      verdict: "partially_supported",
      confidence: 0.55,
      evidence_assessment: "Evidence is directionally correct but thin.",
      issues: [],
    },
  ],
  overall_assessment: "Claims are directionally correct but need stronger evidence.",
  data_quality_score: 0.7,
  logical_consistency_score: 0.75,
  evidence_coverage_score: 0.65,
});

// --- Tests ---

describe("IntegrityAgent", () => {
  let agent: IntegrityAgent;

  beforeEach(() => {
    vi.clearAllMocks();

    agent = new IntegrityAgent(
      makeConfig(), "org-456",
      new MemorySystem({} as any) as any,
      new LLMGateway("custom") as any,
      new CircuitBreaker() as any,
    );

    // Default: both KPIs and hypotheses available
    mockRetrieve.mockImplementation((query: any) => {
      if (query.agent_id === "target") return Promise.resolve(STORED_KPIS);
      if (query.agent_id === "opportunity") return Promise.resolve(STORED_HYPOTHESES);
      return Promise.resolve([]);
    });

    // Default: all claims supported
    mockComplete.mockResolvedValue({
      id: "resp-1", model: "test-model",
      content: ALL_SUPPORTED_RESPONSE, finish_reason: "stop",
      usage: { prompt_tokens: 600, completion_tokens: 400, total_tokens: 1000 },
    });
  });

  describe("execute — pass scenario", () => {
    it("validates claims and returns success when all supported", async () => {
      const result = await agent.execute(makeContext());

      expect(result.status).toBe("success");
      expect(result.agent_type).toBe("integrity");
      expect(result.result.validated).toBe(true);
      expect(result.result.claims_checked).toBe(2);
      expect(result.result.claims_supported).toBe(2);
      expect(result.result.veto_decision.veto).toBe(false);
      expect(result.result.veto_decision.reRefine).toBe(false);
    });

    it("includes integrity scores", async () => {
      const result = await agent.execute(makeContext());

      expect(result.result.scores.data_quality).toBe(0.9);
      expect(result.result.scores.logical_consistency).toBe(0.88);
      expect(result.result.scores.evidence_coverage).toBe(0.85);
      // Overall = average of 0.9, 0.88, 0.85 ≈ 0.877
      expect(result.result.scores.overall).toBeCloseTo(0.877, 2);
    });

    it("includes SDUI sections with AgentResponseCard and ConfidenceDisplay", async () => {
      const result = await agent.execute(makeContext());

      const components = result.result.sdui_sections.map((s: any) => s.component);
      expect(components).toContain("AgentResponseCard");
      expect(components).toContain("ConfidenceDisplay");
      // No IntegrityVetoPanel when all claims are supported
      expect(components).not.toContain("IntegrityVetoPanel");
    });

    it("includes reasoning with claim counts and pass status", async () => {
      const result = await agent.execute(makeContext());

      expect(result.reasoning).toContain("2 claims");
      expect(result.reasoning).toContain("2 supported");
      expect(result.reasoning).toContain("Passed");
    });

    it("stores validation result in memory", async () => {
      await agent.execute(makeContext());

      // 1 tracking call from secureInvoke + 1 validation result = 2
      expect(mockStoreSemanticMemory).toHaveBeenCalledTimes(2);

      const validationCall = mockStoreSemanticMemory.mock.calls.find(
        (call: any[]) => call[4]?.type === "integrity_validation",
      );
      expect(validationCall).toBeDefined();
      expect(validationCall![4].claim_count).toBe(2);
      expect(validationCall![4].supported_count).toBe(2);
      expect(validationCall![4].veto).toBe(false);
    });
  });

  describe("execute — veto scenario", () => {
    beforeEach(() => {
      mockComplete.mockResolvedValue({
        id: "resp-2", model: "test-model",
        content: VETO_RESPONSE, finish_reason: "stop",
      });
    });

    it("vetoes when high-severity data integrity issues found", async () => {
      const result = await agent.execute(makeContext());

      expect(result.status).toBe("failure");
      expect(result.result.validated).toBe(false);
      expect(result.result.veto_decision.veto).toBe(true);
      expect(result.result.veto_decision.reason).toContain("data integrity");
    });

    it("includes IntegrityVetoPanel in SDUI when issues exist", async () => {
      const result = await agent.execute(makeContext());

      const components = result.result.sdui_sections.map((s: any) => s.component);
      expect(components).toContain("IntegrityVetoPanel");

      const vetoPanel = result.result.sdui_sections.find((s: any) => s.component === "IntegrityVetoPanel");
      expect(vetoPanel.props.issues.length).toBeGreaterThan(0);
    });

    it("reasoning includes VETOED", async () => {
      const result = await agent.execute(makeContext());

      expect(result.reasoning).toContain("VETOED");
    });

    it("suggests corrective actions on veto", async () => {
      const result = await agent.execute(makeContext());

      expect(result.suggested_next_actions).toContain("Address data integrity issues");
    });
  });

  describe("execute — re-refine scenario", () => {
    beforeEach(() => {
      mockComplete.mockResolvedValue({
        id: "resp-3", model: "test-model",
        content: REREFINE_RESPONSE, finish_reason: "stop",
      });
    });

    it("requests re-refinement when confidence below threshold", async () => {
      const result = await agent.execute(makeContext());

      expect(result.status).toBe("partial_success");
      expect(result.result.validated).toBe(false);
      expect(result.result.veto_decision.veto).toBe(false);
      expect(result.result.veto_decision.reRefine).toBe(true);
    });

    it("reasoning includes re-refinement request", async () => {
      const result = await agent.execute(makeContext());

      expect(result.reasoning).toContain("Re-refinement requested");
    });
  });

  describe("memory retrieval", () => {
    it("fails when no KPIs or hypotheses in memory", async () => {
      mockRetrieve.mockResolvedValue([]);

      const result = await agent.execute(makeContext());

      expect(result.status).toBe("failure");
      expect(result.result.error).toContain("No KPIs or hypotheses found");
    });

    it("works with only hypotheses (no KPIs)", async () => {
      mockRetrieve.mockImplementation((query: any) => {
        if (query.agent_id === "target") return Promise.resolve([]);
        if (query.agent_id === "opportunity") return Promise.resolve(STORED_HYPOTHESES);
        return Promise.resolve([]);
      });

      // LLM response for 1 claim
      mockComplete.mockResolvedValue({
        id: "resp-4", model: "test-model",
        content: JSON.stringify({
          claim_validations: [{
            claim_id: "hyp-mem_hyp_1", claim_text: "Supply Chain Optimization",
            verdict: "supported", confidence: 0.8,
            evidence_assessment: "Evidence supports the claim.", issues: [],
          }],
          overall_assessment: "Claim is supported.",
          data_quality_score: 0.9, logical_consistency_score: 0.9, evidence_coverage_score: 0.9,
        }),
        finish_reason: "stop",
      });

      const result = await agent.execute(makeContext());

      expect(result.status).toBe("success");
      expect(result.result.claims_checked).toBe(1);
    });

    it("handles memory retrieval failure gracefully", async () => {
      mockRetrieve.mockRejectedValue(new Error("Memory unavailable"));

      const result = await agent.execute(makeContext());

      expect(result.status).toBe("failure");
      expect(result.result.error).toContain("No KPIs or hypotheses found");
    });
  });

  describe("LLM failure handling", () => {
    it("fails gracefully when LLM returns invalid JSON", async () => {
      mockComplete.mockResolvedValue({
        id: "resp-5", model: "test-model", content: "not json", finish_reason: "stop",
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

  describe("evaluateVetoDecision (static)", () => {
    it("passes when confidence >= 0.85 and no high-severity issues", () => {
      const decision = IntegrityAgent.evaluateVetoDecision({
        isValid: true, confidence: 0.9, issues: [],
      });
      expect(decision.veto).toBe(false);
      expect(decision.reRefine).toBe(false);
    });

    it("requests re-refine when confidence < 0.85", () => {
      const decision = IntegrityAgent.evaluateVetoDecision({
        isValid: true, confidence: 0.6, issues: [],
      });
      expect(decision.veto).toBe(false);
      expect(decision.reRefine).toBe(true);
    });

    it("vetoes on high-severity data_integrity issue", () => {
      const decision = IntegrityAgent.evaluateVetoDecision({
        isValid: false, confidence: 0.95,
        issues: [{ type: "data_integrity", severity: "high", description: "bad data" }],
      });
      expect(decision.veto).toBe(true);
    });

    it("does not veto on medium-severity issues even with low confidence", () => {
      const decision = IntegrityAgent.evaluateVetoDecision({
        isValid: true, confidence: 0.6,
        issues: [{ type: "data_integrity", severity: "medium", description: "minor issue" }],
      });
      expect(decision.veto).toBe(false);
      expect(decision.reRefine).toBe(true);
    });
  });
});
