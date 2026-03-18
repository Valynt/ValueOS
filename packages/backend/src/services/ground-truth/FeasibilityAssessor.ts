/**
 * FeasibilityAssessor
 *
 * Assesses whether a proposed KPI improvement is achievable, stretch, or unrealistic
 * based on historical improvement ranges and benchmark data.
 *
 * Reference: openspec/changes/ground-truth-integration/tasks.md §7
 */

import { z } from "zod";

import { logger } from "../../lib/logger.js";
import { benchmarkRetrievalService } from "./BenchmarkRetrievalService.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const FeasibilityClassificationSchema = z.enum(["achievable", "stretch", "unrealistic"]);

export const FeasibilityAssessmentSchema = z.object({
  metric: z.string(),
  currentValue: z.number(),
  proposedValue: z.number(),
  classification: FeasibilityClassificationSchema,
  improvementPercentage: z.number(),
  historicalContext: z.object({
    typicalRange: z.tuple([z.number(), z.number()]), // [min, max] typical improvement
    industryMedianImprovement: z.number(),
    comparableCases: z.number(), // Number of similar historical cases
  }),
  benchmarkReference: z.object({
    targetPercentile: z.enum(["p25", "p50", "p75", "p90"]),
    benchmarkValue: z.number(),
    source: z.string(),
  }).optional(),
  rationale: z.string(),
  confidence: z.number(),
  recommendedTarget: z.number(), // Suggested more realistic target if unrealistic
});

export type FeasibilityClassification = z.infer<typeof FeasibilityClassificationSchema>;
export type FeasibilityAssessment = z.infer<typeof FeasibilityAssessmentSchema>;

export interface FeasibilityInput {
  metric: string;
  currentValue: number;
  proposedValue: number;
  unit?: string;
  industry?: string;
  companySize?: "small" | "medium" | "large" | "enterprise";
  timeframeMonths?: number; // Expected time to achieve improvement
}

// ---------------------------------------------------------------------------
// Improvement Ranges by Metric Type
// ---------------------------------------------------------------------------

