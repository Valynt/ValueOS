/**
 * End-to-end value loop test
 *
 * Verifies the full value lifecycle in a single test run:
 *   1. Create an opportunity (domain object)
 *   2. OpportunityAgent generates hypotheses
 *   3. Attach evidence to a hypothesis
 *   4. IntegrityAgent validates claims
 *   5. ArtifactComposer produces a BusinessCase with multi-stakeholder views
 *   6. defenseReadinessScore is calculated from assumptions + evidence
 *
 * All LLM calls and external services are mocked. No database required.
 * This test exercises the integration between domain objects, agents, and
 * the artifact composition layer.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockComplete, mockRetrieve, mockStoreSemanticMemory } = vi.hoisted(() => ({
  mockComplete: vi.fn(),
  mockRetrieve: vi.fn(),
  mockStoreSemanticMemory: vi.fn().mockResolvedValue("mem_1"),
}));

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
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
    execute = vi.fn().mockImplementation((fn: () => Promise<unknown>) => fn());
  },
}));

vi.mock("../services/MCPGroundTruthService.js", () => ({
  mcpGroundTruthService: {
    getFinancialData: vi.fn().mockResolvedValue(null),
    verifyClaim: vi.fn().mockResolvedValue({ verified: false, confidence: 0 }),
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
    createSnapshot = vi.fn().mockResolvedValue({ id: "snap-1", snapshot_version: 1 });
    getLatestSnapshotForCase = vi.fn().mockResolvedValue(null);
    listSnapshotsForCase = vi.fn().mockResolvedValue([]);
  },
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { calculateDefenseReadiness } from "../domain/business-case/defenseReadiness.js";
import { IntegrityAgent } from "../lib/agent-fabric/agents/IntegrityAgent.js";
import { OpportunityAgent } from "../lib/agent-fabric/agents/OpportunityAgent.js";
import { CircuitBreaker } from "../lib/agent-fabric/CircuitBreaker.js";
import { LLMGateway } from "../lib/agent-fabric/LLMGateway.js";
import { MemorySystem } from "../lib/agent-fabric/MemorySystem.js";
import {
  composeAllStakeholderViews,
} from "../runtime/artifact-composer/index.js";
import type { AgentConfig, LifecycleContext } from "../types/agent.js";

import type {
  Assumption,
  BusinessCase,
  Evidence,
  Opportunity,
  ValueHypothesis,
} from "@valueos/shared/domain";
import { EvidenceSchema, OpportunitySchema } from "@valueos/shared/domain";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ORG_ID = "org-e2e-0001";
const WS_ID = "ws-e2e-0001";
const OPP_ID = "opp-e2e-0001";
const BC_ID = "bc-e2e-0001";
const OWNER_ID = "user-e2e-0001";
const NOW = new Date().toISOString();

function makeAgentConfig(id: string, name: string, stage: string): AgentConfig {
  return {
    id,
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

function makeContext(stage: string, overrides: Partial<LifecycleContext> = {}): LifecycleContext {
  return {
    workspace_id: WS_ID,
    organization_id: ORG_ID,
    user_id: OWNER_ID,
    lifecycle_stage: stage,
    workspace_data: {},
    user_inputs: {},
    ...overrides,
  };
}

// ─── LLM response fixtures ────────────────────────────────────────────────────

const OPPORTUNITY_LLM_RESPONSE = JSON.stringify({
  company_summary: "Acme Corp is a mid-market manufacturer with $120M revenue.",
  industry_context: "Manufacturing sector facing margin pressure from supply chain costs.",
  hypotheses: [
    {
      title: "Invoice Automation",
      description: "Automating invoice reconciliation will reduce DSO by 12 days.",
      category: "cost_reduction",
      estimated_impact: { low: 400_000, high: 900_000, unit: "usd", timeframe_months: 12 },
      confidence: 0.82,
      evidence: ["Current DSO is 45 days vs industry median of 33 days."],
      assumptions: ["ERP integration is feasible within 3 months."],
      kpi_targets: ["days_sales_outstanding", "invoice_cycle_time"],
    },
    {
      title: "Cloud Migration",
      description: "Migrating to cloud-native infrastructure will reduce ops overhead by 30%.",
      category: "operational_efficiency",
      estimated_impact: { low: 200_000, high: 500_000, unit: "usd", timeframe_months: 18 },
      confidence: 0.71,
      evidence: ["On-prem ops cost is 2.4x cloud equivalent for this workload size."],
      assumptions: ["Migration can be completed in 6 months with current team."],
      kpi_targets: ["infrastructure_cost_per_user", "ops_headcount"],
    },
  ],
  stakeholder_roles: [
    {
      role: "CFO",
      relevance: "Owns P&L and approves capital allocation.",
      likely_concerns: ["Payback period", "Implementation risk"],
    },
    {
      role: "CTO",
      relevance: "Owns infrastructure and integration decisions.",
      likely_concerns: ["Technical feasibility", "Migration risk"],
    },
  ],
  recommended_next_steps: [
    "Schedule discovery call with CFO and CTO.",
    "Request current ERP DSO report.",
    "Obtain cloud cost analysis from IT.",
  ],
});

const INTEGRITY_LLM_RESPONSE = JSON.stringify({
  claim_validations: [
    {
      claim_id: "hyp-mem_hyp_1",
      claim_text: "Invoice Automation — DSO reduction of 12 days",
      verdict: "supported",
      confidence: 0.85,
      evidence_assessment: "DSO baseline sourced from ERP. Industry benchmark corroborates gap.",
      issues: [],
    },
    {
      claim_id: "hyp-mem_hyp_2",
      claim_text: "Cloud Migration — 30% ops overhead reduction",
      verdict: "supported",
      confidence: 0.78,
      evidence_assessment: "Cost comparison is consistent with published benchmarks.",
      issues: [],
    },
  ],
  overall_assessment: "Both claims are well-supported. No integrity issues detected.",
  data_quality_score: 0.88,
  logical_consistency_score: 0.85,
  evidence_coverage_score: 0.82,
});

// Memory entries that IntegrityAgent retrieves (set by OpportunityAgent in real flow)
const MEMORY_HYPOTHESES = [
  {
    id: "mem_hyp_1",
    agent_id: "opportunity",
    workspace_id: WS_ID,
    content: "Hypothesis: Invoice Automation — Automating invoice reconciliation will reduce DSO by 12 days.",
    memory_type: "semantic",
    importance: 0.82,
    created_at: NOW,
    accessed_at: NOW,
    access_count: 1,
    metadata: {
      verified: true,
      category: "cost_reduction",
      estimated_impact: { low: 400_000, high: 900_000, unit: "usd", timeframe_months: 12 },
      confidence: 0.82,
      evidence: ["Current DSO is 45 days vs industry median of 33 days."],
      organization_id: ORG_ID,
    },
  },
  {
    id: "mem_hyp_2",
    agent_id: "opportunity",
    workspace_id: WS_ID,
    content: "Hypothesis: Cloud Migration — Migrating to cloud-native infrastructure will reduce ops overhead by 30%.",
    memory_type: "semantic",
    importance: 0.71,
    created_at: NOW,
    accessed_at: NOW,
    access_count: 1,
    metadata: {
      verified: true,
      category: "operational_efficiency",
      estimated_impact: { low: 200_000, high: 500_000, unit: "usd", timeframe_months: 18 },
      confidence: 0.71,
      evidence: ["On-prem ops cost is 2.4x cloud equivalent."],
      organization_id: ORG_ID,
    },
  },
];

// ─── Test ─────────────────────────────────────────────────────────────────────

describe("Value Loop E2E", () => {
  let opportunityAgent: OpportunityAgent;
  let integrityAgent: IntegrityAgent;
  let mockLLM: InstanceType<typeof LLMGateway>;
  let mockMemory: InstanceType<typeof MemorySystem>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockLLM = new LLMGateway("custom");
    mockMemory = new MemorySystem({} as never);
    const mockCB = new CircuitBreaker();

    opportunityAgent = new OpportunityAgent(
      makeAgentConfig("opp-agent", "opportunity", "opportunity"),
      ORG_ID,
      mockMemory,
      mockLLM,
      mockCB,
    );

    integrityAgent = new IntegrityAgent(
      makeAgentConfig("int-agent", "integrity", "integrity"),
      ORG_ID,
      mockMemory,
      mockLLM,
      mockCB,
    );
  });

  it("Step 1 — Opportunity schema rejects missing organization_id", () => {
    // Verifies the Zod schema enforces tenant isolation at the boundary.
    // An opportunity without organization_id must not parse successfully.
    // Uses RFC 4122 v4 UUIDs — Zod v4 enforces strict UUID variant/version bits.
    const schemaOppId  = "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
    const schemaOrgId  = "b2c3d4e5-f6a7-4b8c-9d0e-f1a2b3c4d5e6";
    const schemaAcctId = "c3d4e5f6-a7b8-4c9d-ae0f-a2b3c4d5e6f7";

    const valid = OpportunitySchema.safeParse({
      id: schemaOppId,
      organization_id: schemaOrgId,
      account_id: schemaAcctId,
      name: "Acme Corp — Cost Reduction Initiative",
      lifecycle_stage: "discovery",
      status: "active",
      created_at: NOW,
      updated_at: NOW,
    });
    expect(valid.success).toBe(true);

    const missing = OpportunitySchema.safeParse({
      id: schemaOppId,
      // organization_id intentionally omitted
      account_id: schemaAcctId,
      name: "Acme Corp — Cost Reduction Initiative",
      lifecycle_stage: "discovery",
      status: "active",
      created_at: NOW,
      updated_at: NOW,
    });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0].path).toContain("organization_id");
  });

  it("Step 2 — OpportunityAgent generates hypotheses", async () => {
    mockComplete.mockResolvedValue({
      id: "resp-opp-1",
      model: "test-model",
      content: OPPORTUNITY_LLM_RESPONSE,
      finish_reason: "stop",
      usage: { prompt_tokens: 600, completion_tokens: 400, total_tokens: 1000 },
    });

    const result = await opportunityAgent.execute(
      makeContext("opportunity", {
        user_inputs: { query: "Analyze Acme Corp for cost reduction opportunities" },
      }),
    );

    expect(result.status).toBe("success");
    expect(result.result.hypotheses).toHaveLength(2);
    expect(result.result.hypotheses[0].title).toBe("Invoice Automation");
    expect(result.result.hypotheses[1].title).toBe("Cloud Migration");
    expect(result.result.company_summary).toContain("Acme Corp");

    // Hypotheses stored in memory for downstream agents
    expect(mockStoreSemanticMemory).toHaveBeenCalled();
    const memoryCalls = mockStoreSemanticMemory.mock.calls;
    const hypothesisCalls = memoryCalls.filter(
      (c: unknown[]) => typeof c[2] === "string" && c[2] === "semantic",
    );
    expect(hypothesisCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("Step 3 — EvidenceSchema enforces platinum/gold tier requires source_url", () => {
    // Verifies the schema boundary: platinum-tier evidence without source_url
    // must be rejected, since ungrounded high-tier claims are a data integrity risk.
    const base = {
      id: "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5",
      organization_id: "b2c3d4e5-f6a7-4b8c-9d0e-f1a2b3c4d5e6",
      opportunity_id: "c3d4e5f6-a7b8-4c9d-ae0f-a2b3c4d5e6f7",
      title: "Q3 DSO from ERP export",
      content: "DSO was 45 days in Q3 2024. Industry median is 33 days.",
      provenance: "erp" as const,
      tier: "platinum" as const,
      grounding_score: 0.91,
      created_at: NOW,
      updated_at: NOW,
    };

    // Valid: platinum with source_url
    const valid = EvidenceSchema.safeParse({
      ...base,
      source_url: "https://erp.acme.example/reports/q3-dso",
    });
    expect(valid.success).toBe(true);

    // Invalid: platinum without source_url
    const missingUrl = EvidenceSchema.safeParse({ ...base, source_url: null });
    expect(missingUrl.success).toBe(false);
    expect(missingUrl.error?.issues[0].path).toContain("source_url");

    // Invalid: gold without source_url
    const goldMissingUrl = EvidenceSchema.safeParse({
      ...base,
      tier: "gold" as const,
      source_url: null,
    });
    expect(goldMissingUrl.success).toBe(false);

    // Valid: silver without source_url (no requirement)
    const silverNoUrl = EvidenceSchema.safeParse({
      ...base,
      tier: "silver" as const,
      source_url: null,
    });
    expect(silverNoUrl.success).toBe(true);
  });

  it("Step 4 — IntegrityAgent validates claims and produces a pass decision", async () => {
    // Memory returns the hypotheses stored by OpportunityAgent
    mockRetrieve.mockResolvedValue(MEMORY_HYPOTHESES);

    mockComplete.mockResolvedValue({
      id: "resp-int-1",
      model: "test-model",
      content: INTEGRITY_LLM_RESPONSE,
      finish_reason: "stop",
      usage: { prompt_tokens: 800, completion_tokens: 500, total_tokens: 1300 },
    });

    const result = await integrityAgent.execute(
      makeContext("integrity", {
        user_inputs: { value_case_id: "vc-e2e-0001" },
      }),
    );

    expect(result.status).toBe("success");
    expect(result.result.veto_decision.veto).toBe(false);
    expect(result.result.veto_decision.reRefine).toBe(false);
    expect(result.result.scores.overall).toBeGreaterThan(0.7);
    expect(result.result.claim_validations).toHaveLength(2);
    expect(result.result.claim_validations[0].verdict).toBe("supported");
  });

  it("Step 5 — ArtifactComposer produces a BusinessCase with distinct stakeholder views", () => {
    const businessCase: BusinessCase = {
      id: BC_ID,
      organization_id: ORG_ID,
      opportunity_id: OPP_ID,
      title: "Acme Corp — Cost Reduction Value Case",
      status: "in_review",
      hypothesis_ids: ["hyp-e2e-0001", "hyp-e2e-0002"],
      financial_summary: {
        total_value_low_usd: 600_000,
        total_value_high_usd: 1_400_000,
        payback_months: 16,
        roi_3yr: 2.4,
        irr: 0.38,
        currency: "USD",
      },
      version: 1,
      owner_id: OWNER_ID,
      created_at: NOW,
      updated_at: NOW,
    };

    const hypotheses: ValueHypothesis[] = [
      {
        id: "hyp-e2e-0001",
        organization_id: ORG_ID,
        opportunity_id: OPP_ID,
        description: "Automating invoice reconciliation will reduce DSO by 12 days.",
        category: "cost_reduction",
        estimated_value: { low: 400_000, high: 900_000, unit: "usd", timeframe_months: 12 },
        confidence: "high",
        status: "validated",
        evidence_ids: ["ev-e2e-0001"],
        created_at: NOW,
        updated_at: NOW,
      },
      {
        id: "hyp-e2e-0002",
        organization_id: ORG_ID,
        opportunity_id: OPP_ID,
        description: "Migrating to cloud-native infrastructure will reduce ops overhead by 30%.",
        category: "operational_efficiency",
        estimated_value: { low: 200_000, high: 500_000, unit: "usd", timeframe_months: 18 },
        confidence: "medium",
        status: "validated",
        evidence_ids: [],
        created_at: NOW,
        updated_at: NOW,
      },
    ];

    const assumptions: Assumption[] = [
      {
        id: "asmp-e2e-0001",
        organization_id: ORG_ID,
        opportunity_id: OPP_ID,
        name: "ERP integration timeline",
        value: 3,
        unit: "months",
        source: "user_override",
        human_reviewed: true,
        created_at: NOW,
        updated_at: NOW,
      },
      {
        id: "asmp-e2e-0002",
        organization_id: ORG_ID,
        opportunity_id: OPP_ID,
        name: "Cloud migration headcount",
        value: 4,
        unit: "FTE",
        source: "agent_inference",
        human_reviewed: false,
        created_at: NOW,
        updated_at: NOW,
      },
    ];

    const evidence: Evidence[] = [
      {
        id: "ev-e2e-0001",
        organization_id: ORG_ID,
        opportunity_id: OPP_ID,
        hypothesis_id: "hyp-e2e-0001",
        title: "Q3 DSO from ERP export",
        content: "DSO was 45 days in Q3 2024.",
        provenance: "erp",
        tier: "platinum",
        source_url: "https://erp.acme.example/reports/q3-dso",
        grounding_score: 0.91,
        created_at: NOW,
        updated_at: NOW,
      },
    ];

    const views = composeAllStakeholderViews({
      business_case: businessCase,
      hypotheses,
      assumptions,
      evidence,
    });

    // All three views are generated from the same business case
    expect(views.cfo.business_case_id).toBe(BC_ID);
    expect(views.cto.business_case_id).toBe(BC_ID);
    expect(views.lob.business_case_id).toBe(BC_ID);

    // CFO view emphasises financial metrics
    expect(views.cfo.title).toContain("Financial Impact");
    expect(views.cfo.key_metrics.roi_3yr).toBe(2.4);
    expect(views.cfo.key_metrics.irr).toBe(0.38);

    // CTO view emphasises technical content
    expect(views.cto.title).toContain("Technical Feasibility");
    expect(views.cto.key_metrics.roi_3yr).toBeUndefined();

    // LOB view emphasises operational outcomes
    expect(views.lob.title).toContain("Operational Impact");

    // CFO and CTO views have different content emphasis
    const cfoHeadings = views.cfo.sections.map((s) => s.heading);
    const ctoHeadings = views.cto.sections.map((s) => s.heading);
    expect(cfoHeadings).toContain("Financial Summary");
    expect(ctoHeadings).toContain("Evidence Quality");
    expect(cfoHeadings).not.toContain("Evidence Quality");

    // CFO view surfaces the cost_reduction hypothesis; CTO surfaces operational_efficiency
    const cfoHypIds = views.cfo.highlighted_hypotheses.map((h) => h.id);
    const ctoHypIds = views.cto.highlighted_hypotheses.map((h) => h.id);
    expect(cfoHypIds).toContain("hyp-e2e-0001");
    expect(ctoHypIds).toContain("hyp-e2e-0002");
  });

  it("Step 6 — defenseReadinessScore reflects assumption validation and evidence strength", () => {
    const assumptions: Assumption[] = [
      {
        id: "asmp-e2e-0001",
        organization_id: ORG_ID,
        opportunity_id: OPP_ID,
        name: "ERP integration timeline",
        value: 3,
        unit: "months",
        source: "user_override",
        human_reviewed: true,
        created_at: NOW,
        updated_at: NOW,
      },
      {
        id: "asmp-e2e-0002",
        organization_id: ORG_ID,
        opportunity_id: OPP_ID,
        name: "Cloud migration headcount",
        value: 4,
        unit: "FTE",
        source: "agent_inference",
        human_reviewed: false,
        created_at: NOW,
        updated_at: NOW,
      },
    ];

    const evidence: Evidence[] = [
      {
        id: "ev-e2e-0001",
        organization_id: ORG_ID,
        opportunity_id: OPP_ID,
        title: "Q3 DSO from ERP export",
        content: "DSO was 45 days in Q3 2024.",
        provenance: "erp",
        tier: "platinum",
        source_url: "https://erp.acme.example/reports/q3-dso",
        grounding_score: 0.91,
        created_at: NOW,
        updated_at: NOW,
      },
    ];

    const result = calculateDefenseReadiness({ assumptions, evidence });

    // 50% assumptions validated, 0.91 mean grounding
    // score = 0.6 * 0.5 + 0.4 * 0.91 = 0.3 + 0.364 = 0.664
    expect(result.score).toBeGreaterThan(0.6);
    expect(result.score).toBeLessThan(0.8); // not yet presentation-ready
    expect(result.assumption_validation_rate).toBe(0.5);
    expect(result.mean_evidence_grounding_score).toBeCloseTo(0.91);

    // After all assumptions are validated, score should reach ≥ 0.8
    const allValidated = assumptions.map((a) => ({ ...a, human_reviewed: true }));
    const readyResult = calculateDefenseReadiness({ assumptions: allValidated, evidence });
    // score = 0.6 * 1.0 + 0.4 * 0.91 = 0.964
    expect(readyResult.score).toBeGreaterThanOrEqual(0.8);
  });

  it("Full loop — organization_id propagates from agent context through memory into composed artifact", async () => {
    // Verifies that the organization_id on the agent context is the same value
    // the agent passes to storeSemanticMemory (tenant scope arg), and that this
    // same org is preserved in the composed stakeholder views.
    mockComplete.mockResolvedValue({
      id: "resp-loop-1",
      model: "test-model",
      content: OPPORTUNITY_LLM_RESPONSE,
      finish_reason: "stop",
      usage: { prompt_tokens: 600, completion_tokens: 400, total_tokens: 1000 },
    });

    const ctx = makeContext("opportunity", {
      user_inputs: { query: "Analyze Acme Corp for cost reduction opportunities" },
    });

    const agentResult = await opportunityAgent.execute(ctx);
    expect(agentResult.status).toBe("success");

    // OpportunityAgent calls storeSemanticMemory(workspaceId, agentId, type,
    // content, metadata, organization_id). The last argument is the tenant scope.
    // Verify the agent used the organization_id from the context, not a hardcoded value.
    const memoryCalls = mockStoreSemanticMemory.mock.calls;
    const hypothesisMemoryCalls = memoryCalls.filter(
      (c: unknown[]) => typeof c[2] === "string" && c[2] === "semantic",
    );
    expect(hypothesisMemoryCalls.length).toBeGreaterThanOrEqual(1);

    // The last argument (index 5) is the tenant organization_id passed to memory.
    const agentOrgId = hypothesisMemoryCalls[0][5] as string;
    expect(agentOrgId).toBe(ctx.organization_id);

    // Build a BusinessCase using the org extracted from the agent's memory calls,
    // not a hardcoded constant, to verify the value flows end-to-end.
    const businessCase: BusinessCase = {
      id: BC_ID,
      organization_id: agentOrgId,
      opportunity_id: OPP_ID,
      title: "Acme Corp Value Case",
      status: "in_review",
      hypothesis_ids: ["hyp-e2e-0001"],
      version: 1,
      owner_id: OWNER_ID,
      created_at: NOW,
      updated_at: NOW,
    };

    const views = composeAllStakeholderViews({
      business_case: businessCase,
      hypotheses: [],
      assumptions: [],
      evidence: [],
    });

    // All views must carry the org that came from the agent context.
    expect(views.cfo.organization_id).toBe(agentOrgId);
    expect(views.cto.organization_id).toBe(agentOrgId);
    expect(views.lob.organization_id).toBe(agentOrgId);
    expect(views.cfo.business_case_id).toBe(BC_ID);
  });
});
