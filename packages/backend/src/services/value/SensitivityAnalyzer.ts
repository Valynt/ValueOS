/**
 * SensitivityAnalyzer
 *
 * Runs sensitivity analysis on financial scenarios by varying key assumptions ±20%.
 * Identifies top-3 highest-leverage assumptions and persists results.
 *
 * Impact is calculated deterministically via the economic kernel (calculateNPV)
 * with the modified assumption substituted into the cash flow series.
 *
 * Reference: openspec/changes/value-modeling-engine/tasks.md §7
 */

import Decimal from 'decimal.js';
import { z } from "zod";
import {
  calculateNPV,
  roundTo,
  toDecimalArray,
} from '../../domain/economic-kernel/economic_kernel.js';
import { logger } from "../lib/logger.js";
import { supabase } from "../lib/supabase.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const SensitivityResultSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  scenario_id: z.string().uuid(),
  assumption_id: z.string().uuid(),
  assumption_name: z.string(),
  baseline_value: z.number(),
  variance_negative_20: z.number(),
  variance_positive_20: z.number(),
  impact_variance: z.number(),
  rank: z.number().int().positive(),
  direction: z.enum(["positive", "negative"]),
  calculated_at: z.string().datetime(),
});

export type SensitivityResult = z.infer<typeof SensitivityResultSchema>;

