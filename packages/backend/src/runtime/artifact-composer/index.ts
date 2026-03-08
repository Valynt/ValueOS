/**
 * ArtifactComposer
 *
 * Generates stakeholder-ready output artifacts from a BusinessCase.
 * Each stakeholder persona (CFO, CTO, LOB) receives a view that emphasises
 * the signals most relevant to their decision criteria while drawing from
 * the same underlying BusinessCase, hypotheses, and financial data.
 *
 * Extracted from UnifiedAgentOrchestrator in Sprint 4.
 * Multi-stakeholder views added in Sprint 9.
 */

import { z } from "zod";

import type {
  BusinessCase,
  FinancialSummary,
  ValueHypothesis,
  Assumption,
  Evidence,
} from "@valueos/shared/domain";
import { calculateDefenseReadiness } from "../../domain/business-case/defenseReadiness.js";

// ─── Persona types ────────────────────────────────────────────────────────────

/**
 * The three primary stakeholder personas for business case presentation.
 *
 * - cfo: Prioritises ROI, payback, and financial risk.
 * - cto: Prioritises technical feasibility, integration risk, and scalability.
 * - lob: Prioritises operational impact, time-to-value, and team outcomes.
 */
export const StakeholderPersonaSchema = z.enum(["cfo", "cto", "lob"]);
export type StakeholderPersona = z.infer<typeof StakeholderPersonaSchema>;

// ─── Artifact types ───────────────────────────────────────────────────────────

export interface ArtifactSection {
  heading: string;
  content: string;
  /** Relative priority for this section within the view (1 = highest). */
  priority: number;
}

export interface StakeholderView {
  business_case_id: string;
  organization_id: string;
  persona: StakeholderPersona;
  title: string;
  /** One-sentence executive summary tailored to the persona's concerns. */
  executive_summary: string;
  sections: ArtifactSection[];
  /** Hypotheses surfaced for this persona, ordered by relevance. */
  highlighted_hypotheses: ValueHypothesis[];
  /** Key metrics the persona cares about, extracted from financial_summary. */
  key_metrics: Record<string, string | number | null>;
  /**
   * Defense readiness score (0–1) computed from the assumptions and evidence
   * passed to the composer. Mirrors BusinessCase.defense_readiness_score.
   * Callers that persist the BusinessCase should write this value back to the
   * domain object via calculateDefenseReadiness() in
   * packages/backend/src/domain/business-case/defenseReadiness.ts.
   */
  defense_readiness_score: number;
  generated_at: string;
}

export interface ArtifactComposerInput {
  business_case: BusinessCase;
  hypotheses: ValueHypothesis[];
  assumptions: Assumption[];
  evidence: Evidence[];
  /**
   * Pre-computed defense readiness score. When provided, skips the
   * calculateDefenseReadiness call inside composeStakeholderView.
   * Use this when composing multiple views from the same input to avoid
   * recomputing the score once per persona.
   */
  precomputed_defense_readiness_score?: number;
}

// ─── Persona strategies ───────────────────────────────────────────────────────

/**
 * Each strategy defines how a persona's view is assembled from the same
 * underlying BusinessCase data. Strategies are pure functions — no side effects.
 */
interface PersonaStrategy {
  title: (bc: BusinessCase) => string;
  executive_summary: (bc: BusinessCase, fs: FinancialSummary | null) => string;
  sections: (input: ArtifactComposerInput) => ArtifactSection[];
  hypothesis_filter: (h: ValueHypothesis) => boolean;
  hypothesis_sort: (a: ValueHypothesis, b: ValueHypothesis) => number;
  key_metrics: (fs: FinancialSummary | null) => Record<string, string | number | null>;
}

// ─── CFO strategy ─────────────────────────────────────────────────────────────

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
    const payback =
      fs.payback_months != null
        ? `${fs.payback_months}-month payback`
        : null;
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
                  : "")
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

// ─── CTO strategy ─────────────────────────────────────────────────────────────

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
                  : "")
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
                      : "")
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
                (a.human_reviewed ? " ✓" : " (pending review)")
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

// ─── LOB strategy ─────────────────────────────────────────────────────────────

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
                (b.estimated_value?.timeframe_months ?? 0)
            )
            .map(
              (h) =>
                `• ${h.description.slice(0, 80)}… — ${h.estimated_value!.timeframe_months} months`
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

// ─── Strategy registry ────────────────────────────────────────────────────────

const STRATEGIES: Record<StakeholderPersona, PersonaStrategy> = {
  cfo: cfoStrategy,
  cto: ctoStrategy,
  lob: lobStrategy,
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compose a stakeholder-specific view of a BusinessCase.
 *
 * The same BusinessCase ID produces distinct views for each persona:
 * - CFO view emphasises ROI, payback, and financial risk.
 * - CTO view emphasises technical feasibility, evidence quality, and integration risk.
 * - LOB view emphasises operational impact, time-to-value, and team outcomes.
 */
export function composeStakeholderView(
  persona: StakeholderPersona,
  input: ArtifactComposerInput
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
    // Sort by priority so callers can rely on the ordering regardless of
    // the order strategies define their sections internally.
    sections: strategy.sections(input).sort((a, b) => a.priority - b.priority),
    highlighted_hypotheses: filteredHypotheses,
    key_metrics: strategy.key_metrics(fs),
    defense_readiness_score,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Compose views for all three personas from the same BusinessCase.
 * Returns a map keyed by persona.
 */
export function composeAllStakeholderViews(
  input: ArtifactComposerInput
): Record<StakeholderPersona, StakeholderView> {
  // Compute once and share across all three persona views.
  const precomputed_defense_readiness_score =
    input.precomputed_defense_readiness_score ??
    calculateDefenseReadiness({ assumptions: input.assumptions, evidence: input.evidence }).score;

  const shared = { ...input, precomputed_defense_readiness_score };

  return {
    cfo: composeStakeholderView("cfo", shared),
    cto: composeStakeholderView("cto", shared),
    lob: composeStakeholderView("lob", shared),
  };
}
