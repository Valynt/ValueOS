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
import type { Citation, ClassifiedEvidence, EvidenceTier } from './EvidenceTiering.js';
export type TransparencyLevel = 'full' | 'partial' | 'opaque';
export interface ConfidenceInput {
    evidence: ClassifiedEvidence;
    transparency: TransparencyLevel;
    referenceDate?: string;
}
export interface ConfidenceScore {
    overall: number;
    freshness: number;
    reliability: number;
    transparency: number;
    tier: EvidenceTier;
    evidenceId: string;
}
export interface ClaimConfidence {
    claimId: string;
    score: ConfidenceScore;
    citations: Citation[];
}
export declare const ConfidenceScoreSchema: z.ZodObject<{
    overall: z.ZodNumber;
    freshness: z.ZodNumber;
    reliability: z.ZodNumber;
    transparency: z.ZodNumber;
    tier: z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>]>;
    evidenceId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    tier: 1 | 3 | 2;
    evidenceId: string;
    overall: number;
    freshness: number;
    reliability: number;
    transparency: number;
}, {
    tier: 1 | 3 | 2;
    evidenceId: string;
    overall: number;
    freshness: number;
    reliability: number;
    transparency: number;
}>;
export declare const ClaimConfidenceSchema: z.ZodObject<{
    claimId: z.ZodString;
    score: z.ZodObject<{
        overall: z.ZodNumber;
        freshness: z.ZodNumber;
        reliability: z.ZodNumber;
        transparency: z.ZodNumber;
        tier: z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>]>;
        evidenceId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        tier: 1 | 3 | 2;
        evidenceId: string;
        overall: number;
        freshness: number;
        reliability: number;
        transparency: number;
    }, {
        tier: 1 | 3 | 2;
        evidenceId: string;
        overall: number;
        freshness: number;
        reliability: number;
        transparency: number;
    }>;
    citations: z.ZodArray<z.ZodObject<{
        evidenceId: z.ZodString;
        sourceName: z.ZodString;
        sourceUrl: z.ZodOptional<z.ZodString>;
        tier: z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>]>;
        excerpt: z.ZodString;
        retrievedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        tier: 1 | 3 | 2;
        sourceName: string;
        retrievedAt: string;
        evidenceId: string;
        excerpt: string;
        sourceUrl?: string | undefined;
    }, {
        tier: 1 | 3 | 2;
        sourceName: string;
        retrievedAt: string;
        evidenceId: string;
        excerpt: string;
        sourceUrl?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    score: {
        tier: 1 | 3 | 2;
        evidenceId: string;
        overall: number;
        freshness: number;
        reliability: number;
        transparency: number;
    };
    citations: {
        tier: 1 | 3 | 2;
        sourceName: string;
        retrievedAt: string;
        evidenceId: string;
        excerpt: string;
        sourceUrl?: string | undefined;
    }[];
    claimId: string;
}, {
    score: {
        tier: 1 | 3 | 2;
        evidenceId: string;
        overall: number;
        freshness: number;
        reliability: number;
        transparency: number;
    };
    citations: {
        tier: 1 | 3 | 2;
        sourceName: string;
        retrievedAt: string;
        evidenceId: string;
        excerpt: string;
        sourceUrl?: string | undefined;
    }[];
    claimId: string;
}>;
/**
 * Compute freshness score based on evidence age relative to tier max age.
 * Score = 1.0 - (age_days / max_age_days), clamped to [0, 1]
 */
export declare function computeFreshness(retrievedAt: string, tier: EvidenceTier, referenceDate?: string): number;
/**
 * Get reliability score from tier weight
 */
export declare function computeReliability(tier: EvidenceTier): number;
/**
 * Get transparency score from transparency level
 */
export declare function computeTransparency(level: TransparencyLevel): number;
/**
 * Compute the overall confidence score for a single evidence item
 */
export declare function computeConfidence(input: ConfidenceInput): ConfidenceScore;
/**
 * Compute an aggregate confidence score from multiple evidence items.
 * Uses the highest-confidence evidence as the primary score,
 * with a small boost for corroborating evidence.
 */
export declare function computeAggregateConfidence(inputs: ConfidenceInput[]): ConfidenceScore | null;
/**
 * Score a claim against its supporting evidence
 */
export declare function scoreClaimConfidence(claimId: string, evidenceItems: ClassifiedEvidence[], transparency: TransparencyLevel, citations: Citation[], referenceDate?: string): ClaimConfidence;
//# sourceMappingURL=ConfidenceScorer.d.ts.map