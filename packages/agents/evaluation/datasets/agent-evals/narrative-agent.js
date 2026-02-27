"use strict";
/**
 * Evaluation Dataset: Narrative Agent
 *
 * Golden input/output pairs for validating the NarrativeAgent.
 * Tests executive summary generation, section structure, and
 * claim-to-citation linkage.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.narrativeEvalCases = exports.NarrativeEvalCaseSchema = void 0;
const zod_1 = require("zod");
exports.NarrativeEvalCaseSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    input: zod_1.z.object({
        query: zod_1.z.string(),
        context: zod_1.z.object({
            organizationId: zod_1.z.string().optional(),
        }).optional(),
        idempotencyKey: zod_1.z.string().uuid().optional(),
    }),
    expectations: zod_1.z.object({
        minNarratives: zod_1.z.number().int().min(1),
        /** Executive summary / analysis must be at least this long */
        analysisMinLength: zod_1.z.number().int(),
        mustMentionKeywords: zod_1.z.array(zod_1.z.string()).optional(),
        /** Each narrative should reference specific dollar amounts */
        requiresDollarAmounts: zod_1.z.boolean().optional(),
    }),
    mockResponse: zod_1.z.object({
        narratives: zod_1.z.array(zod_1.z.object({
            title: zod_1.z.string(),
            description: zod_1.z.string(),
            confidence: zod_1.z.number(),
            category: zod_1.z.string(),
            narrative_type: zod_1.z.string(),
            priority: zod_1.z.string(),
        })),
        analysis: zod_1.z.string(),
    }),
});
exports.narrativeEvalCases = [
    {
        id: 'narr-eval-001',
        name: 'SaaS DSO reduction executive narrative',
        input: {
            query: 'Create executive narrative for value tree: Total $4.94M — Working Capital Freed $3.95M (DSO 62→45), ' +
                'FTE Savings $312.5K (2.5 FTE), Bad Debt Reduction $680K (40% of $1.7M). ' +
                'Evidence: 10-K verified DSO 62 days, Gartner 15-20 day median reduction, SaaS Capital median DSO 48 days.',
            context: { organizationId: 'tenant-acme-001' },
            idempotencyKey: '990e8400-e29b-41d4-a716-446655440001',
        },
        expectations: {
            minNarratives: 3,
            analysisMinLength: 100,
            mustMentionKeywords: ['$4.9', 'DSO', 'working capital', 'Acme'],
            requiresDollarAmounts: true,
        },
        mockResponse: {
            narratives: [
                {
                    title: 'Working Capital Impact',
                    description: 'Reducing DSO from 62 to 45 days releases $3.95M in working capital. This projection is supported by ' +
                        'Acme\'s 10-K filing ($14.4M AR balance), Gartner research (15-20 day median reduction), and SaaS Capital ' +
                        'benchmarks (42-day DSO for automated processes). Confidence: 82%.',
                    confidence: 0.82,
                    category: 'Financial Impact',
                    narrative_type: 'Executive Summary',
                    priority: 'High',
                },
                {
                    title: 'Operational Efficiency',
                    description: 'AR automation eliminates 2.5 FTE of manual invoice follow-up and reconciliation, yielding $312.5K ' +
                        'in annual savings at $125K loaded cost per FTE. Confidence: 75%.',
                    confidence: 0.75,
                    category: 'Operational',
                    narrative_type: 'Supporting Detail',
                    priority: 'Medium',
                },
                {
                    title: 'Revenue Protection',
                    description: 'Proactive collection workflows reduce bad debt write-offs by 40% ($680K annually) from the $1.7M FY2025 baseline. ' +
                        'This estimate is conservative relative to the 35% industry average. Confidence: 68%.',
                    confidence: 0.68,
                    category: 'Risk Mitigation',
                    narrative_type: 'Supporting Detail',
                    priority: 'Medium',
                },
            ],
            analysis: 'Acme Cloud\'s 62-day DSO is 14 days above the SaaS industry median, tying up $14.4M in receivables. ' +
                'AR automation delivers $4.94M in first-year value: $3.95M in freed working capital, $312.5K in FTE savings, ' +
                'and $680K in bad debt reduction. Weighted confidence: 76%. Primary risk: phased adoption may delay full impact.',
        },
    },
    {
        id: 'narr-eval-002',
        name: 'Manufacturing quality executive narrative',
        input: {
            query: 'Create executive narrative for value tree: Total $9.62M — Scrap Reduction $3.52M (40% of $8.8M), ' +
                'Rework Reduction $1.93M (35% of $5.5M), Warranty Reduction $2.52M (60% escape reduction), ' +
                'Downtime Reduction $1.65M (25% reduction). Evidence: Annual report CoQ $14.3M, Gartner PQA benchmarks.',
            context: { organizationId: 'tenant-precision-001' },
            idempotencyKey: '990e8400-e29b-41d4-a716-446655440002',
        },
        expectations: {
            minNarratives: 3,
            analysisMinLength: 100,
            mustMentionKeywords: ['$9', 'yield', 'quality', 'scrap'],
            requiresDollarAmounts: true,
        },
        mockResponse: {
            narratives: [
                {
                    title: 'Quality Cost Reduction',
                    description: 'Predictive quality analytics targets $5.45M in combined scrap ($3.52M) and rework ($1.93M) reduction. ' +
                        'Current CoQ of $14.3M (6.5% of revenue) is well above industry benchmarks. Reduction rates are consistent ' +
                        'with Gartner PQA research (30-50% scrap, 25-40% rework).',
                    confidence: 0.75,
                    category: 'Quality',
                    narrative_type: 'Executive Summary',
                    priority: 'High',
                },
                {
                    title: 'Customer Quality and Warranty',
                    description: 'Reducing quality escapes by 60% addresses $2.52M in annual warranty claims. This is the highest-risk ' +
                        'component — material defects (19% of total) may not be detectable by production-line sensors.',
                    confidence: 0.58,
                    category: 'Customer Impact',
                    narrative_type: 'Supporting Detail',
                    priority: 'Medium',
                },
                {
                    title: 'Equipment Uptime',
                    description: 'Predictive maintenance on CNC machines targets $1.65M in downtime reduction. ' +
                        'Note: baseline downtime cost requires validation from customer data.',
                    confidence: 0.65,
                    category: 'Operational',
                    narrative_type: 'Supporting Detail',
                    priority: 'Medium',
                },
            ],
            analysis: 'Precision Parts\' 87% first-pass yield drives $14.3M in annual quality costs. Predictive analytics delivers ' +
                '$9.62M in total value, with quality cost reduction (57%) as the primary driver. Warranty reduction carries ' +
                'the highest uncertainty. Recommended: validate downtime baseline and adjust escape reduction rate.',
        },
    },
];
//# sourceMappingURL=narrative-agent.js.map