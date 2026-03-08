/**
 * ArtifactComposer
 *
 * Assembles final business case artifacts: SDUI page generation, task planning,
 * and narrative framing. Extracted from UnifiedAgentOrchestrator in Sprint 4.
 *
 * Also supports stakeholder-ready business case views (Sprint 9), where CFO,
 * CTO, and LOB personas receive tailored presentations of the same underlying
 * BusinessCase, hypotheses, assumptions, and evidence.
 *
 * Owns:
 *  - generateSDUIPage / generateAndRenderPage (delegated to WorkflowRenderService)
 *  - planTask / generateSubgoals / determineExecutionOrder / calculateComplexity
 *  - composeStakeholderView / composeAllStakeholderViews
 */

import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

import type {
  BusinessCase,
  FinancialSummary,
  ValueHypothesis,
  Assumption,
  Evidence,
} from "@valueos/shared/domain";
import { calculateDefenseReadiness } from "../../domain/business-case/defenseReadiness.js";

import { getAgentAPI } from "../../services/AgentAPI.js";
import { DefaultWorkflowRenderService } from "../../services/workflows/WorkflowRenderService.js";
import { DefaultWorkflowSimulationService } from "../../services/workflows/WorkflowSimulationService.js";
import type { AgentType } from "../../services/agent-types.js";
import type { AgentContext } from "../../services/AgentAPI.js";
import type { WorkflowContextDTO } from "../../types/workflow/orchestration.js";
import type {
  AgentResponse,
  ExecutionEnvelope,
  RenderPageOptions,
  StreamingUpdate,
  TaskPlanResult,
  SubgoalDefinition,
} from "../../services/UnifiedAgentOrchestrator.js";

export type { TaskPlanResult, SubgoalDefinition };

// ============================================================================
// Service config
// ============================================================================

export interface ArtifactComposerConfig {
  enableSDUI: boolean;
  enableTaskPlanning: boolean;
  enableSimulation: boolean;
}

const DEFAULT_CONFIG: ArtifactComposerConfig = {
  enableSDUI: true,
  enableTaskPlanning: true,
  enableSimulation: false,
};

// ============================================================================
// Stakeholder persona types
// ============================================================================

/**
 * The three primary stakeholder personas for business case presentation.
 *
 * - cfo: Prioritises ROI, payback, and financial risk.
 * - cto: Prioritises technical feasibility, integration risk, and scalability.
 * - lob: Prioritises operational impact, time-to-value, and team outcomes.
 */
export const StakeholderPersonaSchema = z.enum(["cfo", "cto", "lob"]);
export type StakeholderPersona = z.infer<typeof StakeholderPersonaSchema>;

// ============================================================================
// Stakeholder artifact types
// ============================================================================

export interface ArtifactSection {
  heading: string;
  content: string;
  priority: number;
}

export interface StakeholderView {
  business_case_id: string;
  organization_id: string;
  persona: StakeholderPersona;
  title: string;
  executive_summary: string;
  sections: ArtifactSection[];
  highlighted_hypotheses: ValueHypothesis[];
  key_metrics: Record<string, string | number | null>;
  defense_readiness_score: number;
  generated_at: string;
}

export interface ArtifactComposerInput {
  business_case: BusinessCase;
  hypotheses: ValueHypothesis[];
  assumptions: Assumption[];
  evidence: Evidence[];
  precomputed_defense_readiness_score?: number;
}

// ============================================================================
// Persona strategies
// ============================================================================

interface PersonaStrategy {
  title: (bc: BusinessCase) => string;
  executive_summary: (bc: BusinessCase, fs: FinancialSummary | null) => string;
  sections: (input: ArtifactComposerInput) => ArtifactSection[];
  hypothesis_filter: (h: ValueHypothesis) => boolean;
  hypothesis_sort: (a: ValueHypothesis, b: ValueHypothesis) => number;
  key_metrics: (fs: FinancialSummary | null) => Record<string, string | number | null>;
}

const CFO_CATEGORIES = new Set([
  "cost_reduction",
  "revenue_acceleration",
  "revenue_growth",
  "risk_mitigation",
]);

