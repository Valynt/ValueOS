/**
 * Evidence Tiering
 *
 * Classifies evidence into three tiers based on source type:
 * - Tier 1 (Public/Primary): EDGAR filings, 10-K/Q, customer-provided data. Weight: 1.0
 * - Tier 2 (Market/Secondary): Gartner/Forrester, industry benchmarks. Weight: 0.7
 * - Tier 3 (Benchmarks): Internal historical data, anonymized aggregates. Weight: 0.4
 */
import { z } from 'zod';
export declare const EvidenceTierValue: {
    readonly TIER_1: 1;
    readonly TIER_2: 2;
    readonly TIER_3: 3;
};
export type EvidenceTier = 1 | 2 | 3;
export declare const TIER_WEIGHTS: Record<EvidenceTier, number>;
/** Max age in days before freshness drops to 0 */
export declare const TIER_MAX_AGE_DAYS: Record<EvidenceTier, number>;
export interface EvidenceItem {
    id: string;
    sourceType: string;
    sourceName: string;
    sourceUrl?: string;
    content: string;
    retrievedAt: string;
    metadata?: Record<string, unknown>;
}
export interface ClassifiedEvidence extends EvidenceItem {
    tier: EvidenceTier;
    weight: number;
    maxAgeDays: number;
}
export interface Citation {
    evidenceId: string;
    sourceName: string;
    sourceUrl?: string;
    tier: EvidenceTier;
    excerpt: string;
    retrievedAt: string;
}
export interface EvidenceBundle {
    valueCaseId: string;
    items: ClassifiedEvidence[];
    citations: Citation[];
    timestamp: string;
}
export declare const EvidenceItemSchema: z.ZodObject<{
    id: z.ZodString;
    sourceType: z.ZodString;
    sourceName: z.ZodString;
    sourceUrl: z.ZodOptional<z.ZodString>;
    content: z.ZodString;
    retrievedAt: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    content: string;
    sourceType: string;
    sourceName: string;
    retrievedAt: string;
    metadata?: Record<string, unknown> | undefined;
    sourceUrl?: string | undefined;
}, {
    id: string;
    content: string;
    sourceType: string;
    sourceName: string;
    retrievedAt: string;
    metadata?: Record<string, unknown> | undefined;
    sourceUrl?: string | undefined;
}>;
export declare const ClassifiedEvidenceSchema: z.ZodObject<{
    id: z.ZodString;
    sourceType: z.ZodString;
    sourceName: z.ZodString;
    sourceUrl: z.ZodOptional<z.ZodString>;
    content: z.ZodString;
    retrievedAt: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    tier: z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>]>;
    weight: z.ZodNumber;
    maxAgeDays: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    tier: 1 | 3 | 2;
    content: string;
    weight: number;
    sourceType: string;
    sourceName: string;
    retrievedAt: string;
    maxAgeDays: number;
    metadata?: Record<string, unknown> | undefined;
    sourceUrl?: string | undefined;
}, {
    id: string;
    tier: 1 | 3 | 2;
    content: string;
    weight: number;
    sourceType: string;
    sourceName: string;
    retrievedAt: string;
    maxAgeDays: number;
    metadata?: Record<string, unknown> | undefined;
    sourceUrl?: string | undefined;
}>;
export declare const CitationSchema: z.ZodObject<{
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
}>;
export declare const EvidenceBundleSchema: z.ZodObject<{
    valueCaseId: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        sourceType: z.ZodString;
        sourceName: z.ZodString;
        sourceUrl: z.ZodOptional<z.ZodString>;
        content: z.ZodString;
        retrievedAt: z.ZodString;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    } & {
        tier: z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>]>;
        weight: z.ZodNumber;
        maxAgeDays: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        tier: 1 | 3 | 2;
        content: string;
        weight: number;
        sourceType: string;
        sourceName: string;
        retrievedAt: string;
        maxAgeDays: number;
        metadata?: Record<string, unknown> | undefined;
        sourceUrl?: string | undefined;
    }, {
        id: string;
        tier: 1 | 3 | 2;
        content: string;
        weight: number;
        sourceType: string;
        sourceName: string;
        retrievedAt: string;
        maxAgeDays: number;
        metadata?: Record<string, unknown> | undefined;
        sourceUrl?: string | undefined;
    }>, "many">;
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
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    valueCaseId: string;
    items: {
        id: string;
        tier: 1 | 3 | 2;
        content: string;
        weight: number;
        sourceType: string;
        sourceName: string;
        retrievedAt: string;
        maxAgeDays: number;
        metadata?: Record<string, unknown> | undefined;
        sourceUrl?: string | undefined;
    }[];
    citations: {
        tier: 1 | 3 | 2;
        sourceName: string;
        retrievedAt: string;
        evidenceId: string;
        excerpt: string;
        sourceUrl?: string | undefined;
    }[];
}, {
    timestamp: string;
    valueCaseId: string;
    items: {
        id: string;
        tier: 1 | 3 | 2;
        content: string;
        weight: number;
        sourceType: string;
        sourceName: string;
        retrievedAt: string;
        maxAgeDays: number;
        metadata?: Record<string, unknown> | undefined;
        sourceUrl?: string | undefined;
    }[];
    citations: {
        tier: 1 | 3 | 2;
        sourceName: string;
        retrievedAt: string;
        evidenceId: string;
        excerpt: string;
        sourceUrl?: string | undefined;
    }[];
}>;
/**
 * Classify a single evidence item into a tier
 */
export declare function classifyEvidence(item: EvidenceItem): ClassifiedEvidence;
/**
 * Classify an array of evidence items and produce an EvidenceBundle
 */
export declare function buildEvidenceBundle(valueCaseId: string, items: EvidenceItem[]): EvidenceBundle;
/**
 * Get the tier weight for a given tier
 */
export declare function getTierWeight(tier: EvidenceTier): number;
/**
 * Get the max age in days for a given tier
 */
export declare function getMaxAgeDays(tier: EvidenceTier): number;
//# sourceMappingURL=EvidenceTiering.d.ts.map