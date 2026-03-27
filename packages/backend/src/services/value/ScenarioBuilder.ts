/**
 * ScenarioBuilder
 *
 * Builds three financial scenarios (conservative, base, upside) from
 * accepted value hypotheses and assumptions. Uses economic kernel for
 * all calculations (no LLM math, no hardcoded investment ratios).
 *
 * Cost/timeline input resolution (precedence order):
 *   1. Explicit values in ScenarioBuildInput
 *   2. Assumptions register — looks for 'implementation_cost' / 'timeline_years'
 *   3. Throws if cost cannot be resolved (never silently invents a ratio)
 *
 * Reference: openspec/changes/value-modeling-engine/tasks.md §6
 */

import Decimal from 'decimal.js';
import { z } from "zod";

import {
  calculateNPV,
  calculatePayback,
  calculateROI,
  roundTo,
  toDecimalArray,
} from '../../domain/economic-kernel/economic_kernel.js';
import { logger } from "../lib/logger.js";
import { supabase } from "../lib/supabase.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const ScenarioSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  case_id: z.string().uuid(),
  scenario_type: z.enum(["conservative", "base", "upside"]),
  assumptions_snapshot_json: z.record(z.unknown()),
  roi: z.number().nullable(),
  npv: z.number().nullable(),
  payback_months: z.number().nullable(),
  evf_decomposition_json: z.object({
    revenue_uplift: z.number(),
    cost_reduction: z.number(),
    risk_mitigation: z.number(),
    efficiency_gain: z.number(),
  }),
  sensitivity_results_json: z.array(z.object({
    assumption_id: z.string().uuid(),
    rank: z.number(),
    impact_variance: z.number(),
    direction: z.enum(["positive", "negative"]),
  })),
  cost_input_usd: z.number().nullable(),
  timeline_years: z.number().nullable(),
  investment_source: z.enum(["explicit", "assumptions_register", "default"]).nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Scenario = z.infer<typeof ScenarioSchema>;

export interface ScenarioBuildInput {
  organizationId: string;
  caseId: string;
  /** Human-readable label for the scenario set (stored in assumptions_snapshot_json). */
  name?: string;
  /** Optional description (stored in assumptions_snapshot_json). */
  description?: string;
  acceptedHypotheses: Array<{
    id: string;
    value_driver: string;
    estimated_impact_min: number;
    estimated_impact_max: number;
    confidence_score: number;
  }>;
  assumptions: Array<{
    id: string;
    name: string;
    value: number;
    source_type: string;
  }>;
  /** Explicit investment cost in USD. Wins over assumptions register when provided. */
  estimatedCostUsd?: number;
  /** Benefit realization horizon in years (positive integer). Defaults to 3 if not resolvable. */
  timelineYears?: number;
  /** WACC / discount rate as decimal (e.g. 0.10 = 10%). Defaults to 0.10. */
  discountRate?: number;
}

export interface ScenarioBuildResult {
  conservative: Scenario;
  base: Scenario;
  upside: Scenario;
}

// ---------------------------------------------------------------------------
// Assumption name constants for register lookup
// ---------------------------------------------------------------------------

const COST_ASSUMPTION_NAMES = ["implementation_cost", "implementation cost", "total cost", "project cost"];
const TIMELINE_ASSUMPTION_NAMES = ["timeline_years", "timeline years", "project timeline", "implementation timeline"];