const cfoStrategy: PersonaStrategy = {
  title: (bc) => `${bc.title} — Financial Impact Summary`,
  executive_summary: (bc, fs) => {
    if (!fs) {
      return `${bc.title} presents a value opportunity currently under financial modelling.`;
    }
    const roi = fs.roi_3yr != null ? `${(fs.roi_3yr * 100).toFixed(0)}% 3-year ROI` : null;
    const payback = fs.payback_months != null ? `${fs.payback_months}-month payback` : null;
    const range = `$${(fs.total_value_low_usd / 1_000_000).toFixed(1)}M–$${(fs.total_value_high_usd / 1_000_000).toFixed(1)}M`;
    const parts = [range, roi, payback].filter(Boolean).join(", ");
    return `${bc.title} delivers ${parts} in validated value.`;
  },
  sections: (input) => {
    const { business_case: bc, hypotheses, assumptions } = input;
    const fs = bc.financial_summary ?? null;

    return [
      {
        heading: "Financial Summary",
        priority: 1,
        content: fs
          ? [
              `Total value range: $${fs.total_value_low_usd.toLocaleString()} – $${fs.total_value_high_usd.toLocaleString()} ${fs.currency}`,
              fs.roi_3yr != null ? `3-year ROI: ${(fs.roi_3yr * 100).toFixed(1)}%` : null,
              fs.payback_months != null ? `Payback period: ${fs.payback_months} months` : null,
              fs.irr != null ? `IRR: ${(fs.irr * 100).toFixed(1)}%` : null,
            ]
              .filter(Boolean)
              .join("\n")
          : "Financial model pending.",
      },
      {
        heading: "Value Drivers",
        priority: 2,
        content:
          hypotheses
            .filter((h) => CFO_CATEGORIES.has(h.category))
            .map(
              (h) =>
                `• ${h.description}` +
                (h.estimated_value
                  ? ` ($${h.estimated_value.low.toLocaleString()}–$${h.estimated_value.high.toLocaleString()} ${h.estimated_value.unit})`
                  : ""),
            )
            .join("\n") || "No financial value drivers identified.",
      },
      {
        heading: "Key Assumptions",
        priority: 3,
        content:
          assumptions
            .filter((a) => a.human_reviewed)
            .map((a) => `• ${a.name}: ${a.value} ${a.unit}`)
            .join("\n") || "No validated assumptions on record.",
      },
      {
        heading: "Risk Factors",
        priority: 4,
        content:
          assumptions
            .filter((a) => !a.human_reviewed)
            .map((a) => `• ${a.name} (unvalidated — requires review)`)
            .join("\n") || "All assumptions have been reviewed.",
      },
    ];
  },
  hypothesis_filter: (h) => CFO_CATEGORIES.has(h.category) && h.status !== "rejected",
  hypothesis_sort: (a, b) => {
    const aVal = a.estimated_value?.high ?? 0;
    const bVal = b.estimated_value?.high ?? 0;
    if (bVal !== aVal) return bVal - aVal;
    const confOrder = { high: 2, medium: 1, low: 0 };
    return confOrder[b.confidence] - confOrder[a.confidence];
  },
  key_metrics: (fs) => ({
    total_value_low_usd: fs?.total_value_low_usd ?? null,
    total_value_high_usd: fs?.total_value_high_usd ?? null,
    roi_3yr: fs?.roi_3yr ?? null,
    payback_months: fs?.payback_months ?? null,
    irr: fs?.irr ?? null,
    currency: fs?.currency ?? "USD",
  }),
};

const CTO_CATEGORIES = new Set([
  "operational_efficiency",
  "risk_mitigation",
  "strategic_advantage",
]);

