/**
 * Evaluation Dataset: Financial Modeling Agent
 *
 * Golden input/output pairs for validating the FinancialModelingAgent.
 * Tests value tree construction from hypotheses, formula correctness,
 * and confidence score assignment.
 */
import { z } from 'zod';
export const FinancialModelingEvalCaseSchema = z.object({
    id: z.string(),
    name: z.string(),
    input: z.object({
        query: z.string(),
        context: z.object({
            organizationId: z.string().optional(),
        }).optional(),
        idempotencyKey: z.string().uuid().optional(),
    }),
    expectations: z.object({
        minModels: z.number().int().min(1),
        /** Every model must have a parseable formula or description */
        requiresFormula: z.boolean(),
        minConfidence: z.number().min(0).max(1).optional(),
        mustMentionKeywords: z.array(z.string()).optional(),
        /** Total value should be within this range */
        totalValueRange: z.object({
            min: z.number(),
            max: z.number(),
        }).optional(),
    }),
    mockResponse: z.object({
        financial_models: z.array(z.object({
            title: z.string(),
            description: z.string(),
            confidence: z.number(),
            category: z.string(),
            model_type: z.string(),
            priority: z.string(),
        })),
        analysis: z.string(),
    }),
});
export const financialModelingEvalCases = [
    {
        id: 'fm-eval-001',
        name: 'DSO reduction value tree',
        input: {
            query: 'Build value tree for hypotheses: Reducing DSO from 62 to 45 days through automated invoice delivery; ' +
                'Eliminating manual AR reconciliation effort, saving 2.5 FTE; Reducing bad debt write-offs by 40%',
            context: { organizationId: 'tenant-acme-001' },
            idempotencyKey: '770e8400-e29b-41d4-a716-446655440001',
        },
        expectations: {
            minModels: 3,
            requiresFormula: true,
            minConfidence: 0.5,
            mustMentionKeywords: ['DSO', 'working capital'],
            totalValueRange: { min: 3_000_000, max: 7_000_000 },
        },
        mockResponse: {
            financial_models: [
                {
                    title: 'Working Capital Freed — DSO Reduction',
                    description: 'Formula: (62 - 45) / 365 * $85M = $3.96M. Reducing DSO by 17 days releases working capital proportional to daily revenue.',
                    confidence: 0.82,
                    category: 'Working Capital',
                    model_type: 'Cash Flow',
                    priority: 'High',
                },
                {
                    title: 'FTE Savings — AR Automation',
                    description: 'Formula: 2.5 FTE * $125K loaded cost = $312.5K annual savings. Automation eliminates manual invoice follow-up and reconciliation.',
                    confidence: 0.75,
                    category: 'Operational Efficiency',
                    model_type: 'Cost Reduction',
                    priority: 'Medium',
                },
                {
                    title: 'Bad Debt Reduction',
                    description: 'Formula: $1.7M * 0.40 = $680K. Proactive collection workflows reduce write-offs by 40% based on industry benchmarks.',
                    confidence: 0.68,
                    category: 'Revenue Protection',
                    model_type: 'Risk Reduction',
                    priority: 'Medium',
                },
            ],
            analysis: 'Total modeled value: $4.95M. Primary driver is working capital release from DSO reduction (80% of total). Model confidence weighted average: 0.76.',
        },
    },
    {
        id: 'fm-eval-002',
        name: 'Manufacturing yield value tree',
        input: {
            query: 'Build value tree for hypotheses: Improving first-pass yield from 87% to 94% through predictive quality; ' +
                'Reducing unplanned downtime by 25%; Reducing customer quality escapes by 60%',
            context: { organizationId: 'tenant-precision-001' },
            idempotencyKey: '770e8400-e29b-41d4-a716-446655440002',
        },
        expectations: {
            minModels: 3,
            requiresFormula: true,
            minConfidence: 0.5,
            mustMentionKeywords: ['scrap', 'rework', 'reduction'],
            totalValueRange: { min: 5_000_000, max: 15_000_000 },
        },
        mockResponse: {
            financial_models: [
                {
                    title: 'Scrap Cost Reduction',
                    description: 'Formula: $8.8M * 0.40 = $3.52M. Predictive defect detection reduces scrap by 40%, consistent with Gartner 30-50% range.',
                    confidence: 0.78,
                    category: 'Quality',
                    model_type: 'Cost Reduction',
                    priority: 'High',
                },
                {
                    title: 'Rework Cost Reduction',
                    description: 'Formula: $5.5M * 0.35 = $1.93M. Early defect detection reduces rework by 35%.',
                    confidence: 0.72,
                    category: 'Quality',
                    model_type: 'Cost Reduction',
                    priority: 'High',
                },
                {
                    title: 'Warranty Claim Reduction',
                    description: 'Formula: $4.2M * 0.60 = $2.52M. Reducing quality escapes by 60% avoids downstream warranty costs.',
                    confidence: 0.58,
                    category: 'Customer Quality',
                    model_type: 'Risk Reduction',
                    priority: 'Medium',
                },
                {
                    title: 'Unplanned Downtime Reduction',
                    description: 'Estimated 25% reduction in unplanned downtime costs = $1.65M. Requires baseline data validation.',
                    confidence: 0.65,
                    category: 'OEE',
                    model_type: 'Productivity',
                    priority: 'Medium',
                },
            ],
            analysis: 'Total modeled value: $9.62M. Quality cost reduction (scrap + rework) accounts for 57% of total value. Warranty reduction is highest-risk component.',
        },
    },
];
//# sourceMappingURL=financial-modeling-agent.js.map