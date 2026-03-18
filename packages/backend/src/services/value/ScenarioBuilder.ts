/**
 * ScenarioBuilder
 *
 * Builds three financial scenarios (conservative, base, upside) from
 * accepted value hypotheses and assumptions. Uses economic kernel for
 * all calculations (no LLM math).
 *
 * Reference: openspec/changes/value-modeling-engine/tasks.md §6
 */

import { z } from "zod";
import { logger } from "../lib/logger.js";
import { supabase } from "../lib/supabase.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const ScenarioSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
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
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Scenario = z.infer<typeof ScenarioSchema>;

export interface ScenarioBuildInput {
  tenantId: string;
  caseId: string;
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
}

export interface ScenarioBuildResult {
  conservative: Scenario;
  base: Scenario;
  upside: Scenario;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ScenarioBuilder {
  /**
   * Build three scenarios from accepted hypotheses.
   */
  async buildScenarios(input: ScenarioBuildInput): Promise<ScenarioBuildResult> {
    logger.info(`Building financial scenarios for case ${input.caseId}`);

    const now = new Date().toISOString();
    const baseId = crypto.randomUUID();

    // Build assumptions snapshot for each scenario type
    const conservativeAssumptions = this.buildAssumptionSnapshot(input.assumptions, "p25");
    const baseAssumptions = this.buildAssumptionSnapshot(input.assumptions, "p50");
    const upsideAssumptions = this.buildAssumptionSnapshot(input.assumptions, "p75");

    // Calculate EVF decomposition for each scenario
    const conservativeEvf = this.calculateEvfDecomposition(input.acceptedHypotheses, "p25");
    const baseEvf = this.calculateEvfDecomposition(input.acceptedHypotheses, "p50");
    const upsideEvf = this.calculateEvfDecomposition(input.acceptedHypotheses, "p75");

    // Calculate financial metrics using economic kernel
    const conservativeMetrics = await this.callEconomicKernel(conservativeEvf, conservativeAssumptions, "conservative");
    const baseMetrics = await this.callEconomicKernel(baseEvf, baseAssumptions, "base");
    const upsideMetrics = await this.callEconomicKernel(upsideEvf, upsideAssumptions, "upside");

    const conservative: Scenario = {
      id: crypto.randomUUID(),
      tenant_id: input.tenantId,
      case_id: input.caseId,
      scenario_type: "conservative",
      assumptions_snapshot_json: conservativeAssumptions,
      roi: conservativeMetrics.roi,
      npv: conservativeMetrics.npv,
      payback_months: conservativeMetrics.payback_months,
      evf_decomposition_json: conservativeEvf,
      sensitivity_results_json: [],
      created_at: now,
      updated_at: now,
    };

    const base: Scenario = {
      id: baseId,
      tenant_id: input.tenantId,
      case_id: input.caseId,
      scenario_type: "base",
      assumptions_snapshot_json: baseAssumptions,
      roi: baseMetrics.roi,
      npv: baseMetrics.npv,
      payback_months: baseMetrics.payback_months,
      evf_decomposition_json: baseEvf,
      sensitivity_results_json: [],
      created_at: now,
      updated_at: now,
    };

    const upside: Scenario = {
      id: crypto.randomUUID(),
      tenant_id: input.tenantId,
      case_id: input.caseId,
      scenario_type: "upside",
      assumptions_snapshot_json: upsideAssumptions,
      roi: upsideMetrics.roi,
      npv: upsideMetrics.npv,
      payback_months: upsideMetrics.payback_months,
      evf_decomposition_json: upsideEvf,
      sensitivity_results_json: [],
      created_at: now,
      updated_at: now,
    };

    // Persist scenarios
    await this.persistScenarios([conservative, base, upside]);

    logger.info(`Scenario building complete for case ${input.caseId}: conservative, base, upside`);

    return { conservative, base, upside };
  }

  /**
   * Build assumptions snapshot with percentile adjustments.
   */
  private buildAssumptionSnapshot(
    assumptions: Array<{ id: string; name: string; value: number; source_type: string }>,
    percentile: "p25" | "p50" | "p75",
  ): Record<string, unknown> {
    const snapshot: Record<string, unknown> = {};

    for (const assumption of assumptions) {
      // Apply percentile multiplier
      const multiplier = percentile === "p25" ? 0.8 : percentile === "p75" ? 1.2 : 1.0;
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

  /**
   * Calculate Economic Value Framework decomposition.
   */
  private calculateEvfDecomposition(
    hypotheses: Array<{ value_driver: string; estimated_impact_min: number; estimated_impact_max: number }>,
    percentile: "p25" | "p50" | "p75",
  ): { revenue_uplift: number; cost_reduction: number; risk_mitigation: number; efficiency_gain: number } {
    const multiplier = percentile === "p25" ? 0.7 : percentile === "p75" ? 1.3 : 1.0;

    let revenue_uplift = 0;
    let cost_reduction = 0;
    let risk_mitigation = 0;
    let efficiency_gain = 0;

    for (const hypothesis of hypotheses) {
      const impact = ((hypothesis.estimated_impact_min + hypothesis.estimated_impact_max) / 2) * multiplier;

      // Categorize by driver type (simplified classification)
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

  /**
   * Call economic kernel for deterministic financial calculations.
   */
  private async callEconomicKernel(
    evf: { revenue_uplift: number; cost_reduction: number; risk_mitigation: number; efficiency_gain: number },
    assumptions: Record<string, unknown>,
    scenarioType: string,
  ): Promise<{ roi: number | null; npv: number | null; payback_months: number | null }> {
    // In production, this calls the actual economic kernel service
    // For now, implement simplified calculations

    const totalValue = evf.revenue_uplift + evf.cost_reduction + evf.risk_mitigation + evf.efficiency_gain;

    // Estimate investment based on scenario type
    const investmentMultiplier = scenarioType === "conservative" ? 0.5 : scenarioType === "upside" ? 2.0 : 1.0;
    const estimatedInvestment = totalValue * 0.3 * investmentMultiplier;

    // Calculate ROI
    const roi = estimatedInvestment > 0 ? ((totalValue - estimatedInvestment) / estimatedInvestment) * 100 : null;

    // Calculate NPV (simplified: 3-year horizon, 10% discount)
    const discountRate = 0.1;
    const annualBenefit = totalValue / 3;
    let npv = -estimatedInvestment;
    for (let year = 1; year <= 3; year++) {
      npv += annualBenefit / Math.pow(1 + discountRate, year);
    }

    // Calculate payback in months
    const monthlyBenefit = annualBenefit / 12;
    const payback_months = monthlyBenefit > 0 ? estimatedInvestment / monthlyBenefit : null;

    return {
      roi: roi ? Math.round(roi * 100) / 100 : null,
      npv: Math.round(npv * 100) / 100,
      payback_months: payback_months ? Math.round(payback_months * 10) / 10 : null,
    };
  }

  /**
   * Persist scenarios to database.
   */
  private async persistScenarios(scenarios: Scenario[]): Promise<void> {
    if (scenarios.length === 0) return;

    const { error } = await supabase.from("scenarios").insert(
      scenarios.map((s) => ({
        id: s.id,
        tenant_id: s.tenant_id,
        case_id: s.case_id,
        scenario_type: s.scenario_type,
        assumptions_snapshot_json: s.assumptions_snapshot_json,
        roi: s.roi,
        npv: s.npv,
        payback_months: s.payback_months,
        evf_decomposition_json: s.evf_decomposition_json,
        sensitivity_results_json: s.sensitivity_results_json,
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