const ctoStrategy: PersonaStrategy = {
  title: (bc) => `${bc.title} — Technical Feasibility & Integration Assessment`,
  executive_summary: (bc, fs) => {
    const valueRange = fs
      ? ` delivering $${(fs.total_value_low_usd / 1_000_000).toFixed(1)}M–$${(fs.total_value_high_usd / 1_000_000).toFixed(1)}M in operational value`
      : "";
    return `${bc.title} addresses technical risk and operational efficiency${valueRange}.`;
  },
  sections: (input) => {
    const { business_case: bc, hypotheses, assumptions, evidence } = input;
    const techHypotheses = hypotheses.filter((h) => CTO_CATEGORIES.has(h.category));

    return [
      {
        heading: "Operational Impact",
        priority: 1,
        content:
          techHypotheses
            .map(
              (h) =>
                `• ${h.description}` +
                (h.estimated_value
                  ? ` (${h.estimated_value.low}–${h.estimated_value.high} ${h.estimated_value.unit} over ${h.estimated_value.timeframe_months} months)`
                  : ""),
            )
            .join("\n") || "No operational hypotheses identified.",
      },
      {
        heading: "Evidence Quality",
        priority: 2,
        content:
          evidence.length > 0
            ? evidence
                .map(
                  (e) =>
                    `• [${e.tier.toUpperCase()}] ${e.title}` +
                    (e.grounding_score != null
                      ? ` — grounding score: ${(e.grounding_score * 100).toFixed(0)}%`
                      : ""),
                )
                .join("\n")
            : "No evidence items attached.",
      },
      {
        heading: "Integration Assumptions",
        priority: 3,
        content:
          assumptions
            .map(
              (a) =>
                `• ${a.name}: ${a.value} ${a.unit}` +
                (a.human_reviewed ? " ✓" : " (pending review)"),
            )
            .join("\n") || "No assumptions recorded.",
      },
      {
        heading: "Scalability & Risk",
        priority: 4,
        content: [
          `Business case version: ${bc.version}`,
          `Status: ${bc.status}`,
          assumptions.filter((a) => !a.human_reviewed).length > 0
            ? `${assumptions.filter((a) => !a.human_reviewed).length} assumption(s) require technical validation.`
            : "All assumptions validated.",
        ].join("\n"),
      },
    ];
  },
  hypothesis_filter: (h) => CTO_CATEGORIES.has(h.category) && h.status !== "rejected",
  hypothesis_sort: (a, b) => {
    const confOrder = { high: 2, medium: 1, low: 0 };
    const confDiff = confOrder[b.confidence] - confOrder[a.confidence];
    if (confDiff !== 0) return confDiff;
    const aMonths = a.estimated_value?.timeframe_months ?? Infinity;
    const bMonths = b.estimated_value?.timeframe_months ?? Infinity;
    return aMonths - bMonths;
  },
  key_metrics: (fs) => ({
    total_value_low_usd: fs?.total_value_low_usd ?? null,
    total_value_high_usd: fs?.total_value_high_usd ?? null,
    payback_months: fs?.payback_months ?? null,
  }),
};

const LOB_CATEGORIES = new Set([
  "operational_efficiency",
  "cost_reduction",
  "revenue_growth",
  "revenue_acceleration",
  "strategic_advantage",
]);

const lobStrategy: PersonaStrategy = {
  title: (bc) => `${bc.title} — Operational Impact & Team Outcomes`,
  executive_summary: (bc, fs) => {
    const valueRange = fs
      ? ` with $${(fs.total_value_low_usd / 1_000_000).toFixed(1)}M–$${(fs.total_value_high_usd / 1_000_000).toFixed(1)}M in measurable outcomes`
      : "";
    return `${bc.title} improves day-to-day operations and team productivity${valueRange}.`;
  },
  sections: (input) => {
    const { hypotheses, assumptions, evidence } = input;
    const lobHypotheses = hypotheses.filter((h) => LOB_CATEGORIES.has(h.category));

    const evidenceByHypothesis = new Map<string, Evidence[]>();
    for (const e of evidence) {
      if (e.hypothesis_id) {
        const existing = evidenceByHypothesis.get(e.hypothesis_id) ?? [];
        existing.push(e);
        evidenceByHypothesis.set(e.hypothesis_id, existing);
      }
    }

    return [
      {
        heading: "Team & Process Impact",
        priority: 1,
        content:
          lobHypotheses
            .map((h) => {
              const ev = evidenceByHypothesis.get(h.id) ?? [];
              const evLine =
                ev.length > 0
                  ? ` (${ev.length} evidence item${ev.length > 1 ? "s" : ""})`
                  : "";
              return (
                `• ${h.description}` +
                (h.estimated_value
                  ? ` — ${h.estimated_value.low}–${h.estimated_value.high} ${h.estimated_value.unit}`
                  : "") +
                evLine
              );
            })
            .join("\n") || "No operational impact hypotheses identified.",
      },
      {
        heading: "Time to Value",
        priority: 2,
        content:
          lobHypotheses
            .filter((h) => h.estimated_value?.timeframe_months != null)
            .sort(
              (a, b) =>
                (a.estimated_value?.timeframe_months ?? 0) -
                (b.estimated_value?.timeframe_months ?? 0),
            )
            .map(
              (h) =>
                `• ${h.description.slice(0, 80)}… — ${h.estimated_value!.timeframe_months} months`,
            )
            .join("\n") || "Timeframes not yet estimated.",
      },
      {
        heading: "Supporting Evidence",
        priority: 3,
        content:
          evidence.length > 0
            ? evidence.map((e) => `• ${e.title} [${e.tier}]`).join("\n")
            : "No evidence items attached.",
      },
      {
        heading: "Validated Inputs",
        priority: 4,
        content:
          assumptions
            .filter((a) => a.human_reviewed)
            .map((a) => `• ${a.name}: ${a.value} ${a.unit}`)
            .join("\n") || "No validated assumptions on record.",
      },
    ];
  },
  hypothesis_filter: (h) => LOB_CATEGORIES.has(h.category) && h.status !== "rejected",
  hypothesis_sort: (a, b) => {
    const aMonths = a.estimated_value?.timeframe_months ?? Infinity;
    const bMonths = b.estimated_value?.timeframe_months ?? Infinity;
    if (aMonths !== bMonths) return aMonths - bMonths;
    const confOrder = { high: 2, medium: 1, low: 0 };
    return confOrder[b.confidence] - confOrder[a.confidence];
  },
  key_metrics: (fs) => ({
    total_value_low_usd: fs?.total_value_low_usd ?? null,
    total_value_high_usd: fs?.total_value_high_usd ?? null,
    payback_months: fs?.payback_months ?? null,
  }),
};

