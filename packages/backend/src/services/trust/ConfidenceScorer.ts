import {
  type Evidence,
  SourceTier,
  calculateFreshnessPenalty,
} from "../../lib/validation/SourceClassification.js";

/**
 * Confidence Scoring Service with Enhancements
 *
 * Features:
 * - Corroboration boost: +0.05 per additional independent source (max +0.15)
 * - Expired evidence penalty: based on tier max age
 * - Validation: all financial claims must have confidence scores
 * - Flagging: claims with confidence < 0.5 require additional evidence
 */

export interface ConfidenceInput {
  claimId: string;
  claimType: "financial" | "operational" | "strategic";
  baseConfidence: number;
  sources: Evidence[];
}

export interface ConfidenceDetails {
  baseConfidence: number;
  corroborationBoost: number;
  expiredPenalty: number;
  finalScore: number;
}

export interface ConfidenceResult {
  claimId: string;
  score: number;
  requiresAdditionalEvidence: boolean;
  details: ConfidenceDetails;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Calculate corroboration boost based on unique source tiers
 */
function calculateCorroborationBoost(sources: Evidence[]): number {
  const uniqueTiers = new Set(sources.map((s) => s.sourceTier));
  const tierCount = uniqueTiers.size;

  // Each tier beyond the first adds +0.05, capped at +0.15 (3 additional tiers)
  const boost = Math.min(0.15, (tierCount - 1) * 0.05);
  return Math.max(0, boost);
}

/**
 * Calculate total expired evidence penalty
 */
function calculateTotalExpiredPenalty(sources: Evidence[]): number {
  const referenceDate = inferReferenceDate(sources);
  return sources.reduce((total, source) => {
    return total + calculateFreshnessPenalty(source, referenceDate);
  }, 0);
}

function inferReferenceDate(sources: Evidence[]): Date {
  if (sources.length === 0) {
    return new Date();
  }

  const latestTimestamp = Math.max(
    ...sources.map((source) =>
      (source.createdAt ?? source.freshnessDate).getTime()
    )
  );

  return new Date(latestTimestamp);
}

/**
 * Calculate confidence score with corroboration boost and expired penalties
 */
export function calculateConfidence(
  input: ConfidenceInput
): ConfidenceResult {
  // Calculate corroboration boost
  const corroborationBoost = calculateCorroborationBoost(input.sources);

  // Calculate expired evidence penalty
  const expiredPenalty = calculateTotalExpiredPenalty(input.sources);

  // Calculate final score
  let finalScore = input.baseConfidence + corroborationBoost - expiredPenalty;

  // Clamp to [0, 1]
  finalScore = Math.max(0, Math.min(1, finalScore));
  finalScore = Number(finalScore.toFixed(4));

  // Determine if additional evidence is required
  const requiresAdditionalEvidence = finalScore < 0.5;

  return {
    claimId: input.claimId,
    score: finalScore,
    requiresAdditionalEvidence,
    details: {
      baseConfidence: input.baseConfidence,
      corroborationBoost,
      expiredPenalty,
      finalScore,
    },
  };
}

/**
 * Validate that all financial claims have confidence scores
 */
export function validateFinancialClaimsHaveScores(
  claims: Array<{ claimId: string; claimType: string; confidenceScore?: number }>
): void {
  for (const claim of claims) {
    if (claim.claimType === "financial" && claim.confidenceScore === undefined) {
      throw new ValidationError(
        `Financial claim ${claim.claimId} must have a confidence score`
      );
    }
  }
}

/**
 * Batch calculate confidence for multiple claims
 */
export function calculateConfidenceBatch(
  inputs: ConfidenceInput[]
): ConfidenceResult[] {
  return inputs.map((input) => calculateConfidence(input));
}

/**
 * Get claims requiring additional evidence
 */
export function getClaimsNeedingEvidence(
  results: ConfidenceResult[]
): ConfidenceResult[] {
  return results.filter((r) => r.requiresAdditionalEvidence);
}

/**
 * ConfidenceScorer service class
 */
export class ConfidenceScorer {
  /**
   * Calculate confidence score for a single claim
   */
  calculate(input: ConfidenceInput): ConfidenceResult {
    return calculateConfidence(input);
  }

  /**
   * Calculate confidence scores for multiple claims
   */
  calculateBatch(inputs: ConfidenceInput[]): ConfidenceResult[] {
    return calculateConfidenceBatch(inputs);
  }

  /**
   * Validate all financial claims have confidence scores
   */
  validateFinancialClaims(
    claims: Array<{ claimId: string; claimType: string; confidenceScore?: number }>
  ): void {
    validateFinancialClaimsHaveScores(claims);
  }

  /**
   * Get claims that require additional evidence (score < 0.5)
   */
  getClaimsNeedingEvidence(results: ConfidenceResult[]): ConfidenceResult[] {
    return getClaimsNeedingEvidence(results);
  }
}

// Singleton instance
export const confidenceScorer = new ConfidenceScorer();
