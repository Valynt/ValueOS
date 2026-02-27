/**
 * Evidence Tiering
 *
 * Classifies evidence into three tiers based on source type:
 * - Tier 1 (Public/Primary): EDGAR filings, 10-K/Q, customer-provided data. Weight: 1.0
 * - Tier 2 (Market/Secondary): Gartner/Forrester, industry benchmarks. Weight: 0.7
 * - Tier 3 (Benchmarks): Internal historical data, anonymized aggregates. Weight: 0.4
 */
import { z } from 'zod';
// ============================================================================
// Types
// ============================================================================
export const EvidenceTierValue = {
    TIER_1: 1,
    TIER_2: 2,
    TIER_3: 3,
};
export const TIER_WEIGHTS = {
    1: 1.0,
    2: 0.7,
    3: 0.4,
};
/** Max age in days before freshness drops to 0 */
export const TIER_MAX_AGE_DAYS = {
    1: 365,
    2: 730,
    3: 1095,
};
// ============================================================================
// Zod Schemas
// ============================================================================
export const EvidenceItemSchema = z.object({
    id: z.string(),
    sourceType: z.string(),
    sourceName: z.string(),
    sourceUrl: z.string().optional(),
    content: z.string(),
    retrievedAt: z.string(),
    metadata: z.record(z.unknown()).optional(),
});
export const ClassifiedEvidenceSchema = EvidenceItemSchema.extend({
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    weight: z.number(),
    maxAgeDays: z.number(),
});
export const CitationSchema = z.object({
    evidenceId: z.string(),
    sourceName: z.string(),
    sourceUrl: z.string().optional(),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    excerpt: z.string(),
    retrievedAt: z.string(),
});
export const EvidenceBundleSchema = z.object({
    valueCaseId: z.string(),
    items: z.array(ClassifiedEvidenceSchema),
    citations: z.array(CitationSchema),
    timestamp: z.string(),
});
// ============================================================================
// Source Type → Tier Mapping
// ============================================================================
const TIER_1_SOURCES = new Set([
    'edgar_filing',
    '10-k',
    '10-q',
    'sec_filing',
    'customer_provided',
    'annual_report',
    'quarterly_report',
    'audited_financial',
    'primary_data',
]);
const TIER_2_SOURCES = new Set([
    'gartner',
    'forrester',
    'idc',
    'mckinsey',
    'industry_benchmark',
    'market_research',
    'analyst_report',
    'trade_publication',
    'secondary_data',
]);
// Everything else defaults to Tier 3
// ============================================================================
// Classification Logic
// ============================================================================
/**
 * Classify a single evidence item into a tier
 */
export function classifyEvidence(item) {
    const normalizedType = item.sourceType.toLowerCase().replace(/[\s-]/g, '_');
    let tier;
    if (TIER_1_SOURCES.has(normalizedType)) {
        tier = 1;
    }
    else if (TIER_2_SOURCES.has(normalizedType)) {
        tier = 2;
    }
    else {
        tier = 3;
    }
    return {
        ...item,
        tier,
        weight: TIER_WEIGHTS[tier],
        maxAgeDays: TIER_MAX_AGE_DAYS[tier],
    };
}
/**
 * Classify an array of evidence items and produce an EvidenceBundle
 */
export function buildEvidenceBundle(valueCaseId, items) {
    const classified = items.map(classifyEvidence);
    const citations = classified.map((item) => ({
        evidenceId: item.id,
        sourceName: item.sourceName,
        sourceUrl: item.sourceUrl,
        tier: item.tier,
        excerpt: item.content.substring(0, 200),
        retrievedAt: item.retrievedAt,
    }));
    return {
        valueCaseId,
        items: classified,
        citations,
        timestamp: new Date().toISOString(),
    };
}
/**
 * Get the tier weight for a given tier
 */
export function getTierWeight(tier) {
    return TIER_WEIGHTS[tier];
}
/**
 * Get the max age in days for a given tier
 */
export function getMaxAgeDays(tier) {
    return TIER_MAX_AGE_DAYS[tier];
}
//# sourceMappingURL=EvidenceTiering.js.map