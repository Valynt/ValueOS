/**
 * HypothesisGenerator
 *
 * Generates value hypotheses from deal context with extracted value driver candidates.
 * Validates against benchmark ranges and assigns confidence scores.
 *
 * Reference: openspec/changes/value-modeling-engine/tasks.md §2
 */

import { z } from "zod";
import { logger } from "../lib/logger.js";
import { supabase } from "../lib/supabase.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const ValueHypothesisSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  case_id: z.string().uuid(),
  value_driver: z.string().min(1).max(255),
  description: z.string().max(1000),
  estimated_impact_min: z.number(),
  estimated_impact_max: z.number(),
  impact_unit: z.string().max(50),
  evidence_tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  confidence_score: z.number().min(0).max(1),
  benchmark_reference_id: z.string().uuid().optional(),
  status: z.enum(["pending", "accepted", "rejected", "modified"]),
  source_context_ids: z.array(z.string().uuid()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ValueHypothesis = z.infer<typeof ValueHypothesisSchema>;

export interface HypothesisGenerationInput {
  tenantId: string;
  caseId: string;
  dealContextId: string;
  valueDriverCandidates: Array<{
    id: string;
    name: string;
    description: string;
    signal_strength: number;
    evidence_count: number;
    suggested_kpi?: string;
  }>;
  industry?: string;
  companySize?: string;
}

export interface HypothesisGenerationResult {
  hypotheses: ValueHypothesis[];
  rejectedCount: number;
  flags: string[];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class HypothesisGenerator {
  /**
   * Generate value hypotheses from deal context.
   */
  async generate(input: HypothesisGenerationInput): Promise<HypothesisGenerationResult> {
    logger.info(`Generating value hypotheses for case ${input.caseId}`);

    const hypotheses: ValueHypothesis[] = [];
    const flags: string[] = [];
    let rejectedCount = 0;

    for (const candidate of input.valueDriverCandidates) {
      // Skip low-signal candidates
      if (candidate.signal_strength < 0.3) {
        rejectedCount++;
        flags.push(`Low signal strength for ${candidate.name}: ${candidate.signal_strength}`);
        continue;
      }

      // Check against benchmark plausibility
      const benchmarkCheck = await this.checkBenchmarkPlausibility(
        input.tenantId,
        candidate.name,
        candidate.signal_strength,
        input.industry,
        input.companySize,
      );

      const now = new Date().toISOString();
      const evidenceTier = this.calculateEvidenceTier(candidate);
      const hypothesis: ValueHypothesis = {
        id: crypto.randomUUID(),
        tenant_id: input.tenantId,
        case_id: input.caseId,
        value_driver: candidate.name,
        description: candidate.description,
        estimated_impact_min: this.estimateImpactMin(candidate.signal_strength),
        estimated_impact_max: this.estimateImpactMax(candidate.signal_strength),
        impact_unit: candidate.suggested_kpi || "percent",
        evidence_tier: evidenceTier,
        confidence_score: this.calculateConfidence(candidate, benchmarkCheck.isPlausible),
        benchmark_reference_id: benchmarkCheck.benchmarkId,
        status: "pending",
        source_context_ids: [input.dealContextId],
        created_at: now,
        updated_at: now,
      };

      if (!benchmarkCheck.isPlausible) {
        flags.push(`Hypothesis ${candidate.name} flagged: outside benchmark range`);
      }

      hypotheses.push(hypothesis);
    }

    // Persist hypotheses
    await this.persistHypotheses(hypotheses);

    logger.info(`Generated ${hypotheses.length} hypotheses, rejected ${rejectedCount} for case ${input.caseId}`);

    return { hypotheses, rejectedCount, flags };
  }

  /**
   * Check if estimated impact is within plausible benchmark range.
   */
  private async checkBenchmarkPlausibility(
    tenantId: string,
    driverName: string,
    signalStrength: number,
    industry?: string,
    companySize?: string,
  ): Promise<{ isPlausible: boolean; benchmarkId?: string }> {
    // Query benchmarks from database
    const { data: benchmarks } = await supabase
      .from("benchmarks")
      .select("id, metric_name, p25, p75, industry, company_size_tier")
      .eq("tenant_id", tenantId)
      .ilike("metric_name", `%${driverName}%`)
      .limit(1);

    if (!benchmarks || benchmarks.length === 0) {
      // No benchmark found - assume plausible with warning
      return { isPlausible: true };
    }

    const benchmark = benchmarks[0];

    // Simple plausibility check against p25-p75 range
    const estimatedImpact = this.estimateImpactMax(signalStrength);
    const isPlausible = estimatedImpact >= benchmark.p25 && estimatedImpact <= benchmark.p75;

    return { isPlausible, benchmarkId: benchmark.id };
  }

  /**
   * Calculate evidence tier based on signal source quality.
   */
  private calculateEvidenceTier(candidate: { signal_strength: number; evidence_count: number }): 1 | 2 | 3 {
    if (candidate.signal_strength >= 0.8 && candidate.evidence_count >= 3) return 1;
    if (candidate.signal_strength >= 0.5 && candidate.evidence_count >= 2) return 2;
    return 3;
  }

  /**
   * Calculate confidence score based on signal strength and plausibility.
   */
  private calculateConfidence(candidate: { signal_strength: number }, isPlausible: boolean): number {
    let confidence = candidate.signal_strength;
    if (!isPlausible) confidence *= 0.7; // Penalty for implausible range
    return Math.min(0.95, Math.max(0.3, confidence));
  }

  private estimateImpactMin(signalStrength: number): number {
    return Math.round(signalStrength * 5); // 5-50% range
  }

  private estimateImpactMax(signalStrength: number): number {
    return Math.round(signalStrength * 15 + 10); // 10-85% range
  }

  /**
   * Persist generated hypotheses to database.
   */
  private async persistHypotheses(hypotheses: ValueHypothesis[]): Promise<void> {
    if (hypotheses.length === 0) return;

    const { error } = await supabase.from("value_hypotheses").insert(
      hypotheses.map((h) => ({
        id: h.id,
        tenant_id: h.tenant_id,
        case_id: h.case_id,
        value_driver: h.value_driver,
        description: h.description,
        estimated_impact_min: h.estimated_impact_min,
        estimated_impact_max: h.estimated_impact_max,
        impact_unit: h.impact_unit,
        evidence_tier: h.evidence_tier,
        confidence_score: h.confidence_score,
        benchmark_reference_id: h.benchmark_reference_id,
        status: h.status,
        source_context_ids: h.source_context_ids,
        created_at: h.created_at,
        updated_at: h.updated_at,
      })),
    );

    if (error) {
      logger.error(`Failed to persist hypotheses: ${error.message}`);
      throw new Error(`Failed to persist hypotheses: ${error.message}`);
    }
  }
}
