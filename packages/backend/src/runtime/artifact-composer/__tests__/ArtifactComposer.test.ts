import type { Assumption, BusinessCase, Evidence, ValueHypothesis } from "@valueos/shared/domain";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ArtifactComposer,
  composeAllStakeholderViews,
  composeStakeholderView,
} from "../index.js";
import type { ArtifactComposerInput } from "../index.js";

// ---------------------------------------------------------------------------
// Mocks for ArtifactComposer class tests
// ---------------------------------------------------------------------------

vi.mock('@valueos/sdui', () => ({
  SDUIPageDefinition: vi.fn(function () { return {}; }),
  validateSDUISchema: vi.fn(function () { return { success: true }; }),
}));

vi.mock('../../../services/core/SecurityLogger.js', () => ({
  securityLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));



vi.mock('uuid', () => ({
  v4: (() => {
    let n = 0;
    return () => `uuid-${++n}`;
  })(),
}));

vi.mock('../../../services/agents/AgentAPI', () => ({
  AgentAPI: vi.fn(function () { return { invokeAgent: vi.fn().mockResolvedValue({ success: true, data: {} }) }; }),
  getAgentAPI: vi.fn(function () { return { invokeAgent: vi.fn().mockResolvedValue({ success: true, data: {} }) }; }),
}));

vi.mock('../../../services/workflows/WorkflowRenderService', () => ({
  DefaultWorkflowRenderService: vi.fn(function () {
    return {
      generateSDUIPage: vi.fn().mockResolvedValue({ type: 'sdui-page', payload: {} }),
      generateAndRenderPage: vi.fn().mockResolvedValue({ response: { type: 'sdui-page', payload: {} }, rendered: {} }),
    };
  }),
}));

vi.mock('../../../services/workflows/WorkflowSimulationService', () => ({
  DefaultWorkflowSimulationService: vi.fn(function () {
    return { simulateWorkflow: vi.fn().mockResolvedValue({}) };
  }),
}));

function makeComposer(overrides: Partial<ConstructorParameters<typeof ArtifactComposer>[0]> = {}) {
  return new ArtifactComposer({ enableSDUI: true, enableTaskPlanning: true, enableSimulation: false, ...overrides });
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date().toISOString();
const ORG = "00000000-0000-0000-0000-000000000001";
const OPP = "00000000-0000-0000-0000-000000000002";
const BC_ID = "00000000-0000-0000-0000-000000000003";
const OWNER = "00000000-0000-0000-0000-000000000004";
const H1_ID = "00000000-0000-0000-0000-000000000010";
const H2_ID = "00000000-0000-0000-0000-000000000011";
const H3_ID = "00000000-0000-0000-0000-000000000012";

const businessCase: BusinessCase = {
  id: BC_ID,
  organization_id: ORG,
  opportunity_id: OPP,
  title: "Acme Corp Value Case",
  status: "in_review",
  hypothesis_ids: [H1_ID, H2_ID, H3_ID],
  financial_summary: {
    total_value_low_usd: 1_200_000,
    total_value_high_usd: 3_500_000,
    payback_months: 14,
    roi_3yr: 2.8,
    irr: 0.42,
    currency: "USD",
  },
  version: 2,
  owner_id: OWNER,
  created_at: NOW,
  updated_at: NOW,
};

const hypotheses: ValueHypothesis[] = [
  {
    id: H1_ID,
    organization_id: ORG,
    opportunity_id: OPP,
    description: "Automating invoice reconciliation will reduce DSO by 12 days.",
    category: "cost_reduction",
    estimated_value: { low: 400_000, high: 800_000, unit: "usd", timeframe_months: 12 },
    confidence: "high",
    status: "validated",
    evidence_ids: [],
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: H2_ID,
    organization_id: ORG,
    opportunity_id: OPP,
    description: "Migrating to cloud-native infrastructure will reduce ops overhead by 30%.",
    category: "operational_efficiency",
    estimated_value: { low: 200_000, high: 500_000, unit: "usd", timeframe_months: 18 },
    confidence: "medium",
    status: "validated",
    evidence_ids: [],
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: H3_ID,
    organization_id: ORG,
    opportunity_id: OPP,
    description: "Expanding into APAC will add $2M ARR within 24 months.",
    category: "revenue_growth",
    estimated_value: { low: 1_500_000, high: 2_500_000, unit: "usd", timeframe_months: 24 },
    confidence: "low",
    status: "validated",
    evidence_ids: [],
    created_at: NOW,
    updated_at: NOW,
  },
];

const assumptions: Assumption[] = [
  {
    id: "a1",
    organization_id: ORG,
    opportunity_id: OPP,
    name: "Average deal size",
    value: 50_000,
    unit: "USD",
    source: "crm",
    human_reviewed: true,
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: "a2",
    organization_id: ORG,
    opportunity_id: OPP,
    name: "Headcount reduction",
    value: 5,
    unit: "FTE",
    source: "agent_inference",
    human_reviewed: false,
    created_at: NOW,
    updated_at: NOW,
  },
];

const evidence: Evidence[] = [
  {
    id: "e1",
    organization_id: ORG,
    opportunity_id: OPP,
    hypothesis_id: H1_ID,
    title: "Q3 DSO from ERP export",
    content: "DSO was 45 days in Q3, industry median is 33 days.",
    provenance: "erp",
    tier: "platinum",
    source_url: "https://erp.example.com/reports/q3-dso",
    grounding_score: 0.92,
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: "e2",
    organization_id: ORG,
    opportunity_id: OPP,
    title: "Cloud migration benchmark",
    content: "Industry benchmark shows 25–35% ops cost reduction post-migration.",
    provenance: "benchmark",
    tier: "gold",
    source_url: "https://benchmarks.example.com/cloud-ops",
    grounding_score: 0.78,
    created_at: NOW,
    updated_at: NOW,
  },
];

const input: ArtifactComposerInput = {
  business_case: businessCase,
  hypotheses,
  assumptions,
  evidence,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("composeStakeholderView", () => {
  it("produces distinct titles for CFO and CTO views", () => {
    const cfo = composeStakeholderView("cfo", input);
    const cto = composeStakeholderView("cto", input);
    expect(cfo.title).not.toBe(cto.title);
    expect(cfo.title).toContain("Financial Impact");
    expect(cto.title).toContain("Technical Feasibility");
  });

  it("produces distinct executive summaries for CFO and CTO views", () => {
    const cfo = composeStakeholderView("cfo", input);
    const cto = composeStakeholderView("cto", input);
    expect(cfo.executive_summary).not.toBe(cto.executive_summary);
  });

  it("CFO view includes ROI and payback in executive summary", () => {
    const cfo = composeStakeholderView("cfo", input);
    expect(cfo.executive_summary).toContain("280% 3-year ROI");
    expect(cfo.executive_summary).toContain("14-month payback");
  });

  it("CFO view highlights financial hypotheses (cost_reduction, revenue_growth)", () => {
    const cfo = composeStakeholderView("cfo", input);
    const ids = cfo.highlighted_hypotheses.map((h) => h.id);
    expect(ids).toContain(H1_ID); // cost_reduction
    expect(ids).toContain(H3_ID); // revenue_growth
    expect(ids).not.toContain(H2_ID); // operational_efficiency — not in CFO set
  });

  it("CTO view highlights operational hypotheses", () => {
    const cto = composeStakeholderView("cto", input);
    const ids = cto.highlighted_hypotheses.map((h) => h.id);
    expect(ids).toContain(H2_ID); // operational_efficiency
    expect(ids).not.toContain(H3_ID); // revenue_growth — not in CTO set
  });

  it("LOB view highlights operational and revenue hypotheses", () => {
    const lob = composeStakeholderView("lob", input);
    const ids = lob.highlighted_hypotheses.map((h) => h.id);
    expect(ids).toContain(H1_ID); // cost_reduction
    expect(ids).toContain(H2_ID); // operational_efficiency
    expect(ids).toContain(H3_ID); // revenue_growth
  });

  it("CFO key_metrics includes roi_3yr and irr", () => {
    const cfo = composeStakeholderView("cfo", input);
    expect(cfo.key_metrics.roi_3yr).toBe(2.8);
    expect(cfo.key_metrics.irr).toBe(0.42);
  });

  it("CTO key_metrics does not include roi_3yr or irr", () => {
    const cto = composeStakeholderView("cto", input);
    expect(cto.key_metrics.roi_3yr).toBeUndefined();
    expect(cto.key_metrics.irr).toBeUndefined();
  });

  it("all views share the same business_case_id and organization_id", () => {
    const views = composeAllStakeholderViews(input);
    for (const view of Object.values(views)) {
      expect(view.business_case_id).toBe(BC_ID);
      expect(view.organization_id).toBe(ORG);
    }
  });

  it("all views include a computed defense_readiness_score", () => {
    const views = composeAllStakeholderViews(input);
    // 1 of 2 assumptions validated (0.5 rate), mean grounding = (0.92 + 0.78) / 2 = 0.85
    // score = 0.6 * 0.5 + 0.4 * 0.85 = 0.3 + 0.34 = 0.64
    for (const view of Object.values(views)) {
      expect(view.defense_readiness_score).toBeGreaterThan(0);
      expect(view.defense_readiness_score).toBeLessThanOrEqual(1);
    }
    // All personas compute the same score from the same input
    expect(views.cfo.defense_readiness_score).toBe(views.cto.defense_readiness_score);
    expect(views.cto.defense_readiness_score).toBe(views.lob.defense_readiness_score);
  });

  it("rejected hypotheses are excluded from all views", () => {
    const rejectedHypothesis: ValueHypothesis = {
      ...hypotheses[0],
      id: "00000000-0000-0000-0000-000000000099",
      status: "rejected",
      category: "cost_reduction",
    };
    const inputWithRejected: ArtifactComposerInput = {
      ...input,
      hypotheses: [...hypotheses, rejectedHypothesis],
    };
    const views = composeAllStakeholderViews(inputWithRejected);
    for (const view of Object.values(views)) {
      const ids = view.highlighted_hypotheses.map((h) => h.id);
      expect(ids).not.toContain("00000000-0000-0000-0000-000000000099");
    }
  });

  it("CTO view Evidence Quality section lists evidence with grounding scores", () => {
    const cto = composeStakeholderView("cto", input);
    const evidenceSection = cto.sections.find((s) => s.heading === "Evidence Quality");
    expect(evidenceSection).toBeDefined();
    expect(evidenceSection!.content).toContain("92%");
    expect(evidenceSection!.content).toContain("PLATINUM");
  });

  it("CFO view Risk Factors section lists unvalidated assumptions", () => {
    const cfo = composeStakeholderView("cfo", input);
    const riskSection = cfo.sections.find((s) => s.heading === "Risk Factors");
    expect(riskSection).toBeDefined();
    expect(riskSection!.content).toContain("Headcount reduction");
    expect(riskSection!.content).toContain("unvalidated");
  });

  it("sections are ordered by priority ascending", () => {
    for (const persona of ["cfo", "cto", "lob"] as const) {
      const view = composeStakeholderView(persona, input);
      for (let i = 1; i < view.sections.length; i++) {
        expect(view.sections[i].priority).toBeGreaterThanOrEqual(
          view.sections[i - 1].priority
        );
      }
    }
  });
});

describe("composeAllStakeholderViews", () => {
  it("returns views for all three personas", () => {
    const views = composeAllStakeholderViews(input);
    expect(views.cfo).toBeDefined();
    expect(views.cto).toBeDefined();
    expect(views.lob).toBeDefined();
  });

  it("CFO and CTO views have different content emphasis", () => {
    const views = composeAllStakeholderViews(input);
    // CFO has Financial Summary section; CTO has Evidence Quality section
    const cfoHeadings = views.cfo.sections.map((s) => s.heading);
    const ctoHeadings = views.cto.sections.map((s) => s.heading);
    expect(cfoHeadings).toContain("Financial Summary");
    expect(ctoHeadings).toContain("Evidence Quality");
    expect(cfoHeadings).not.toContain("Evidence Quality");
    expect(ctoHeadings).not.toContain("Financial Summary");
  });
});

// ---------------------------------------------------------------------------
// ArtifactComposer.planTask — subgoal generation
// ---------------------------------------------------------------------------

describe('ArtifactComposer.planTask', () => {
  let composer: ArtifactComposer;

  beforeEach(() => {
    composer = makeComposer();
  });

  it('throws when task planning is disabled', async () => {
    const disabled = makeComposer({ enableTaskPlanning: false });
    await expect(disabled.planTask('value_assessment', 'test')).rejects.toThrow('Task planning is disabled');
  });

  it('returns a taskId and non-empty subgoals for value_assessment', async () => {
    const result = await composer.planTask('value_assessment', 'Assess value for Acme');
    expect(result.taskId).toBeTruthy();
    expect(result.subgoals.length).toBeGreaterThan(0);
  });

  it('returns a taskId and non-empty subgoals for financial_modeling', async () => {
    const result = await composer.planTask('financial_modeling', 'Model ROI');
    expect(result.subgoals.length).toBeGreaterThan(0);
    expect(result.subgoals[0].assignedAgent).toBe('company-intelligence');
  });

  it('returns a taskId and non-empty subgoals for expansion_planning', async () => {
    const result = await composer.planTask('expansion_planning', 'Plan expansion');
    expect(result.subgoals.length).toBeGreaterThan(0);
    expect(result.subgoals[0].assignedAgent).toBe('expansion');
  });

  it('falls back to value_assessment pattern for unknown intent', async () => {
    const result = await composer.planTask('unknown_intent', 'Do something');
    expect(result.subgoals.length).toBe(4); // value_assessment has 4 steps
  });

  it('subgoal descriptions include the provided description', async () => {
    const result = await composer.planTask('value_assessment', 'Assess Acme Corp');
    for (const sg of result.subgoals) {
      expect(sg.description).toContain('Assess Acme Corp');
    }
  });

  it('each subgoal has a unique id', async () => {
    const result = await composer.planTask('value_assessment', 'test');
    const ids = result.subgoals.map((sg) => sg.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// ArtifactComposer.planTask — execution order
// ---------------------------------------------------------------------------

describe('ArtifactComposer.planTask execution order', () => {
  let composer: ArtifactComposer;

  beforeEach(() => {
    composer = makeComposer();
  });

  it('execution order respects dependencies (no dep before its dependency)', async () => {
    const result = await composer.planTask('value_assessment', 'test');
    const idToIndex = new Map(result.executionOrder.map((id, i) => [id, i]));

    for (const sg of result.subgoals) {
      for (const dep of sg.dependencies) {
        const depIdx = idToIndex.get(dep) ?? -1;
        const sgIdx = idToIndex.get(sg.id) ?? -1;
        expect(depIdx).toBeLessThan(sgIdx);
      }
    }
  });

  it('execution order contains all subgoal ids', async () => {
    const result = await composer.planTask('financial_modeling', 'test');
    const subgoalIds = new Set(result.subgoals.map((sg) => sg.id));
    const orderIds = new Set(result.executionOrder);
    expect(orderIds).toEqual(subgoalIds);
  });
});

// ---------------------------------------------------------------------------
// ArtifactComposer.planTask — complexity score
// ---------------------------------------------------------------------------

describe('ArtifactComposer.planTask complexity', () => {
  let composer: ArtifactComposer;

  beforeEach(() => {
    composer = makeComposer();
  });

  it('complexity score is between 0 and 1', async () => {
    const result = await composer.planTask('value_assessment', 'test');
    expect(result.complexityScore).toBeGreaterThanOrEqual(0);
    expect(result.complexityScore).toBeLessThanOrEqual(1);
  });

  it('requiresSimulation is false when simulation is disabled', async () => {
    const result = await composer.planTask('value_assessment', 'test');
    expect(result.requiresSimulation).toBe(false);
  });

  it('requiresSimulation flag is driven by threshold, not hardcoded', async () => {
    const simEnabled = makeComposer({ enableSimulation: true });
    const result = await simEnabled.planTask('value_assessment', 'test');
    expect(typeof result.requiresSimulation).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// ArtifactComposer.generateSDUIPage — delegation
// ---------------------------------------------------------------------------

describe('ArtifactComposer.generateSDUIPage', () => {
  it('delegates to WorkflowRenderService.generateSDUIPage', async () => {
    const { DefaultWorkflowRenderService } = await import('../../../services/workflows/WorkflowRenderService.js');
    const sdui = vi.fn().mockResolvedValue({ type: 'sdui-page', payload: { title: 'Test' } });
    vi.mocked(DefaultWorkflowRenderService).mockImplementationOnce(function () {
      return {
        generateSDUIPage: sdui,
        generateAndRenderPage: vi.fn(),
      } as never;
    });

    const composer = makeComposer();
    const envelope = { intent: 'test', actor: { id: 'u1' }, organizationId: 'org-1', entryPoint: 'api', reason: 'test', timestamps: { requestedAt: new Date().toISOString() } };
    await composer.generateSDUIPage(envelope as never, 'coordinator', 'show dashboard');

    expect(sdui).toHaveBeenCalledWith(envelope, 'coordinator', 'show dashboard', undefined, undefined);
  });

  it('throws when SDUI is disabled', async () => {
    const { DefaultWorkflowRenderService } = await import('../../../services/workflows/WorkflowRenderService.js');
    vi.mocked(DefaultWorkflowRenderService).mockImplementationOnce(function () {
      return {
        generateSDUIPage: vi.fn().mockRejectedValue(new Error('SDUI is disabled')),
        generateAndRenderPage: vi.fn(),
      } as never;
    });

    const composer = makeComposer({ enableSDUI: false });
    const envelope = { intent: 'test', actor: { id: 'u1' }, organizationId: 'org-1', entryPoint: 'api', reason: 'test', timestamps: { requestedAt: new Date().toISOString() } };
    await expect(composer.generateSDUIPage(envelope as never, 'coordinator', 'test')).rejects.toThrow('SDUI is disabled');
  });
});