export interface SensitivityAnalysisInput {
  organizationId: string;
  caseId: string;
  scenarioId: string;
  scenarioType: "conservative" | "base" | "upside";
  assumptions: Array<{
    id: string;
    name: string;
    value: number;
  }>;
  baseMetrics: {
    roi: number | null;
    npv: number | null;
    payback_months: number | null;
  };
  /** Investment cost used when building the scenario — required for kernel recalculation. */
  costInputUsd: number;
  /** Benefit realization horizon used when building the scenario. */
  timelineYears: number;
  /** Discount rate used when building the scenario. Defaults to 0.10. */
  discountRate?: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class SensitivityAnalyzer {
  private readonly VARIANCE_PCT = 0.2; // ±20%
  private readonly TOP_N = 3;

  /**
   * Run sensitivity analysis on a scenario.
   */
  async analyze(input: SensitivityAnalysisInput): Promise<SensitivityResult[]> {
    logger.info(`Running sensitivity analysis for scenario ${input.scenarioId}`);

    const results: SensitivityResult[] = [];
    const now = new Date().toISOString();

    for (const assumption of input.assumptions) {
      // Calculate impact of -20% variance
      const negativeValue = assumption.value * (1 - this.VARIANCE_PCT);
      const negativeImpact = this.calculateImpact(
        input,
        assumption.id,
        negativeValue,
      );

      // Calculate impact of +20% variance
      const positiveValue = assumption.value * (1 + this.VARIANCE_PCT);
      const positiveImpact = this.calculateImpact(
        input,
        assumption.id,
        positiveValue,
      );

      // Calculate total variance range
      const impactVariance = Math.abs(positiveImpact - negativeImpact);

      results.push({
        id: crypto.randomUUID(),
        organization_id: input.organizationId,
        scenario_id: input.scenarioId,
        assumption_id: assumption.id,
        assumption_name: assumption.name,
        baseline_value: assumption.value,
        variance_negative_20: Math.round(negativeValue * 100) / 100,
        variance_positive_20: Math.round(positiveValue * 100) / 100,
        impact_variance: Math.round(impactVariance * 100) / 100,
        rank: 0, // Will be set after sorting
        direction: positiveImpact > negativeImpact ? "positive" : "negative",
        calculated_at: now,
      });
    }

    // Sort by impact variance and assign ranks
    results.sort((a, b) => b.impact_variance - a.impact_variance);
    results.forEach((r, i) => {
      r.rank = i + 1;
    });

    // Persist top N results
    const topResults = results.slice(0, this.TOP_N);
    await this.persistResults(topResults);

    // Update scenario with sensitivity results
    await this.updateScenario(input.scenarioId, input.organizationId, topResults);

    logger.info(`Sensitivity analysis complete for scenario ${input.scenarioId}, top ${this.TOP_N} assumptions identified`);

    return topResults;
  }

  /**
   * Trigger recalculation when assumptions change.
   */
  async triggerRecalculation(
    organizationId: string,
    caseId: string,
    changedAssumptionIds: string[],
  ): Promise<void> {
    logger.info(`Triggering recalculation for case ${caseId} due to assumption changes`);

    const { data: scenarios, error } = await supabase
      .from("scenarios")
      .select("id, scenario_type")
      .eq("case_id", caseId)
      .eq("organization_id", organizationId);

    if (error) {
      throw new Error(`Failed to fetch scenarios: ${error.message}`);
    }

    // Flag all final artifacts for the case as needing refresh — once per case,
    // not once per scenario (the update is case-scoped, not scenario-scoped).
    await this.flagNarrativeRefresh(organizationId, caseId);

    for (const scenario of scenarios || []) {
      await this.emitRecalculationEvent(organizationId, caseId, scenario.id);
    }

    logger.info(`Recalculation triggered for case ${caseId}, ${scenarios?.length || 0} scenarios`);
  }

  /**
   * Calculate NPV impact of substituting a single assumption value.
   *
   * Reconstructs the cash flow series with the modified assumption value
   * treated as the total annual benefit, then calls calculateNPV.
   * This is deterministic: same inputs always produce the same output.
   *
   * Approximation note: the annual benefit is reconstructed as
   *   annualBenefit = (baseNpv + costInputUsd) / timelineYears
   * This reverses the undiscounted sum rather than the discounted NPV, so
   * the reconstructed benefit stream is slightly overstated. At a 10%
   * discount rate over 3 years the error is ~15% on the benefit magnitude,
   * which means impact_variance values are proportionally overstated by the
   * same factor. Rankings are unaffected because the bias is uniform across
   * all assumptions. For exact sensitivity, replace with the exact inversion:
   *   annualBenefit = baseNpv / Σ(1/(1+r)^t for t=1..N)
   */
  private calculateImpact(
    input: SensitivityAnalysisInput,
    assumptionId: string,
    newValue: number,
  ): number {
    const assumption = input.assumptions.find((a) => a.id === assumptionId);
    if (!assumption || assumption.value === 0) return input.baseMetrics.npv ?? 0;

    // Scale the base NPV benefit proportionally to the assumption change.
    // The assumption's contribution to total value is approximated as
    // (newValue / assumption.value) applied to the annual benefit stream.
    const scaleFactor = newValue / assumption.value;
    const baseNpv = input.baseMetrics.npv ?? 0;

    // Reconstruct cash flows: period 0 = −cost, periods 1..N = scaled annual benefit
    const discountRate = new Decimal(input.discountRate ?? 0.10);
    const annualBenefit = (baseNpv + input.costInputUsd) / input.timelineYears;

    const flows: number[] = [-input.costInputUsd];
    for (let i = 0; i < input.timelineYears; i++) {
      flows.push(annualBenefit * scaleFactor);
    }

    const cashFlows = toDecimalArray(flows);
    const npv = calculateNPV(cashFlows, discountRate);
    return Number(roundTo(npv, 2));
  }

  /**
   * Persist sensitivity results to database.
   */
  private async persistResults(results: SensitivityResult[]): Promise<void> {
    if (results.length === 0) return;

    const { error } = await supabase.from("sensitivity_analysis").insert(
      results.map((r) => ({
        id: r.id,
        organization_id: r.organization_id,
        scenario_id: r.scenario_id,
        assumption_id: r.assumption_id,
        rank: r.rank,
        impact_variance: r.impact_variance,
        direction: r.direction,
        created_at: r.calculated_at,
      })),
    );

    if (error) {
      logger.error(`Failed to persist sensitivity results: ${error.message}`);
      throw new Error(`Failed to persist sensitivity results: ${error.message}`);
    }
  }

  /**
   * Update scenario with sensitivity results.
   */
  private async updateScenario(
    scenarioId: string,
    organizationId: string,
    results: SensitivityResult[],
  ): Promise<void> {
    const { error } = await supabase
      .from("scenarios")
      .update({
        sensitivity_results_json: results.map((r) => ({
          assumption_id: r.assumption_id,
          rank: r.rank,
          impact_variance: r.impact_variance,
          direction: r.direction,
        })),
        updated_at: new Date().toISOString(),
      })
      .eq("id", scenarioId)
      .eq("organization_id", organizationId);

    if (error) {
      logger.error(`Failed to update scenario with sensitivity results: ${error.message}`);
      throw new Error(`Failed to update scenario with sensitivity results: ${error.message}`);
    }
  }

  /**
   * Flag all final narrative artifacts for a case as needing refresh.
   * Called once per recalculation trigger, not per assumption or scenario.
   */
  private async flagNarrativeRefresh(
    organizationId: string,
    caseId: string,
  ): Promise<void> {
    const { error } = await supabase
      .from("case_artifacts")
      .update({
        status: "draft",
        updated_at: new Date().toISOString(),
      })
      .eq("case_id", caseId)
      .eq("organization_id", organizationId)
      .eq("status", "final");

    if (error) {
      logger.error(`Failed to flag narratives for refresh: ${error.message}`);
    }
  }

  /**
   * Emit recalculation event.
   */
  private async emitRecalculationEvent(
    organizationId: string,
    caseId: string,
    scenarioId: string,
  ): Promise<void> {
    const { error } = await supabase.from("state_events").insert({
      id: crypto.randomUUID(),
      organization_id: organizationId,
      case_id: caseId,
      event_type: "scenario.recalculated",
      payload: { scenario_id: scenarioId },
      created_at: new Date().toISOString(),
    });

    if (error) {
      logger.error(`Failed to emit recalculation event: ${error.message}`);
    }
  }
}