const STRATEGIES: Record<StakeholderPersona, PersonaStrategy> = {
  cfo: cfoStrategy,
  cto: ctoStrategy,
  lob: lobStrategy,
};

// ============================================================================
// ArtifactComposer service
// ============================================================================

export class ArtifactComposer {
  private readonly renderService: DefaultWorkflowRenderService;
  private readonly simulationService: DefaultWorkflowSimulationService;

  constructor(
    private readonly config: ArtifactComposerConfig = DEFAULT_CONFIG,
    validateExecutionIntent?: (envelope: ExecutionEnvelope) => void,
  ) {
    const agentAPI = getAgentAPI();
    const validate = validateExecutionIntent ?? ((_e: ExecutionEnvelope) => {});
    this.renderService = new DefaultWorkflowRenderService(
      agentAPI,
      validate,
      () => this.config.enableSDUI,
    );
    this.simulationService = new DefaultWorkflowSimulationService(agentAPI);
  }

  async generateSDUIPage(
    envelope: ExecutionEnvelope,
    agent: AgentType,
    query: string,
    context?: AgentContext,
    streamingCallback?: (update: StreamingUpdate) => void,
  ): Promise<AgentResponse> {
    return this.renderService.generateSDUIPage(
      envelope,
      agent,
      query,
      context,
      streamingCallback,
    );
  }

  async generateAndRenderPage(
    envelope: ExecutionEnvelope,
    agent: AgentType,
    query: string,
    context?: AgentContext,
    renderOptions?: RenderPageOptions,
  ): Promise<{ response: AgentResponse; rendered: unknown }> {
    return this.renderService.generateAndRenderPage(
      envelope,
      agent,
      query,
      context,
      renderOptions,
    );
  }

  async planTask(
    intentType: string,
    description: string,
    context: WorkflowContextDTO = {},
  ): Promise<TaskPlanResult> {
    if (!this.config.enableTaskPlanning) {
      throw new Error("Task planning is disabled");
    }

    const taskId = uuidv4();
    const subgoals = this._generateSubgoals(taskId, intentType, description, context);
    const executionOrder = this._determineExecutionOrder(subgoals);
    const complexityScore = this._calculateComplexity(subgoals);
    const requiresSimulation =
      this.config.enableSimulation && complexityScore > 0.7;

    return {
      taskId,
      subgoals,
      executionOrder,
      complexityScore,
      requiresSimulation,
    };
  }

