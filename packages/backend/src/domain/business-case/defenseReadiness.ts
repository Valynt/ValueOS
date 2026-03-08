/**
 * Defense Readiness Score
 *
 * Calculates how well a business case can withstand customer scrutiny.
 * Two signals are combined:
 *   - assumption_validation_rate: fraction of assumptions with human_reviewed=true
 *   - mean_evidence_grounding_score: average grounding_score across evidence items
 *
 * Score = 0.6 * assumption_validation_rate + 0.4 * mean_evidence_grounding_score
 *
 * Thresholds (per sprint spec):
 *   ≥ 0.8  → presentation-ready
 *   < 0.4  → unvalidated assumptions or weak evidence
 */

import type { Assumption } from "@valueos/shared/domain";
import type { Evidence } from "@valueos/shared/domain";

export interface DefenseReadinessInput {
  assumptions: Assumption[];
  evidence: Evidence[];
}

export interface DefenseReadinessResult {
  score: number;
  assumption_validation_rate: number;
  mean_evidence_grounding_score: number;
  /** Number of assumptions that have been human-reviewed. */
  validated_assumption_count: number;
  /** Number of evidence items with a grounding score. */
  scored_evidence_count: number;
}

const ASSUMPTION_WEIGHT = 0.6;
const EVIDENCE_WEIGHT = 0.4;

/**
 * Calculate the defense readiness score for a business case.
 *
 * Returns 0 for both sub-scores when the respective input arrays are empty,
 * so the composite score degrades gracefully rather than throwing.
 */
export function calculateDefenseReadiness(
  input: DefenseReadinessInput
): DefenseReadinessResult {
  const { assumptions, evidence } = input;

  // Assumption validation rate
  const validatedCount = assumptions.filter((a) => a.human_reviewed).length;
  const assumptionValidationRate =
    assumptions.length > 0 ? validatedCount / assumptions.length : 0;

  // Mean evidence grounding score (only items that have a score)
  const scoredEvidence = evidence.filter(
    (e) => e.grounding_score != null
  );
  const meanEvidenceGrounding =
    scoredEvidence.length > 0
      ? scoredEvidence.reduce((sum, e) => sum + (e.grounding_score ?? 0), 0) /
        scoredEvidence.length
      : 0;

  const score =
    ASSUMPTION_WEIGHT * assumptionValidationRate +
    EVIDENCE_WEIGHT * meanEvidenceGrounding;

  return {
    score: Math.min(1, Math.max(0, score)),
    assumption_validation_rate: assumptionValidationRate,
    mean_evidence_grounding_score: meanEvidenceGrounding,
    validated_assumption_count: validatedCount,
    scored_evidence_count: scoredEvidence.length,
  };
}
