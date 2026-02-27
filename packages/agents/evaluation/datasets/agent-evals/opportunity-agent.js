"use strict";
/**
 * Evaluation Dataset: Opportunity Agent
 *
 * Golden input/output pairs for validating the OpportunityAgent.
 * Each case defines a query, context, and the expected shape/constraints
 * of the response. Used for both deterministic mock testing and
 * LLM output quality evaluation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.opportunityEvalCases = exports.OpportunityEvalCaseSchema = void 0;
const zod_1 = require("zod");
// ============================================================================
// Evaluation Case Schema
// ============================================================================
exports.OpportunityEvalCaseSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    input: zod_1.z.object({
        query: zod_1.z.string(),
        context: zod_1.z.object({
            organizationId: zod_1.z.string().optional(),
            userId: zod_1.z.string().optional(),
            sessionId: zod_1.z.string().optional(),
        }).optional(),
    }),
    /** Expected output constraints — not exact match, but structural/semantic validation */
    expectations: zod_1.z.object({
        minOpportunities: zod_1.z.number().int().min(1),
        maxOpportunities: zod_1.z.number().int().optional(),
        requiredCategories: zod_1.z.array(zod_1.z.string()).optional(),
        minConfidence: zod_1.z.number().min(0).max(1).optional(),
        mustMentionKeywords: zod_1.z.array(zod_1.z.string()).optional(),
        analysisMinLength: zod_1.z.number().int().optional(),
    }),
    /** Deterministic mock response for unit testing */
    mockResponse: zod_1.z.object({
        opportunities: zod_1.z.array(zod_1.z.object({
            title: zod_1.z.string(),
            description: zod_1.z.string(),
            confidence: zod_1.z.number(),
            category: zod_1.z.string(),
            estimatedValue: zod_1.z.number().optional(),
        })),
        analysis: zod_1.z.string(),
    }),
});
// ============================================================================
// Evaluation Cases
// ============================================================================
exports.opportunityEvalCases = [
    {
        id: 'opp-eval-001',
        name: 'SaaS company with high DSO',
        input: {
            query: 'Identify value drivers for a B2B SaaS company with $85M ARR, 62-day DSO, and 450 employees',
            context: { organizationId: 'tenant-acme-001' },
        },
        expectations: {
            minOpportunities: 2,
            maxOpportunities: 6,
            requiredCategories: ['Working Capital', 'Operational Efficiency'],
            minConfidence: 0.5,
            mustMentionKeywords: ['DSO', 'AR', 'working capital'],
            analysisMinLength: 50,
        },
        mockResponse: {
            opportunities: [
                {
                    title: 'DSO Reduction via AR Automation',
                    description: 'Reducing DSO from 62 to 45 days through automated invoice delivery and payment reminders, freeing working capital.',
                    confidence: 0.82,
                    category: 'Working Capital Optimization',
                    estimatedValue: 3_950_000,
                },
                {
                    title: 'Finance Operations Efficiency',
                    description: 'Eliminating manual AR reconciliation effort through automation, saving FTE in finance operations.',
                    confidence: 0.75,
                    category: 'Operational Efficiency',
                    estimatedValue: 312_500,
                },
                {
                    title: 'Bad Debt Reduction',
                    description: 'Reducing bad debt write-offs through proactive collection workflows and early warning systems.',
                    confidence: 0.68,
                    category: 'Revenue Protection',
                    estimatedValue: 680_000,
                },
            ],
            analysis: 'Primary value drivers center on working capital optimization through DSO reduction. Secondary opportunities in operational efficiency and revenue protection.',
        },
    },
    {
        id: 'opp-eval-002',
        name: 'Manufacturing company with quality issues',
        input: {
            query: 'Identify value drivers for an automotive parts manufacturer with $220M revenue, 87% first-pass yield, and $14.3M cost of quality',
            context: { organizationId: 'tenant-precision-001' },
        },
        expectations: {
            minOpportunities: 2,
            maxOpportunities: 5,
            requiredCategories: ['Quality Improvement'],
            minConfidence: 0.5,
            mustMentionKeywords: ['yield', 'quality', 'downtime'],
            analysisMinLength: 50,
        },
        mockResponse: {
            opportunities: [
                {
                    title: 'First-Pass Yield Improvement',
                    description: 'Improving first-pass yield from 87% to 94% through predictive quality analytics and real-time SPC.',
                    confidence: 0.78,
                    category: 'Quality Improvement',
                    estimatedValue: 5_720_000,
                },
                {
                    title: 'Predictive Maintenance',
                    description: 'Reducing unplanned downtime by 25% through predictive maintenance on aging CNC machines.',
                    confidence: 0.72,
                    category: 'OEE Improvement',
                    estimatedValue: 1_650_000,
                },
                {
                    title: 'Customer Quality Escape Reduction',
                    description: 'Reducing quality escapes to customers by 60%, avoiding warranty claims and chargebacks.',
                    confidence: 0.65,
                    category: 'Customer Retention',
                    estimatedValue: 2_400_000,
                },
            ],
            analysis: 'Primary value in quality cost reduction through predictive analytics. Significant secondary value in equipment uptime and customer retention.',
        },
    },
    {
        id: 'opp-eval-003',
        name: 'Healthcare provider with patient throughput issues',
        input: {
            query: 'Identify value drivers for a regional hospital network with 3 facilities, 800 beds, 72% bed utilization, and $45M in denied claims annually',
            context: { organizationId: 'tenant-health-001' },
        },
        expectations: {
            minOpportunities: 2,
            maxOpportunities: 5,
            requiredCategories: ['Revenue Cycle'],
            minConfidence: 0.5,
            mustMentionKeywords: ['denied', 'claims', 'utilization'],
            analysisMinLength: 50,
        },
        mockResponse: {
            opportunities: [
                {
                    title: 'Denied Claims Recovery',
                    description: 'Reducing claim denial rate through automated prior authorization and coding accuracy improvements.',
                    confidence: 0.80,
                    category: 'Revenue Cycle',
                    estimatedValue: 13_500_000,
                },
                {
                    title: 'Bed Utilization Optimization',
                    description: 'Improving bed utilization from 72% to 82% through predictive discharge planning and patient flow optimization.',
                    confidence: 0.70,
                    category: 'Operational Efficiency',
                    estimatedValue: 8_200_000,
                },
            ],
            analysis: 'Largest value opportunity in revenue cycle management through denied claims reduction. Secondary value in operational throughput.',
        },
    },
];
//# sourceMappingURL=opportunity-agent.js.map