  private _generateSubgoals(
    _taskId: string,
    intentType: string,
    description: string,
    _context: WorkflowContextDTO,
  ): SubgoalDefinition[] {
    const patterns: Record<
      string,
      Array<{ type: string; agent: string; deps: string[] }>
    > = {
      value_assessment: [
        { type: "discovery", agent: "opportunity", deps: [] },
        { type: "analysis", agent: "system-mapper", deps: ["discovery"] },
        { type: "design", agent: "intervention-designer", deps: ["analysis"] },
        { type: "validation", agent: "value-eval", deps: ["design"] },
      ],
      financial_modeling: [
        { type: "data_collection", agent: "company-intelligence", deps: [] },
        { type: "modeling", agent: "financial-modeling", deps: ["data_collection"] },
        { type: "reporting", agent: "coordinator", deps: ["modeling"] },
      ],
      expansion_planning: [
        { type: "analysis", agent: "expansion", deps: [] },
        { type: "opportunity_mapping", agent: "opportunity", deps: ["analysis"] },
        { type: "planning", agent: "coordinator", deps: ["opportunity_mapping"] },
      ],
    };

    const pattern = patterns[intentType] ?? patterns["value_assessment"] ?? [];
    const idMap = new Map<string, string>();

    return pattern.map((step, index) => {
      const id = uuidv4();
      idMap.set(step.type, id);
      const dependencies = step.deps
        .map((d) => idMap.get(d))
        .filter((x): x is string => x !== undefined);

      return {
        id,
        type: step.type,
        description: `${step.type}: ${description}`,
        assignedAgent: step.agent,
        dependencies,
        priority: pattern.length - index,
        estimatedComplexity: 0.5 + index * 0.1,
      };
    });
  }

  private _determineExecutionOrder(subgoals: SubgoalDefinition[]): string[] {
    const order: string[] = [];
    const completed = new Set<string>();
    const remaining = [...subgoals];

    while (remaining.length > 0) {
      const ready = remaining.filter((sg) =>
        sg.dependencies.every((dep) => completed.has(dep)),
      );

      if (ready.length === 0) {
        throw new Error("Circular dependency detected in subgoals");
      }

      for (const sg of ready) {
        order.push(sg.id);
        completed.add(sg.id);
        remaining.splice(remaining.indexOf(sg), 1);
      }
    }

    return order;
  }

  private _calculateComplexity(subgoals: SubgoalDefinition[]): number {
    if (subgoals.length === 0) return 0;

    const avg =
      subgoals.reduce((s, sg) => s + sg.estimatedComplexity, 0) /
      subgoals.length;
    const countFactor = Math.min(subgoals.length / 10, 1);
    const totalDeps = subgoals.reduce((s, sg) => s + sg.dependencies.length, 0);
    const depFactor = Math.min(totalDeps / (subgoals.length * 2), 1);

    return Math.min((avg + countFactor + depFactor) / 3, 1);
  }
}

// ============================================================================
// Stakeholder view API
// ============================================================================

export function composeStakeholderView(
  persona: StakeholderPersona,
  input: ArtifactComposerInput,
): StakeholderView {
  const {
    business_case: bc,
    hypotheses,
    assumptions,
    evidence,
    precomputed_defense_readiness_score,
  } = input;

  const strategy = STRATEGIES[persona];
  const fs = bc.financial_summary ?? null;

  const filteredHypotheses = hypotheses
    .filter(strategy.hypothesis_filter)
    .sort(strategy.hypothesis_sort);

  const defense_readiness_score =
    precomputed_defense_readiness_score ??
    calculateDefenseReadiness({ assumptions, evidence }).score;

  return {
    business_case_id: bc.id,
    organization_id: bc.organization_id,
    persona,
    title: strategy.title(bc),
    executive_summary: strategy.executive_summary(bc, fs),
    sections: strategy.sections(input).sort((a, b) => a.priority - b.priority),
    highlighted_hypotheses: filteredHypotheses,
    key_metrics: strategy.key_metrics(fs),
    defense_readiness_score,
    generated_at: new Date().toISOString(),
  };
}

export function composeAllStakeholderViews(
  input: ArtifactComposerInput,
): Record<StakeholderPersona, StakeholderView> {
  const precomputed_defense_readiness_score =
    input.precomputed_defense_readiness_score ??
    calculateDefenseReadiness({
      assumptions: input.assumptions,
      evidence: input.evidence,
    }).score;

  const shared = { ...input, precomputed_defense_readiness_score };

  return {
    cfo: composeStakeholderView("cfo", shared),
    cto: composeStakeholderView("cto", shared),
    lob: composeStakeholderView("lob", shared),
  };
}

export const artifactComposer = new ArtifactComposer();