const DEFAULT_DISCOUNT_RATE = 0.10;
const DEFAULT_TIMELINE_YEARS = 3;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ScenarioBuilder {
  /**
   * Build three scenarios from accepted hypotheses.
   *
   * Throws if cost cannot be resolved from explicit input or assumptions register.
   */
  async buildScenarios(input: ScenarioBuildInput): Promise<ScenarioBuildResult> {
    logger.info(`Building financial scenarios for case ${input.caseId}`);

    // Resolve cost, timeline, discount rate with explicit precedence
    const resolved = this.resolveFinancialInputs(input);

    const now = new Date().toISOString();

    const conservativeAssumptions = this.buildAssumptionSnapshot(input.assumptions, "p25", input.name, input.description);
    const baseAssumptions = this.buildAssumptionSnapshot(input.assumptions, "p50", input.name, input.description);
    const upsideAssumptions = this.buildAssumptionSnapshot(input.assumptions, "p75", input.name, input.description);

    // EVF decomposition uses base (p50) values — scenario spread is applied
    // exclusively inside callEconomicKernel to avoid double-multiplying.
    const baseEvf = this.calculateEvfDecomposition(input.acceptedHypotheses);

    const conservativeMetrics = this.callEconomicKernel(baseEvf, resolved, "conservative");
    const baseMetrics = this.callEconomicKernel(baseEvf, resolved, "base");
    const upsideMetrics = this.callEconomicKernel(baseEvf, resolved, "upside");

    const conservative: Scenario = {
      id: crypto.randomUUID(),
      organization_id: input.organizationId,
      case_id: input.caseId,
      scenario_type: "conservative",
      assumptions_snapshot_json: conservativeAssumptions,
      roi: conservativeMetrics.roi,
      npv: conservativeMetrics.npv,
      payback_months: conservativeMetrics.payback_months,
      evf_decomposition_json: baseEvf,
      sensitivity_results_json: [],
      cost_input_usd: resolved.costUsd,
      timeline_years: resolved.timelineYears,
      investment_source: resolved.source,
      created_at: now,
      updated_at: now,
    };

    const base: Scenario = {
      id: crypto.randomUUID(),
      organization_id: input.organizationId,
      case_id: input.caseId,
      scenario_type: "base",
      assumptions_snapshot_json: baseAssumptions,
      roi: baseMetrics.roi,
      npv: baseMetrics.npv,
      payback_months: baseMetrics.payback_months,
      evf_decomposition_json: baseEvf,
      sensitivity_results_json: [],
      cost_input_usd: resolved.costUsd,
      timeline_years: resolved.timelineYears,
      investment_source: resolved.source,
      created_at: now,
      updated_at: now,
    };

    const upside: Scenario = {
      id: crypto.randomUUID(),
      organization_id: input.organizationId,
      case_id: input.caseId,
      scenario_type: "upside",
      assumptions_snapshot_json: upsideAssumptions,
      roi: upsideMetrics.roi,
      npv: upsideMetrics.npv,
      payback_months: upsideMetrics.payback_months,
      evf_decomposition_json: baseEvf,
      sensitivity_results_json: [],
      cost_input_usd: resolved.costUsd,
      timeline_years: resolved.timelineYears,
      investment_source: resolved.source,
      created_at: now,
      updated_at: now,
    };

    await this.persistScenarios([conservative, base, upside]);

    logger.info(`Scenario building complete for case ${input.caseId}: conservative, base, upside`);

    return { conservative, base, upside };
  }

  // ---------------------------------------------------------------------------
  // Input resolution
  // ---------------------------------------------------------------------------

  /**
   * Resolve cost, timeline, and discount rate with explicit precedence:
   *   1. Explicit values in input
   *   2. Assumptions register (looks for named assumptions)
   *   3. Throws for cost if unresolvable; uses defaults for timeline/discount
   */
  resolveFinancialInputs(input: ScenarioBuildInput): {
    costUsd: number;
    timelineYears: number;
    discountRate: number;
    source: "explicit" | "assumptions_register" | "default";
  } {
    const discountRate = input.discountRate ?? DEFAULT_DISCOUNT_RATE;

    if (input.estimatedCostUsd !== undefined && input.estimatedCostUsd !== null) {
      return {
        costUsd: input.estimatedCostUsd,
        timelineYears: this.resolveTimeline(input),
        discountRate,
        source: "explicit",
      };
    }

    const costAssumption = input.assumptions.find((a) =>
      COST_ASSUMPTION_NAMES.includes(a.name.toLowerCase().trim()),
    );

    if (costAssumption) {
      logger.info(`ScenarioBuilder: resolved cost from assumptions register: ${costAssumption.name} = ${costAssumption.value}`);
      return {
        costUsd: costAssumption.value,
        timelineYears: this.resolveTimeline(input),
        discountRate,
        source: "assumptions_register",
      };
    }

    throw new Error(
      `Cannot build scenario for case ${input.caseId}: no cost input provided and no ` +
      `'implementation_cost' assumption found in the assumptions register. ` +
      `Pass estimatedCostUsd in ScenarioBuildInput or add an assumption named 'implementation_cost'.`,
    );
  }

  private resolveTimeline(input: ScenarioBuildInput): number {
    if (input.timelineYears !== undefined && input.timelineYears !== null) {
      return Math.max(1, Math.round(input.timelineYears));
    }

    const timelineAssumption = input.assumptions.find((a) =>
      TIMELINE_ASSUMPTION_NAMES.includes(a.name.toLowerCase().trim()),
    );

    if (timelineAssumption) {
      const years = Math.max(1, Math.round(timelineAssumption.value));
      logger.info(`ScenarioBuilder: resolved timeline from assumptions register: ${years} years`);
      return years;
    }

    return DEFAULT_TIMELINE_YEARS;
  }

  // ---------------------------------------------------------------------------
  // Assumption snapshot
  // ---------------------------------------------------------------------------

  private buildAssumptionSnapshot(
    assumptions: Array<{ id: string; name: string; value: number; source_type: string }>,
    percentile: "p25" | "p50" | "p75",
    name?: string,
    description?: string,
  ): Record<string, unknown> {
    const snapshot: Record<string, unknown> = {};
    const multiplier = percentile === "p25" ? 0.8 : percentile === "p75" ? 1.2 : 1.0;

    // Store name/description under a reserved key so assumption names (which
    // are user-supplied strings) can never overwrite scenario metadata.
    snapshot.__meta = {
      name: name ?? null,
      description: description ?? null,
    };

    for (const assumption of assumptions) {
      snapshot[assumption.name] = {
        id: assumption.id,
        value: assumption.value * multiplier,
        original_value: assumption.value,
        source_type: assumption.source_type,
        percentile_adjustment: percentile,
      };
    }

    return snapshot;
  }

  // ---------------------------------------------------------------------------
  // EVF decomposition
  // ---------------------------------------------------------------------------

  private calculateEvfDecomposition(
    hypotheses: Array<{ value_driver: string; estimated_impact_min: number; estimated_impact_max: number }>,
  ): { revenue_uplift: number; cost_reduction: number; risk_mitigation: number; efficiency_gain: number } {
    // Always computes base (p50) values. Scenario spread (conservative/upside)
    // is applied exclusively in callEconomicKernel via benefitMultiplier.
    let revenue_uplift = 0;
    let cost_reduction = 0;
    let risk_mitigation = 0;
    let efficiency_gain = 0;

    for (const hypothesis of hypotheses) {
      const impact = (hypothesis.estimated_impact_min + hypothesis.estimated_impact_max) / 2;
      const driverLower = hypothesis.value_driver.toLowerCase();

      if (driverLower.includes("revenue") || driverLower.includes("growth") || driverLower.includes("sales")) {
        revenue_uplift += impact;
      } else if (driverLower.includes("cost") || driverLower.includes("savings") || driverLower.includes("reduce")) {
        cost_reduction += impact;
      } else if (driverLower.includes("risk") || driverLower.includes("compliance") || driverLower.includes("security")) {
        risk_mitigation += impact;
      } else {
        efficiency_gain += impact;
      }
    }

    return {
      revenue_uplift: Math.round(revenue_uplift * 100) / 100,
      cost_reduction: Math.round(cost_reduction * 100) / 100,
      risk_mitigation: Math.round(risk_mitigation * 100) / 100,
      efficiency_gain: Math.round(efficiency_gain * 100) / 100,
    };
  }

  // ---------------------------------------------------------------------------
  // Economic kernel
  // ---------------------------------------------------------------------------

  /**
   * Calculate financial metrics using the economic kernel.
   *
   * Cash flow series: period 0 = investment outlay (negative),
   * periods 1..timelineYears = annual benefit (evenly spread).
   * Series length = timelineYears + 1.
   *
   * Scenario multipliers adjust the benefit side only — cost is a real input.
   */
  callEconomicKernel(
    evf: { revenue_uplift: number; cost_reduction: number; risk_mitigation: number; efficiency_gain: number },
    resolved: { costUsd: number; timelineYears: number; discountRate: number },
    scenarioType: string,
  ): { roi: number | null; npv: number | null; payback_months: number | null } {
    const totalValue = evf.revenue_uplift + evf.cost_reduction + evf.risk_mitigation + evf.efficiency_gain;

    // Scenario multipliers adjust the benefit side only
    const benefitMultiplier = scenarioType === "conservative" ? 0.7 : scenarioType === "upside" ? 1.3 : 1.0;
    const adjustedValue = totalValue * benefitMultiplier;

    const annualBenefit = adjustedValue / resolved.timelineYears;

    // Build cash flow series: [−cost, benefit_yr1, ..., benefit_yrN]
    const flows: number[] = [-resolved.costUsd];
    for (let i = 0; i < resolved.timelineYears; i++) {
      flows.push(annualBenefit);
    }

    const cashFlows = toDecimalArray(flows);
    const discountRate = new Decimal(resolved.discountRate);

    const npv = calculateNPV(cashFlows, discountRate);

    let roi: number | null = null;
    if (resolved.costUsd > 0) {
      try {
        const roiDec = calculateROI(new Decimal(adjustedValue), new Decimal(resolved.costUsd));
        roi = Number(roundTo(roiDec, 4));
      } catch {
        roi = null;
      }
    }

    const paybackResult = calculatePayback(cashFlows);
    const payback_months = paybackResult.fractionalPeriod
      ? Number(roundTo(paybackResult.fractionalPeriod.times(12), 1))
      : null;

    return {
      roi,
      npv: Number(roundTo(npv, 2)),
      payback_months,
    };
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  private async persistScenarios(scenarios: Scenario[]): Promise<void> {
    if (scenarios.length === 0) return;

    const { error } = await supabase.from("scenarios").insert(
      scenarios.map((s) => ({
        id: s.id,
        organization_id: s.organization_id,
        case_id: s.case_id,
        scenario_type: s.scenario_type,
        assumptions_snapshot_json: s.assumptions_snapshot_json,
        roi: s.roi,
        npv: s.npv,
        payback_months: s.payback_months,
        evf_decomposition_json: s.evf_decomposition_json,
        sensitivity_results_json: s.sensitivity_results_json,
        cost_input_usd: s.cost_input_usd,
        timeline_years: s.timeline_years,
        investment_source: s.investment_source,
        created_at: s.created_at,
        updated_at: s.updated_at,
      })),
    );

    if (error) {
      logger.error(`Failed to persist scenarios: ${error.message}`);
      throw new Error(`Failed to persist scenarios: ${error.message}`);
    }
  }
}
