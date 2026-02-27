"use strict";
/**
 * Evidence Tiering
 *
 * Classifies evidence into three tiers based on source type:
 * - Tier 1 (Public/Primary): EDGAR filings, 10-K/Q, customer-provided data. Weight: 1.0
 * - Tier 2 (Market/Secondary): Gartner/Forrester, industry benchmarks. Weight: 0.7
 * - Tier 3 (Benchmarks): Internal historical data, anonymized aggregates. Weight: 0.4
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvidenceBundleSchema = exports.CitationSchema = exports.ClassifiedEvidenceSchema = exports.EvidenceItemSchema = exports.TIER_MAX_AGE_DAYS = exports.TIER_WEIGHTS = exports.EvidenceTierValue = void 0;
exports.classifyEvidence = classifyEvidence;
exports.buildEvidenceBundle = buildEvidenceBundle;
exports.getTierWeight = getTierWeight;
exports.getMaxAgeDays = getMaxAgeDays;
const zod_1 = require("zod");
// ============================================================================
// Types
// ============================================================================
exports.EvidenceTierValue = {
    TIER_1: 1,
    TIER_2: 2,
    TIER_3: 3,
};
exports.TIER_WEIGHTS = {
    1: 1.0,
    2: 0.7,
    3: 0.4,
};
/** Max age in days before freshness drops to 0 */
exports.TIER_MAX_AGE_DAYS = {
    1: 365,
    2: 730,
    3: 1095,
};
// ============================================================================
// Zod Schemas
// ============================================================================
exports.EvidenceItemSchema = zod_1.z.object({
    id: zod_1.z.string(),
    sourceType: zod_1.z.string(),
    sourceName: zod_1.z.string(),
    sourceUrl: zod_1.z.string().optional(),
    content: zod_1.z.string(),
    retrievedAt: zod_1.z.string(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
});
exports.ClassifiedEvidenceSchema = exports.EvidenceItemSchema.extend({
    tier: zod_1.z.union([zod_1.z.literal(1), zod_1.z.literal(2), zod_1.z.literal(3)]),
    weight: zod_1.z.number(),
    maxAgeDays: zod_1.z.number(),
});
exports.CitationSchema = zod_1.z.object({
    evidenceId: zod_1.z.string(),
    sourceName: zod_1.z.string(),
    sourceUrl: zod_1.z.string().optional(),
    tier: zod_1.z.union([zod_1.z.literal(1), zod_1.z.literal(2), zod_1.z.literal(3)]),
    excerpt: zod_1.z.string(),
    retrievedAt: zod_1.z.string(),
});
exports.EvidenceBundleSchema = zod_1.z.object({
    valueCaseId: zod_1.z.string(),
    items: zod_1.z.array(exports.ClassifiedEvidenceSchema),
    citations: zod_1.z.array(exports.CitationSchema),
    timestamp: zod_1.z.string(),
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
function classifyEvidence(item) {
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
        weight: exports.TIER_WEIGHTS[tier],
        maxAgeDays: exports.TIER_MAX_AGE_DAYS[tier],
    };
}
/**
 * Classify an array of evidence items and produce an EvidenceBundle
 */
function buildEvidenceBundle(valueCaseId, items) {
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
function getTierWeight(tier) {
    return exports.TIER_WEIGHTS[tier];
}
/**
 * Get the max age in days for a given tier
 */
function getMaxAgeDays(tier) {
    return exports.TIER_MAX_AGE_DAYS[tier];
}
//# sourceMappingURL=EvidenceTiering.js.map