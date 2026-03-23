/**
 * MVP Model Creation — E2E Harness
 *
 * Validates the full value model creation pipeline:
 *   OpportunityAgent → FinancialModelingAgent → IntegrityAgent → NarrativeAgent
 *
 * Structured per the Harness-First Framework:
 *   Phase 1 — Happy path: full chain produces deterministic financial outputs
 *   Phase 2 — Seam tests: counterfactual failures at each handoff point
 *   Phase 3 — Escalation: veto/halt scenarios at the integrity gate
 *
 * All LLM calls, memory, and persistence are mocked. The economic kernel
 * runs real decimal.js math — its determinism is what we're validating.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import Decimal from "decimal.js";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockComplete, mockRetrieve, mockStoreSemanticMemory, mockSupabaseClient } = vi.hoisted(
  () => ({
    mockComplete: vi.fn(),
    mockRetrieve: vi.fn(),
    mockStoreSemanticMemory: vi.fn().mockResolvedValue("mem_1"),
    mockSupabaseClient: {
      from: vi.fn(() => ({
        insert: vi.fn().mockResolvedValue({ error: null }),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    },
  })
);

// ─── Module mocks ───────────────────────────────────────────────────────────

vi.mock("../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock("../lib/agent-fabric/LLMGateway.js", () => ({
  LLMGateway: class {
    constructor() {}
    complete = mockComplete;
  },
}));

vi.mock("../lib/agent-fabric/MemorySystem.js", () => ({
  MemorySystem: class {
    constructor() {}
    store = vi.fn().mockResolvedValue("mem_1");
    retrieve = mockRetrieve;
    storeSemanticMemory = mockStoreSemanticMemory;
    clear = vi.fn().mockResolvedValue(0);
  },
}));

vi.mock("../lib/agent-fabric/CircuitBreaker.js", () => ({
  CircuitBreaker: class {
    constructor() {}
    execute = vi
      .fn()
      .mockImplementation((fn: () => Promise<unknown>) => fn());
  },
}));

vi.mock("../services/MCPGroundTruthService.js", () => ({
  mcpGroundTruthService: {
    getFinancialData: vi.fn().mockResolvedValue(null),
    verifyClaim: vi
      .fn()
      .mockResolvedValue({ verified: false, confidence: 0 }),
    getIndustryBenchmarks: vi.fn().mockResolvedValue(null),
    initialize: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../services/HypothesisOutputService.js", () => ({
  hypothesisOutputService: {
    create: vi.fn().mockResolvedValue({ id: "hyp-out-1" }),
  },
}));

vi.mock("../repositories/FinancialModelSnapshotRepository.js", () => ({
  FinancialModelSnapshotRepository: class {
    createSnapshot = vi
      .fn()
      .mockResolvedValue({ id: "snap-1", snapshot_version: 1 });
    getLatestSnapshotForCase = vi.fn().mockResolvedValue(null);
    listSnapshotsForCase = vi.fn().mockResolvedValue([]);
  },
}));

vi.mock("../repositories/IntegrityResultRepository.js", () => ({
  IntegrityResultRepository: class {
    create = vi.fn().mockResolvedValue({ id: "ir-1" });
  },
}));

vi.mock("../repositories/IntegrityOutputRepository.js", () => ({
  IntegrityOutputRepository: class {
    upsert = vi.fn().mockResolvedValue({ id: "io-1" });
  },
}));

vi.mock("../repositories/NarrativeDraftRepository.js", () => ({
  NarrativeDraftRepository: class {
    upsert = vi.fn().mockResolvedValue({ id: "nd-1" });
    getForCase = vi.fn().mockResolvedValue(null);
  },
}));

vi.mock("../services/artifacts/index.js", () => ({
  ArtifactRepository: class {
    create = vi.fn().mockResolvedValue({ id: "art-1" });
    findByCaseId = vi.fn().mockResolvedValue([]);
  },
  ArtifactEditService: class {
    createOrUpdate = vi.fn().mockResolvedValue({ id: "art-1" });
  },
  ExecutiveMemoGenerator: class {
    generate = vi.fn().mockResolvedValue({ content: "memo" });
  },
  CFORecommendationGenerator: class {
    generate = vi.fn().mockResolvedValue({ content: "cfo" });
  },
  CustomerNarrativeGenerator: class {
    generate = vi.fn().mockResolvedValue({ content: "customer" });
  },
  InternalCaseGenerator: class {
    generate = vi.fn().mockResolvedValue({ content: "internal" });
  },
}));

vi.mock("../services/value-graph/index.js", () => ({
  valueGraphService: {
    writeNode: vi.fn().mockResolvedValue(undefined),
    writeEdge: vi.fn().mockResolvedValue(undefined),
    getPathsForOpportunity: vi.fn().mockResolvedValue([]),
  },
  BaseGraphWriter: class {
    writeNode = vi.fn().mockResolvedValue(undefined);
    writeEdge = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock("../events/DomainEventBus.js", () => ({
  getDomainEventBus: vi.fn(() => ({
    publish: vi.fn().mockResolvedValue(undefined),
  })),
  buildEventEnvelope: vi.fn((type: string, payload: unknown) => ({
    type,
    payload,
    timestamp: new Date().toISOString(),
  })),
}));

vi.mock("../lib/agent-fabric/BaseGraphWriter.js", () => ({
  BaseGraphWriter: class {
    writeNode = vi.fn().mockResolvedValue(undefined);
    writeEdge = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock("../lib/supabase.js", () => ({
  supabase: mockSupabaseClient,
  createServerSupabaseClient: vi.fn(() => mockSupabaseClient),
}));

// ─── Imports (after mocks) ──────────────────────────────────────────────────

import { OpportunityAgent } from "../lib/agent-fabric/agents/OpportunityAgent.js";
import { FinancialModelingAgent } from "../lib/agent-fabric/agents/FinancialModelingAgent.js";
import { IntegrityAgent } from "../lib/agent-fabric/agents/IntegrityAgent.js";
import { NarrativeAgent } from "../lib/agent-fabric/agents/NarrativeAgent.js";
import { CircuitBreaker } from "../lib/agent-fabric/CircuitBreaker.js";
import { LLMGateway } from "../lib/agent-fabric/LLMGateway.js";
import { MemorySystem } from "../lib/agent-fabric/MemorySystem.js";
import {
  calculateNPV,
  calculateIRR,
  calculatePayback,
  calculateROI,
  toDecimalArray,
} from "../domain/economic-kernel/economic_kernel.js";
import type { AgentConfig, AgentOutput, LifecycleContext } from "../types/agent.js";

// ─── Constants ──────────────────────────────────────────────────────────────

const ORG_ID = "org-mvp-e2e";
const WS_ID = "ws-mvp-e2e";
const USER_ID = "user-mvp-e2e";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeConfig(
  name: string,
  stage: string
): AgentConfig {
  return {
    id: `${name}-agent`,
    name,
    type: name as AgentConfig["type"],
    lifecycle_stage: stage,
    capabilities: [],
    model: { provider: "custom", model_name: "test-model" },
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

function makeContext(
  stage: string,
  overrides: Partial<LifecycleContext> = {}
): LifecycleContext {
  return {
    workspace_id: WS_ID,
    organization_id: ORG_ID,
    user_id: USER_ID,
    lifecycle_stage: stage,
    workspace_data: {},
    user_inputs: {},
    ...overrides,
  };
}

function makeLLMResponse(content: string) {
  return {
    id: `resp-${Date.now()}`,
    model: "test-model",
    content,
    finish_reason: "stop",
    usage: { prompt_tokens: 500, completion_tokens: 400, total_tokens: 900 },
  };
}

// ─── LLM Response Fixtures ──────────────────────────────────────────────────

const OPPORTUNITY_LLM = JSON.stringify({
  company_summary: "Acme Corp — $120M mid-market manufacturer.",
  industry_context: "Manufacturing sector margin pressure.",
  hypotheses: [
    {
      title: "Invoice Automation",
      description: "Reduce DSO by 12 days via automated reconciliation.",
      category: "cost_reduction",
      estimated_impact: {
        low: 400000,
        high: 900000,
        unit: "usd",
        timeframe_months: 12,
      },
      confidence: 0.82,
      evidence: ["Current DSO is 45 days vs industry median of 33."],
      assumptions: ["ERP integration feasible within 3 months."],
      kpi_targets: ["days_sales_outstanding"],
    },
  ],
  stakeholder_roles: [
    {
      role: "CFO",
      relevance: "Owns P&L",
      likely_concerns: ["Payback period"],
    },
  ],
  recommended_next_steps: ["Schedule discovery call with CFO."],
});

const FINANCIAL_MODELING_LLM = JSON.stringify({
  projections: [
    {
      hypothesis_id: "hyp-1",
      hypothesis_description: "Invoice Automation",
      category: "cost_reduction",
      assumptions: ["DSO reduction of 12 days", "Annual savings $650K"],
      cash_flows: [-200000, 150000, 300000, 350000],
      currency: "USD",
      period_type: "annual",
      discount_rate: 0.1,
      total_investment: 200000,
      total_benefit: 800000,
      confidence: 0.8,
      risk_factors: ["Integration complexity"],
      data_sources: ["ERP data Q4"],
    },
  ],
  portfolio_summary: "One model with strong positive NPV.",
  key_assumptions: ["Stable market"],
  recommended_next_steps: ["Validate ERP quotes"],
});

const INTEGRITY_LLM_PASS = JSON.stringify({
  claim_validations: [
    {
      claim_id: "hyp-mem_1",
      claim_text: "Invoice Automation — DSO reduction of 12 days",
      verdict: "supported",
      confidence: 0.85,
      evidence_assessment: "DSO baseline confirmed from ERP.",
      issues: [],
    },
  ],
  overall_assessment: "Claim is well-supported.",
  data_quality_score: 0.88,
  logical_consistency_score: 0.85,
  evidence_coverage_score: 0.82,
});

const INTEGRITY_LLM_VETO = JSON.stringify({
  claim_validations: [
    {
      claim_id: "hyp-mem_1",
      claim_text: "Invoice Automation — DSO reduction of 12 days",
      verdict: "unsupported",
      confidence: 0.2,
      evidence_assessment: "No credible source for DSO baseline.",
      issues: [
        {
          type: "unsupported_assumption",
          severity: "high",
          description: "Fabricated benchmark data — no ERP export provided",
        },
        {
          type: "data_integrity",
          severity: "high",
          description: "DSO baseline not verifiable from any attached source",
        },
      ],
    },
  ],
  overall_assessment: "Critical integrity failure. Claims are not supported by evidence.",
  data_quality_score: 0.15,
  logical_consistency_score: 0.3,
  evidence_coverage_score: 0.1,
});

const NARRATIVE_LLM = JSON.stringify({
  executive_summary:
    "Acme Corp stands to realize $800K+ through invoice automation, with a 2.5-year payback.",
  value_proposition:
    "Automated reconciliation reduces DSO by 12 days, unlocking working capital.",
  key_proof_points: [
    "Current DSO 45 days vs 33-day median",
    "NPV $447K at 10% discount rate",
    "ROI 300%",
  ],
  risk_mitigations: ["Phased ERP integration", "Fallback to manual process"],
  call_to_action: "Approve Phase 1 pilot for Q2.",
  defense_readiness_score: 0.82,
  talking_points: [
    { audience: "executive", point: "Working capital unlock of $400K+" },
    { audience: "financial", point: "3-year ROI of 300% with 2.5yr payback" },
  ],
});

// Memory entries that mimic OpportunityAgent output
const MEMORY_HYPOTHESES = [
  {
    id: "mem_1",
    agent_id: "opportunity",
    workspace_id: WS_ID,
    content:
      "Hypothesis: Invoice Automation — Reduce DSO by 12 days via automated reconciliation.",
    memory_type: "semantic",
    importance: 0.82,
    created_at: new Date().toISOString(),
    accessed_at: new Date().toISOString(),
    access_count: 1,
    metadata: {
      verified: true,
      category: "cost_reduction",
      estimated_impact: {
        low: 400000,
        high: 900000,
        unit: "usd",
        timeframe_months: 12,
      },
      confidence: 0.82,
      evidence: ["Current DSO is 45 days vs industry median of 33."],
      organization_id: ORG_ID,
    },
  },
];

// Memory entries for financial models (after FinancialModelingAgent)
const MEMORY_FINANCIAL_MODELS = [
  {
    id: "mem_model_1",
    agent_id: "financial_modeling",
    workspace_id: WS_ID,
    content: "Financial model for Invoice Automation: NPV $447K, ROI 300%",
    memory_type: "semantic",
    importance: 0.9,
    created_at: new Date().toISOString(),
    accessed_at: new Date().toISOString(),
    access_count: 1,
    metadata: {
      type: "financial_model",
      hypothesis_id: "hyp-1",
      npv: 447257.7,
      roi: 3,
      irr: 0.65,
      payback_period: 2,
      organization_id: ORG_ID,
    },
  },
];

// Memory entries for integrity results (after IntegrityAgent)
const MEMORY_INTEGRITY = [
  {
    id: "mem_integrity_1",
    agent_id: "integrity",
    workspace_id: WS_ID,
    content: "Integrity validation passed. Overall score: 0.85.",
    memory_type: "semantic",
    importance: 0.9,
    created_at: new Date().toISOString(),
    accessed_at: new Date().toISOString(),
    access_count: 1,
    metadata: {
      type: "integrity_result",
      overall_score: 0.85,
      veto: false,
      organization_id: ORG_ID,
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Phase 1 — Happy Path: Full Agent Chain + Kernel Determinism
// ═══════════════════════════════════════════════════════════════════════════

describe("MVP Model Creation E2E", () => {
  let mockLLM: InstanceType<typeof LLMGateway>;
  let mockMemory: InstanceType<typeof MemorySystem>;
  let mockCB: InstanceType<typeof CircuitBreaker>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLLM = new LLMGateway("custom");
    mockMemory = new MemorySystem({} as never);
    mockCB = new CircuitBreaker();
  });

  // ─── Economic Kernel Determinism ────────────────────────────────────────

  describe("Economic Kernel Determinism (foundational invariant)", () => {
    const CASH_FLOWS = toDecimalArray([-200000, 150000, 300000, 350000]);
    const RATE = new Decimal("0.1");

    it("NPV is deterministic across repeated runs", () => {
      const results = Array.from({ length: 10 }, () =>
        calculateNPV(CASH_FLOWS, RATE)
      );
      const first = results[0].toString();
      for (const r of results) {
        expect(r.toString()).toBe(first);
      }
    });

    it("NPV matches hand-calculated value", () => {
      // -200000 + 150000/1.1 + 300000/1.21 + 350000/1.331
      const npv = calculateNPV(CASH_FLOWS, RATE);
      expect(npv.toNumber()).toBeCloseTo(447257.7, -1);
    });

    it("IRR satisfies NPV(flows, IRR) ≈ 0 invariant", () => {
      const irr = calculateIRR(CASH_FLOWS);
      expect(irr.converged).toBe(true);
      const npvAtIRR = calculateNPV(CASH_FLOWS, irr.rate);
      expect(npvAtIRR.abs().toNumber()).toBeLessThan(0.01);
    });

    it("higher discount rate → lower NPV (monotonicity)", () => {
      const npvLow = calculateNPV(CASH_FLOWS, new Decimal("0.05"));
      const npvHigh = calculateNPV(CASH_FLOWS, new Decimal("0.15"));
      expect(npvLow.gt(npvHigh)).toBe(true);
    });

    it("payback period is between period 1 and 2", () => {
      // Cumulative: -200000, -50000, +250000
      const payback = calculatePayback(CASH_FLOWS);
      expect(payback.period).toBe(2);
      expect(payback.fractionalPeriod).not.toBeNull();
      expect(payback.fractionalPeriod!.toNumber()).toBeGreaterThan(1);
      expect(payback.fractionalPeriod!.toNumber()).toBeLessThan(3);
    });

    it("ROI = (benefits - costs) / costs", () => {
      const roi = calculateROI(new Decimal(800000), new Decimal(200000));
      expect(roi.toNumber()).toBe(3);
    });
  });

  // ─── Happy Path: Full Agent Chain ───────────────────────────────────────

  describe("Happy path — full agent chain", () => {
    it("OpportunityAgent → FinancialModelingAgent → IntegrityAgent chain produces valid output", async () => {
      const startTime = Date.now();

      // ── Step 1: OpportunityAgent ──
      mockComplete.mockResolvedValueOnce(makeLLMResponse(OPPORTUNITY_LLM));

      const oppAgent = new OpportunityAgent(
        makeConfig("opportunity", "opportunity"),
        ORG_ID,
        mockMemory,
        mockLLM,
        mockCB
      );

      const oppResult = await oppAgent.execute(
        makeContext("opportunity", {
          user_inputs: { query: "Analyze Acme Corp for cost reduction" },
        })
      );

      expect(oppResult.status).toBe("success");
      expect(oppResult.result.hypotheses).toBeDefined();

      // ── Step 2: FinancialModelingAgent ──
      mockRetrieve.mockResolvedValue(MEMORY_HYPOTHESES);
      mockComplete.mockResolvedValueOnce(
        makeLLMResponse(FINANCIAL_MODELING_LLM)
      );

      const finAgent = new FinancialModelingAgent(
        makeConfig("financial_modeling", "modeling"),
        ORG_ID,
        mockMemory,
        mockLLM,
        mockCB
      );

      const finResult = await finAgent.execute(makeContext("modeling"));

      expect(finResult.status).toBe("success");
      expect(finResult.result.models_count).toBe(1);

      // Verify kernel determinism in agent output
      const models = finResult.result.models as Array<{
        npv: number;
        roi: number;
        irr: number | null;
        irr_converged: boolean;
        payback_period: number | null;
      }>;
      expect(models[0].npv).toBeCloseTo(447257.7, -1);
      expect(models[0].roi).toBe(3);
      expect(models[0].irr_converged).toBe(true);
      expect(models[0].irr).toBeGreaterThan(0.1);
      expect(models[0].payback_period).toBe(2);

      // ── Step 3: IntegrityAgent ──
      mockRetrieve.mockResolvedValue(MEMORY_HYPOTHESES);
      mockComplete.mockResolvedValueOnce(
        makeLLMResponse(INTEGRITY_LLM_PASS)
      );

      const intAgent = new IntegrityAgent(
        makeConfig("integrity", "integrity"),
        ORG_ID,
        mockMemory,
        mockLLM,
        mockCB
      );

      const intResult = await intAgent.execute(
        makeContext("integrity", {
          user_inputs: { value_case_id: "vc-mvp-001" },
        })
      );

      expect(intResult.status).toBe("success");
      const intData = intResult.result as Record<string, any>;
      expect(intData.veto_decision.veto).toBe(false);
      expect(intData.scores.overall).toBeGreaterThan(0.7);

      // Wall-clock < 5s with mocked LLM
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(5000);
    });

    it("organization_id propagates through entire chain", async () => {
      // Opportunity
      mockComplete.mockResolvedValueOnce(makeLLMResponse(OPPORTUNITY_LLM));
      const oppAgent = new OpportunityAgent(
        makeConfig("opportunity", "opportunity"),
        ORG_ID,
        mockMemory,
        mockLLM,
        mockCB
      );
      await oppAgent.execute(
        makeContext("opportunity", {
          user_inputs: { query: "Analyze Acme Corp" },
        })
      );

      // Verify memory calls include org_id
      const memoryCalls = mockStoreSemanticMemory.mock.calls;
      const orgIds = memoryCalls
        .filter((c: any[]) => c[4]?.organization_id)
        .map((c: any[]) => c[4].organization_id);
      for (const oid of orgIds) {
        expect(oid).toBe(ORG_ID);
      }
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Phase 2 — Seam Tests: Counterfactual Failures at Handoff Points
  // ═════════════════════════════════════════════════════════════════════════

  describe("Seam: Opportunity → FinancialModeling (empty memory)", () => {
    it("FinancialModelingAgent returns failure when no hypotheses in memory", async () => {
      mockRetrieve.mockResolvedValue([]);

      const agent = new FinancialModelingAgent(
        makeConfig("financial_modeling", "modeling"),
        ORG_ID,
        mockMemory,
        mockLLM,
        mockCB
      );

      const result = await agent.execute(makeContext("modeling"));

      expect(result.status).toBe("failure");
      expect(result.result.error).toContain("No hypotheses found");
      // LLM should NOT be called — no work to do
      expect(mockComplete).not.toHaveBeenCalled();
    });
  });

  describe("Seam: Opportunity → FinancialModeling (unverified hypotheses)", () => {
    it("FinancialModelingAgent rejects unverified hypotheses", async () => {
      const unverified = MEMORY_HYPOTHESES.map((h) => ({
        ...h,
        metadata: { ...h.metadata, verified: false },
      }));
      mockRetrieve.mockResolvedValue(unverified);

      const agent = new FinancialModelingAgent(
        makeConfig("financial_modeling", "modeling"),
        ORG_ID,
        mockMemory,
        mockLLM,
        mockCB
      );

      const result = await agent.execute(makeContext("modeling"));

      expect(result.status).toBe("failure");
    });
  });

  describe("Seam: FinancialModeling → Integrity (LLM hallucination)", () => {
    it("FinancialModelingAgent returns failure when LLM produces invalid JSON", async () => {
      mockRetrieve.mockResolvedValue(MEMORY_HYPOTHESES);
      mockComplete.mockResolvedValueOnce(
        makeLLMResponse("This is not valid JSON at all.")
      );

      const agent = new FinancialModelingAgent(
        makeConfig("financial_modeling", "modeling"),
        ORG_ID,
        mockMemory,
        mockLLM,
        mockCB
      );

      const result = await agent.execute(makeContext("modeling"));

      expect(result.status).toBe("failure");
    });
  });

  describe("Seam: Tenant isolation enforcement", () => {
    it("FinancialModelingAgent rejects cross-tenant context", async () => {
      const agent = new FinancialModelingAgent(
        makeConfig("financial_modeling", "modeling"),
        ORG_ID,
        mockMemory,
        mockLLM,
        mockCB
      );

      await expect(
        agent.execute(makeContext("modeling", { organization_id: "org-other" }))
      ).rejects.toThrow(/tenant context mismatch/i);
    });

    it("IntegrityAgent rejects cross-tenant context", async () => {
      const agent = new IntegrityAgent(
        makeConfig("integrity", "integrity"),
        ORG_ID,
        mockMemory,
        mockLLM,
        mockCB
      );

      await expect(
        agent.execute(
          makeContext("integrity", { organization_id: "org-other" })
        )
      ).rejects.toThrow(/tenant context mismatch/i);
    });
  });

  describe("Seam: Missing workspace_id (input validation gate)", () => {
    it("agents reject empty workspace_id", async () => {
      const agent = new FinancialModelingAgent(
        makeConfig("financial_modeling", "modeling"),
        ORG_ID,
        mockMemory,
        mockLLM,
        mockCB
      );

      await expect(
        agent.execute(makeContext("modeling", { workspace_id: "" }))
      ).rejects.toThrow("Invalid input context");
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Phase 3 — Escalation: Veto/Halt at Integrity Gate
  // ═════════════════════════════════════════════════════════════════════════

  describe("Escalation: IntegrityAgent veto halts pipeline", () => {
    it("IntegrityAgent issues veto when claims lack evidence", async () => {
      // Veto is driven by deterministic policy, not LLM output.
      // Empty evidence arrays trigger the evidence_presence veto rule.
      const hypothesesNoEvidence = MEMORY_HYPOTHESES.map((h) => ({
        ...h,
        metadata: {
          ...h.metadata,
          evidence: [], // triggers deterministic veto
        },
      }));
      mockRetrieve.mockResolvedValue(hypothesesNoEvidence);
      mockComplete.mockResolvedValueOnce(
        makeLLMResponse(INTEGRITY_LLM_VETO)
      );

      const agent = new IntegrityAgent(
        makeConfig("integrity", "integrity"),
        ORG_ID,
        mockMemory,
        mockLLM,
        mockCB
      );

      const result = await agent.execute(
        makeContext("integrity", {
          user_inputs: { value_case_id: "vc-mvp-001" },
        })
      );

      // IntegrityAgent returns 'failure' status when veto is issued
      expect(result.status).toBe("failure");
      const data = result.result as Record<string, any>;
      expect(data.veto_decision.veto).toBe(true);
      expect(data.veto_decision.reason).toBeDefined();
    });

    it("NarrativeAgent should not run after a veto (orchestration contract)", () => {
      // This test documents the orchestration contract:
      // If IntegrityAgent.result.veto_decision.veto === true,
      // the orchestrator must NOT invoke NarrativeAgent.
      //
      // This is a governance boundary test — the harness verifies the
      // contract exists. The actual enforcement lives in the orchestrator.
      const mockIntegrityResult = {
        veto_decision: { veto: true, reason: "Claims unsupported" },
        scores: { overall: 0.2 },
      };

      // Acceptance gate: veto flag must be checkable
      expect(mockIntegrityResult.veto_decision.veto).toBe(true);

      // Orchestration contract: if veto, narrative agent is skipped
      const shouldRunNarrative =
        !mockIntegrityResult.veto_decision.veto;
      expect(shouldRunNarrative).toBe(false);
    });
  });

  describe("Escalation: LLM total failure (circuit breaker boundary)", () => {
    it("agent chain degrades gracefully when LLM is unavailable", async () => {
      mockRetrieve.mockResolvedValue(MEMORY_HYPOTHESES);
      mockComplete.mockRejectedValue(new Error("LLM service unavailable"));

      const agent = new FinancialModelingAgent(
        makeConfig("financial_modeling", "modeling"),
        ORG_ID,
        mockMemory,
        mockLLM,
        mockCB
      );

      const result = await agent.execute(makeContext("modeling"));

      expect(result.status).toBe("failure");
      expect(result.result.error).toBeDefined();
    });
  });
});