const TYPICAL_IMPROVEMENT_RANGES: Record<string, { min: number; max: number; typical: number }> = {
  // Revenue growth - typically 5-20% annually
  revenue: { min: 0.05, max: 0.25, typical: 0.12 },
  revenue_growth: { min: 0.05, max: 0.25, typical: 0.12 },

  // Cost reduction - typically 10-30%
  cost_reduction: { min: 0.08, max: 0.35, typical: 0.15 },
  operating_costs: { min: 0.08, max: 0.35, typical: 0.15 },

  // Margin improvements - typically 2-8 points
  operating_margin: { min: 0.02, max: 0.10, typical: 0.05 },
  gross_margin: { min: 0.02, max: 0.08, typical: 0.04 },

  // Efficiency metrics - typically 15-40%
  efficiency: { min: 0.10, max: 0.45, typical: 0.25 },
  productivity: { min: 0.10, max: 0.40, typical: 0.20 },

  // Quality metrics - typically 20-50%
  quality_score: { min: 0.15, max: 0.50, typical: 0.30 },
  defect_rate: { min: 0.20, max: 0.60, typical: 0.35 },

  // Time-based metrics - typically 20-60%
  cycle_time: { min: 0.15, max: 0.55, typical: 0.30 },
  lead_time: { min: 0.15, max: 0.50, typical: 0.25 },

  // Employee metrics - typically 10-25%
  employee_satisfaction: { min: 0.08, max: 0.25, typical: 0.15 },
  retention_rate: { min: 0.05, max: 0.20, typical: 0.10 },

  // Default for unknown metrics
  default: { min: 0.10, max: 0.30, typical: 0.18 },
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class FeasibilityAssessor {
  private static instance: FeasibilityAssessor;

  private constructor() {}

  static getInstance(): FeasibilityAssessor {
    if (!FeasibilityAssessor.instance) {
      FeasibilityAssessor.instance = new FeasibilityAssessor();
    }
    return FeasibilityAssessor.instance;
  }

  /**
   * Assess feasibility of a proposed KPI improvement
   */
  async assess(input: FeasibilityInput): Promise<FeasibilityAssessment> {
    const improvement = (input.proposedValue - input.currentValue) / input.currentValue;
    const absoluteImprovement = Math.abs(improvement);

    // Get typical range for this metric
    const range = this.getImprovementRange(input.metric);

    // Get benchmark reference if industry provided
    let benchmarkRef: FeasibilityAssessment["benchmarkReference"] | undefined;
    if (input.industry) {
      benchmarkRef = await this.getBenchmarkReference(input);
    }

    // Classify based on improvement percentage vs typical range
    let classification: FeasibilityClassification;
    let rationale: string;
    let confidence: number;
    let recommendedTarget: number;

    if (absoluteImprovement <= range.typical * 1.2) {
      // Within typical range - achievable
      classification = "achievable";
      rationale = this.buildAchievableRationale(input, improvement, range);
      confidence = 0.85;
      recommendedTarget = input.proposedValue;
    } else if (absoluteImprovement <= range.max * 1.3) {
      // Within stretch range
      classification = "stretch";
      rationale = this.buildStretchRationale(input, improvement, range);
      confidence = 0.65;
      // Recommend a more conservative target
      recommendedTarget = input.currentValue * (1 + range.typical);
    } else {
      // Beyond typical maximum - unrealistic
      classification = "unrealistic";
      rationale = this.buildUnrealisticRationale(input, improvement, range);
      confidence = 0.40;
      // Recommend target at 75% of typical max
      recommendedTarget = input.currentValue * (1 + range.max * 0.75);
    }

    // Adjust for timeframe if provided (shorter timeframes make it harder)
    if (input.timeframeMonths && input.timeframeMonths < 12) {
      if (classification === "achievable" && absoluteImprovement > range.typical * 0.8) {
        classification = "stretch";
        rationale += ` The ${input.timeframeMonths}-month timeframe makes this more challenging.`;
        confidence *= 0.85;
      } else if (classification === "stretch") {
        classification = "unrealistic";
        rationale += ` The aggressive ${input.timeframeMonths}-month timeframe is unrealistic for this magnitude of change.`;
        confidence *= 0.75;
      }
    }

    // Include benchmark context in rationale if available
    if (benchmarkRef) {
      rationale += ` Industry benchmark at ${benchmarkRef.targetPercentile} is ${benchmarkRef.benchmarkValue} (${benchmarkRef.source}).`;
    }

    return {
      metric: input.metric,
      currentValue: input.currentValue,
      proposedValue: input.proposedValue,
      classification,
      improvementPercentage: improvement * 100,
      historicalContext: {
        typicalRange: [range.min * 100, range.max * 100],
        industryMedianImprovement: range.typical * 100,
        comparableCases: this.estimateComparableCases(input.metric),
      },
      benchmarkReference: benchmarkRef,
      rationale,
      confidence,
      recommendedTarget,
    };
  }

  /**
   * Batch assess multiple KPI improvements
   */
  async assessBatch(inputs: FeasibilityInput[]): Promise<FeasibilityAssessment[]> {
    return Promise.all(inputs.map((input) => this.assess(input)));
  }

  /**
   * Get aggregate feasibility score for a set of improvements
   */
  async getAggregateScore(inputs: FeasibilityInput[]): Promise<{
    overallFeasibility: FeasibilityClassification;
    averageConfidence: number;
    unrealisticCount: number;
    assessments: FeasibilityAssessment[];
  }> {
    const assessments = await this.assessBatch(inputs);

    const unrealisticCount = assessments.filter((a) => a.classification === "unrealistic").length;
    const stretchCount = assessments.filter((a) => a.classification === "stretch").length;

    let overallFeasibility: FeasibilityClassification;
    if (unrealisticCount > 0) {
      overallFeasibility = "unrealistic";
    } else if (stretchCount > inputs.length / 2) {
      overallFeasibility = "stretch";
    } else {
      overallFeasibility = "achievable";
    }

    const averageConfidence = assessments.reduce((sum, a) => sum + a.confidence, 0) / assessments.length;

    return {
      overallFeasibility,
      averageConfidence,
      unrealisticCount,
      assessments,
    };
  }

  // -------------------------------------------------------------------------
  // Private methods
  // -------------------------------------------------------------------------

  private getImprovementRange(metric: string): { min: number; max: number; typical: number } {
    const normalizedMetric = metric.toLowerCase().replace(/\s+/g, "_");

    // Try exact match
    if (TYPICAL_IMPROVEMENT_RANGES[normalizedMetric]) {
      return TYPICAL_IMPROVEMENT_RANGES[normalizedMetric];
    }

    // Try partial match
    for (const [key, range] of Object.entries(TYPICAL_IMPROVEMENT_RANGES)) {
      if (normalizedMetric.includes(key) || key.includes(normalizedMetric)) {
        return range;
      }
    }

    return TYPICAL_IMPROVEMENT_RANGES.default;
  }

  private async getBenchmarkReference(
    input: FeasibilityInput
  ): Promise<FeasibilityAssessment["benchmarkReference"] | undefined> {
    if (!input.industry) return undefined;

    try {
      const benchmark = await benchmarkRetrievalService.retrieveBenchmark({
        industry: input.industry,
        kpi: input.metric.toLowerCase(),
        companySize: input.companySize,
      });

      if (!benchmark) return undefined;

      // Determine which percentile the proposed value falls into
      const { p25, p50, p75, p90 } = benchmark.distribution;
      const proposed = input.proposedValue;

      let targetPercentile: "p25" | "p50" | "p75" | "p90";
      if (proposed <= p25) targetPercentile = "p25";
      else if (proposed <= p50) targetPercentile = "p50";
      else if (proposed <= p75) targetPercentile = "p75";
      else targetPercentile = "p90";

      return {
        targetPercentile,
        benchmarkValue: benchmark.distribution[targetPercentile],
        source: benchmark.source,
      };
    } catch (error) {
      logger.warn("Failed to get benchmark reference for feasibility assessment", {
        metric: input.metric,
        industry: input.industry,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  private estimateComparableCases(metric: string): number {
    // In a real implementation, this would query historical database
    // Return estimated number of comparable cases based on metric type
    const ranges: Record<string, number> = {
      revenue: 1250,
      revenue_growth: 980,
      cost_reduction: 2100,
      operating_margin: 850,
      efficiency: 1540,
      productivity: 1200,
    };

    return ranges[metric.toLowerCase()] || 500;
  }

  private buildAchievableRationale(
    input: FeasibilityInput,
    improvement: number,
    range: { min: number; max: number; typical: number }
  ): string {
    const direction = improvement > 0 ? "increase" : "decrease";
    const absImprovement = Math.abs(improvement * 100).toFixed(1);
    return `The proposed ${absImprovement}% ${direction} in ${input.metric} is within typical improvement ranges (${(range.min * 100).toFixed(0)}%-${(range.max * 100).toFixed(0)}%). Based on historical data, this is achievable with standard implementation efforts.`;
  }

  private buildStretchRationale(
    input: FeasibilityInput,
    improvement: number,
    range: { min: number; max: number; typical: number }
  ): string {
    const direction = improvement > 0 ? "increase" : "decrease";
    const absImprovement = Math.abs(improvement * 100).toFixed(1);
    return `The proposed ${absImprovement}% ${direction} in ${input.metric} is ambitious. While possible, it exceeds typical improvements (${(range.typical * 100).toFixed(0)}%) and will require significant effort, resources, and potentially favorable market conditions.`;
  }

  private buildUnrealisticRationale(
    input: FeasibilityInput,
    improvement: number,
    range: { min: number; max: number; typical: number }
  ): string {
    const direction = improvement > 0 ? "increase" : "decrease";
    const absImprovement = Math.abs(improvement * 100).toFixed(1);
    return `The proposed ${absImprovement}% ${direction} in ${input.metric} exceeds typical maximum improvements (${(range.max * 100).toFixed(0)}%). Historical data suggests this magnitude of change is rarely achieved and may indicate an error in estimation or an overly optimistic projection.`;
  }
}

// Singleton export
export const feasibilityAssessor = FeasibilityAssessor.getInstance();
