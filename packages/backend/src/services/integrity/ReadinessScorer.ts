/**
 * ReadinessScorer
 *
 * Computes composite readiness score for value cases based on:
 * - Assumption validation rate
 * - Mean evidence grounding score
 * - Benchmark coverage percentage
 * - Unsupported assumption count
 *
 * Score >= 0.8 → presentation-ready
 * Score < 0.6 → identify specific blockers
 *
 * Reference: openspec/changes/trust-layer-completion/tasks.md §1
 */

import { z } from "zod";
import { logger } from "../lib/logger.js";
import { supabase } from "../lib/supabase.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const ReadinessScoreSchema = z.object({
  case_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  composite_score: z.number().min(0).max(1),
  is_presentation_ready: z.boolean(),
  validation_rate: z.number().min(0).max(1),
  mean_grounding_score: z.number().min(0).max(1),
  benchmark_coverage_pct: z.number().min(0).max(100),
  unsupported_assumption_count: z.number().int().min(0),
  blockers: z.array(z.object({
    type: z.enum(["validation", "grounding", "benchmark", "unsupported_assumption"]),
    description: z.string(),
    severity: z.enum(["critical", "warning"]),
  })),
  calculated_at: z.string().datetime(),
});

export type ReadinessScore = z.infer<typeof ReadinessScoreSchema>;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ReadinessScorer {
  private readonly PRESENTATION_READY_THRESHOLD = 0.8;
  private readonly BLOCKER_THRESHOLD = 0.6;

  /**
   * Calculate readiness score for a value case.
   */
  async calculateReadiness(caseId: string, tenantId: string): Promise<ReadinessScore> {
    logger.info(`Calculating readiness score for case ${caseId}`);

    // Fetch assumptions for the case
    const { data: assumptions, error: assumptionsError } = await supabase
      .from("assumptions")
      .select("id, source_type, confidence_score, benchmark_reference_id")
      .eq("case_id", caseId)
      .eq("tenant_id", tenantId);

    if (assumptionsError) {
      throw new Error(`Failed to fetch assumptions: ${assumptionsError.message}`);
    }

    // Calculate component scores
    const validationRate = this.calculateValidationRate(assumptions || []);
    const meanGroundingScore = this.calculateMeanGroundingScore(assumptions || []);
    const benchmarkCoveragePct = this.calculateBenchmarkCoverage(assumptions || []);
    const unsupportedCount = this.countUnsupportedAssumptions(assumptions || []);

    // Calculate composite score (weighted average)
    const compositeScore = this.calculateCompositeScore({
      validationRate,
      meanGroundingScore,
      benchmarkCoveragePct,
      unsupportedCount,
      totalAssumptions: (assumptions || []).length,
    });

    // Identify blockers
    const blockers = this.identifyBlockers({
      validationRate,
      meanGroundingScore,
      benchmarkCoveragePct,
      unsupportedCount,
      compositeScore,
    });

    const result: ReadinessScore = {
      case_id: caseId,
      tenant_id: tenantId,
      composite_score: Math.round(compositeScore * 10000) / 10000,
      is_presentation_ready: compositeScore >= this.PRESENTATION_READY_THRESHOLD,
      validation_rate: Math.round(validationRate * 10000) / 10000,
      mean_grounding_score: Math.round(meanGroundingScore * 10000) / 10000,
      benchmark_coverage_pct: Math.round(benchmarkCoveragePct * 100) / 100,
      unsupported_assumption_count: unsupportedCount,
      blockers,
      calculated_at: new Date().toISOString(),
    };

    // Persist score
    await this.persistReadinessScore(result);

    logger.info(`Readiness score calculated for case ${caseId}: ${result.composite_score}`);

    return result;
  }

  /**
   * Calculate validation rate (assumptions with customer-confirmed or high-confidence sources).
   */
  private calculateValidationRate(
    assumptions: Array<{ source_type: string; confidence_score: number }>,
  ): number {
    if (assumptions.length === 0) return 0;

    const validated = assumptions.filter(
      (a) =>
        a.source_type === "customer-confirmed" ||
        a.source_type === "manually-overridden" ||
        a.confidence_score >= 0.7,
    );

    return validated.length / assumptions.length;
  }

  /**
   * Calculate mean evidence grounding score.
   */
  private calculateMeanGroundingScore(
    assumptions: Array<{ confidence_score: number }>,
  ): number {
    if (assumptions.length === 0) return 0;

    const total = assumptions.reduce((sum, a) => sum + (a.confidence_score || 0), 0);
    return total / assumptions.length;
  }

  /**
   * Calculate benchmark coverage percentage.
   */
  private calculateBenchmarkCoverage(
    assumptions: Array<{ benchmark_reference_id: string | null }>,
  ): number {
    if (assumptions.length === 0) return 0;

    const withBenchmark = assumptions.filter((a) => a.benchmark_reference_id !== null);
    return (withBenchmark.length / assumptions.length) * 100;
  }

  /**
   * Count unsupported assumptions (no evidence, no benchmark).
   */
  private countUnsupportedAssumptions(
    assumptions: Array<{ source_type: string; benchmark_reference_id: string | null; confidence_score: number }>,
  ): number {
    return assumptions.filter(
      (a) =>
        a.source_type === "inferred" &&
        a.benchmark_reference_id === null &&
        a.confidence_score < 0.5,
    ).length;
  }

  /**
   * Calculate weighted composite score.
   */
  private calculateCompositeScore(params: {
    validationRate: number;
    meanGroundingScore: number;
    benchmarkCoveragePct: number;
    unsupportedCount: number;
    totalAssumptions: number;
  }): number {
    const {
      validationRate,
      meanGroundingScore,
      benchmarkCoveragePct,
      unsupportedCount,
      totalAssumptions,
    } = params;

    // Weights
    const wValidation = 0.3;
    const wGrounding = 0.3;
    const wBenchmark = 0.2;
    const wUnsupported = 0.2;

    // Normalize benchmark coverage (0-100 → 0-1)
    const normalizedBenchmark = benchmarkCoveragePct / 100;

    // Calculate unsupported penalty (0-1, where 0 is no unsupported, 1 is all unsupported)
    const unsupportedPenalty =
      totalAssumptions > 0 ? unsupportedCount / totalAssumptions : 0;

    // Weighted sum
    const score =
      validationRate * wValidation +
      meanGroundingScore * wGrounding +
      normalizedBenchmark * wBenchmark +
      (1 - unsupportedPenalty) * wUnsupported;

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Identify specific readiness blockers.
   */
  private identifyBlockers(params: {
    validationRate: number;
    meanGroundingScore: number;
    benchmarkCoveragePct: number;
    unsupportedCount: number;
    compositeScore: number;
  }): Array<{ type: "validation" | "grounding" | "benchmark" | "unsupported_assumption"; description: string; severity: "critical" | "warning" }> {
    const blockers: Array<{ type: "validation" | "grounding" | "benchmark" | "unsupported_assumption"; description: string; severity: "critical" | "warning" }> = [];

    if (params.validationRate < 0.8) {
      blockers.push({
        type: "validation",
        description: `Validation rate ${(params.validationRate * 100).toFixed(1)}% below 80% threshold`,
        severity: params.validationRate < 0.6 ? "critical" : "warning",
      });
    }

    if (params.meanGroundingScore < 0.8) {
      blockers.push({
        type: "grounding",
        description: `Mean grounding score ${params.meanGroundingScore.toFixed(2)} below 0.8 threshold`,
        severity: params.meanGroundingScore < 0.4 ? "critical" : "warning",
      });
    }

    if (params.unsupportedCount > 0) {
      blockers.push({
        type: "unsupported_assumption",
        description: `${params.unsupportedCount} unsupported assumption(s) require evidence or benchmark reference`,
        severity: params.unsupportedCount > 3 ? "critical" : "warning",
      });
    }

    return blockers;
  }

  /**
   * Persist readiness score to database.
   */
  private async persistReadinessScore(score: ReadinessScore): Promise<void> {
    const { error } = await supabase.from("case_readiness_scores").upsert({
      case_id: score.case_id,
      tenant_id: score.tenant_id,
      composite_score: score.composite_score,
      is_presentation_ready: score.is_presentation_ready,
      validation_rate: score.validation_rate,
      mean_grounding_score: score.mean_grounding_score,
      benchmark_coverage_pct: score.benchmark_coverage_pct,
      unsupported_assumption_count: score.unsupported_assumption_count,
      blockers_json: score.blockers,
      calculated_at: score.calculated_at,
    }, { onConflict: "case_id" });

    if (error) {
      logger.error(`Failed to persist readiness score: ${error.message}`);
      throw new Error(`Failed to persist readiness score: ${error.message}`);
    }
  }
}
