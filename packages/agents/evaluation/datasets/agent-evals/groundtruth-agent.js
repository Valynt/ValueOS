/**
 * Evaluation Dataset: Ground Truth Agent
 *
 * Golden input/output pairs for validating the GroundTruthAgent.
 * Tests evidence retrieval, source classification, and citation quality.
 */
import { z } from 'zod';
export const GroundtruthEvalCaseSchema = z.object({
    id: z.string(),
    name: z.string(),
    input: z.object({
        query: z.string(),
        context: z.object({
            organizationId: z.string().optional(),
            userId: z.string().optional(),
        }).optional(),
        idempotencyKey: z.string().uuid().optional(),
    }),
    expectations: z.object({
        minGroundtruths: z.number().int().min(1),
        requiredCategories: z.array(z.string()).optional(),
        /** At least one item should have confidence >= this threshold */
        minTopConfidence: z.number().min(0).max(1).optional(),
        mustMentionKeywords: z.array(z.string()).optional(),
    }),
    mockResponse: z.object({
        groundtruths: z.array(z.object({
            title: z.string(),
            description: z.string(),
            confidence: z.number(),
            category: z.string(),
            verification_type: z.string(),
            priority: z.string(),
        })),
        analysis: z.string(),
    }),
});
export const groundtruthEvalCases = [
    {
        id: 'gt-eval-001',
        name: 'Verify DSO and AR data for SaaS company',
        input: {
            query: 'Retrieve and verify evidence for value tree: Working Capital Freed ($3.95M from DSO reduction 62→45 days), ' +
                'FTE Savings ($312.5K from 2.5 FTE AR automation), Bad Debt Reduction ($680K from 40% reduction on $1.7M baseline)',
            context: { organizationId: 'tenant-acme-001' },
            idempotencyKey: '880e8400-e29b-41d4-a716-446655440001',
        },
        expectations: {
            minGroundtruths: 3,
            requiredCategories: ['Verification', 'Source'],
            minTopConfidence: 0.7,
            mustMentionKeywords: ['DSO', '10-K', 'AR'],
        },
        mockResponse: {
            groundtruths: [
                {
                    title: 'DSO Baseline Verification',
                    description: 'Verified: Acme Cloud 10-K FY2025 reports DSO of 62 days and AR balance of $14.4M. ' +
                        'Consistent with $85M ARR. DSO increased from 58 days YoY due to enterprise expansion.',
                    confidence: 0.92,
                    category: 'Verification',
                    verification_type: 'Fact Checking',
                    priority: 'High',
                },
                {
                    title: 'Industry DSO Benchmark Validation',
                    description: 'SaaS Capital 2025 benchmarks: median DSO for $50-100M ARR SaaS is 48 days. ' +
                        'Target of 45 days is achievable (below median). Automated AR processes average 42 days.',
                    confidence: 0.85,
                    category: 'Source',
                    verification_type: 'Accuracy Assessment',
                    priority: 'High',
                },
                {
                    title: 'Bad Debt Baseline Assessment',
                    description: 'Customer-provided AR aging shows $1.7M in write-offs (2% of revenue). ' +
                        'Note: includes one-time $400K bankruptcy write-off that may inflate the baseline.',
                    confidence: 0.78,
                    category: 'Verification',
                    verification_type: 'Reliability Check',
                    priority: 'Medium',
                },
                {
                    title: 'AR Automation Outcome Benchmarks',
                    description: 'Gartner AR Automation Market Guide 2025: median DSO reduction 15-20 days within 12 months. ' +
                        'ValueOS internal benchmarks (n=47): mean 14.3 days, std dev 5.2. Target 17-day reduction is within range.',
                    confidence: 0.80,
                    category: 'Source',
                    verification_type: 'Validation Framework',
                    priority: 'High',
                },
            ],
            analysis: 'Core DSO and AR data verified against 10-K filing (Tier 1). Industry benchmarks support the target DSO. ' +
                'Bad debt baseline may need normalization for one-time event. Overall evidence quality: strong for primary claims.',
        },
    },
    {
        id: 'gt-eval-002',
        name: 'Verify manufacturing quality data',
        input: {
            query: 'Retrieve and verify evidence for value tree: Scrap Reduction ($3.52M from 40% reduction on $8.8M), ' +
                'Rework Reduction ($1.93M from 35% reduction on $5.5M), Warranty Reduction ($2.52M from 60% escape reduction)',
            context: { organizationId: 'tenant-precision-001' },
            idempotencyKey: '880e8400-e29b-41d4-a716-446655440002',
        },
        expectations: {
            minGroundtruths: 3,
            requiredCategories: ['Verification'],
            minTopConfidence: 0.7,
            mustMentionKeywords: ['yield', 'scrap', 'quality'],
        },
        mockResponse: {
            groundtruths: [
                {
                    title: 'Cost of Quality Baseline Verification',
                    description: 'Verified: Precision Parts Annual Report FY2025 reports CoQ of $14.3M (6.5% of revenue). ' +
                        'Breakdown: scrap $8.8M, rework $5.5M, warranty $4.2M. First-pass yield: 87% across 3 lines.',
                    confidence: 0.90,
                    category: 'Verification',
                    verification_type: 'Fact Checking',
                    priority: 'High',
                },
                {
                    title: 'Predictive Quality Outcome Benchmarks',
                    description: 'Gartner PQA 2025: median yield improvement 5-8pp. Scrap reduction 30-50%. ' +
                        'IndustryWeek case study: Tier 1 supplier achieved 8pp yield improvement, 42% scrap reduction.',
                    confidence: 0.82,
                    category: 'Source',
                    verification_type: 'Accuracy Assessment',
                    priority: 'High',
                },
                {
                    title: 'Warranty Reduction Evidence Gap',
                    description: 'The 60% quality escape reduction lacks direct supporting evidence. Material defects (19% of total) ' +
                        'originate upstream and may not be detectable by production-line analytics.',
                    confidence: 0.55,
                    category: 'Claim',
                    verification_type: 'Reliability Check',
                    priority: 'High',
                },
            ],
            analysis: 'Scrap and rework baselines well-supported by Tier 1 data. Reduction rates within industry benchmarks. ' +
                'Warranty claim reduction is the weakest component — escape reduction rate needs downward adjustment.',
        },
    },
];
//# sourceMappingURL=groundtruth-agent.js.map