/**
 * Confidence Scorer
 *
 * Computes a confidence score (0.0–1.0) for value claims based on:
 * - Data Freshness (30%): How recent the evidence is relative to tier-specific max age
 * - Source Reliability (40%): Tier weight (1.0 / 0.7 / 0.4)
 * - Logic Transparency (30%): Whether the formula decomposes to primitive inputs
 *
 * Final score = (freshness * 0.3) + (reliability * 0.4) + (transparency * 0.3)
 */
import { z } from 'zod';
import { TIER_MAX_AGE_DAYS, TIER_WEIGHTS } from './EvidenceTiering.js';
// ============================================================================
// Zod Schemas
// ============================================================================
export const ConfidenceScoreSchema = z.object({
    overall: z.number().min(0).max(1),
    freshness: z.number().min(0).max(1),
    reliability: z.number().min(0).max(1),
    transparency: z.number().min(0).max(1),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    evidenceId: z.string(),
});
export const ClaimConfidenceSchema = z.object({
    claimId: z.string(),
    score: ConfidenceScoreSchema,
    citations: z.array(z.object({
        evidenceId: z.string(),
        sourceName: z.string(),
        sourceUrl: z.string().optional(),
        tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        excerpt: z.string(),
        retrievedAt: z.string(),
    })),
});
// ============================================================================
// Scoring Constants
// ============================================================================
const WEIGHT_FRESHNESS = 0.3;
const WEIGHT_RELIABILITY = 0.4;
const WEIGHT_TRANSPARENCY = 0.3;
const TRANSPARENCY_SCORES = {
    full: 1.0,
    partial: 0.5,
    opaque: 0.0,
};
// ============================================================================
// Scoring Functions
// ============================================================================
/**
 * Compute freshness score based on evidence age relative to tier max age.
 * Score = 1.0 - (age_days / max_age_days), clamped to [0, 1]
 */
export function computeFreshness(retrievedAt, tier, referenceDate) {
    const retrieved = new Date(retrievedAt).getTime();
    const reference = referenceDate
        ? new Date(referenceDate).getTime()
        : Date.now();
    const ageDays = Math.max(0, (reference - retrieved) / (1000 * 60 * 60 * 24));
    const maxAge = TIER_MAX_AGE_DAYS[tier];
    return Math.max(0, Math.min(1, 1.0 - ageDays / maxAge));
}
/**
 * Get reliability score from tier weight
 */
export function computeReliability(tier) {
    return TIER_WEIGHTS[tier];
}
/**
 * Get transparency score from transparency level
 */
export function computeTransparency(level) {
    return TRANSPARENCY_SCORES[level];
}
/**
 * Compute the overall confidence score for a single evidence item
 */
export function computeConfidence(input) {
    const freshness = computeFreshness(input.evidence.retrievedAt, input.evidence.tier, input.referenceDate);
    const reliability = computeReliability(input.evidence.tier);
    const transparency = computeTransparency(input.transparency);
    const overall = freshness * WEIGHT_FRESHNESS +
        reliability * WEIGHT_RELIABILITY +
        transparency * WEIGHT_TRANSPARENCY;
    return {
        overall: Math.round(overall * 1000) / 1000,
        freshness: Math.round(freshness * 1000) / 1000,
        reliability,
        transparency,
        tier: input.evidence.tier,
        evidenceId: input.evidence.id,
    };
}
/**
 * Compute an aggregate confidence score from multiple evidence items.
 * Uses the highest-confidence evidence as the primary score,
 * with a small boost for corroborating evidence.
 */
export function computeAggregateConfidence(inputs) {
    if (inputs.length === 0)
        return null;
    const scores = inputs.map(computeConfidence);
    scores.sort((a, b) => b.overall - a.overall);
    const primary = scores[0];
    if (scores.length === 1)
        return primary;
    // Corroboration boost: up to 0.1 for additional sources
    const corroborationBoost = Math.min(0.1, (scores.length - 1) * 0.02);
    return {
        ...primary,
        overall: Math.min(1.0, Math.round((primary.overall + corroborationBoost) * 1000) / 1000),
    };
}
/**
 * Score a claim against its supporting evidence
 */
export function scoreClaimConfidence(claimId, evidenceItems, transparency, citations, referenceDate) {
    const inputs = evidenceItems.map((evidence) => ({
        evidence,
        transparency,
        referenceDate,
    }));
    const score = computeAggregateConfidence(inputs) ?? {
        overall: 0,
        freshness: 0,
        reliability: 0,
        transparency: 0,
        tier: 3,
        evidenceId: '',
    };
    return {
        claimId,
        score,
        citations,
    };
}
//# sourceMappingURL=ConfidenceScorer.js.map