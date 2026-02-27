"use strict";
/**
 * Evaluation Dataset: Red Team Agent
 *
 * Golden input/output pairs for validating the RedTeamAgent.
 * Tests adversarial analysis quality, objection categorization,
 * severity assignment, and suggested revisions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.redTeamEvalCases = exports.RedTeamEvalCaseSchema = void 0;
const zod_1 = require("zod");
exports.RedTeamEvalCaseSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    input: zod_1.z.object({
        valueCaseId: zod_1.z.string(),
        tenantId: zod_1.z.string(),
        valueTree: zod_1.z.record(zod_1.z.unknown()),
        narrativeBlock: zod_1.z.record(zod_1.z.unknown()),
        evidenceBundle: zod_1.z.record(zod_1.z.unknown()),
        idempotencyKey: zod_1.z.string().uuid(),
    }),
    expectations: zod_1.z.object({
        minObjections: zod_1.z.number().int().min(1),
        maxObjections: zod_1.z.number().int().optional(),
        /** Whether this case should produce at least one critical objection */
        expectsCritical: zod_1.z.boolean(),
        requiredCategories: zod_1.z.array(zod_1.z.enum([
            'assumption', 'data_quality', 'math_error', 'missing_evidence', 'logical_gap',
        ])).optional(),
        /** Specific components that should be targeted */
        targetComponents: zod_1.z.array(zod_1.z.string()).optional(),
    }),
    mockResponse: zod_1.z.object({
        objections: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(),
            targetComponent: zod_1.z.string(),
            severity: zod_1.z.enum(['low', 'medium', 'high', 'critical']),
            category: zod_1.z.enum(['assumption', 'data_quality', 'math_error', 'missing_evidence', 'logical_gap']),
            description: zod_1.z.string(),
            suggestedRevision: zod_1.z.string().optional(),
        })),
        summary: zod_1.z.string(),
        hasCritical: zod_1.z.boolean(),
    }),
});
exports.redTeamEvalCases = [
    {
        id: 'rt-eval-001',
        name: 'SaaS DSO case — no critical objections',
        input: {
            valueCaseId: '550e8400-e29b-41d4-a716-446655440001',
            tenantId: 'tenant-acme-001',
            valueTree: {
                totalValue: 4_942_500,
                nodes: [
                    { id: 'node_wc', label: 'Working Capital Freed', value: 3_950_000, formula: '(62-45)/365*85000000' },
                    { id: 'node_fte', label: 'FTE Savings', value: 312_500, formula: '2.5*125000' },
                    { id: 'node_bd', label: 'Bad Debt Reduction', value: 680_000, formula: '1700000*0.40' },
                ],
            },
            narrativeBlock: {
                title: 'Unlocking $4.9M in Value Through AR Automation',
                executiveSummary: 'DSO reduction from 62 to 45 days frees $3.95M in working capital.',
            },
            evidenceBundle: {
                items: [
                    { id: 'ev_001', sourceType: '10-K', tier: 1, confidence: 0.92 },
                    { id: 'ev_002', sourceType: 'analyst_report', tier: 2, confidence: 0.85 },
                    { id: 'ev_004', sourceType: 'customer_provided', tier: 1, confidence: 0.78 },
                    { id: 'ev_005', sourceType: 'internal_historical', tier: 3, confidence: 0.70 },
                ],
            },
            idempotencyKey: 'aa0e8400-e29b-41d4-a716-446655440001',
        },
        expectations: {
            minObjections: 2,
            maxObjections: 5,
            expectsCritical: false,
            requiredCategories: ['assumption', 'data_quality'],
            targetComponents: ['node_wc', 'node_bd'],
        },
        mockResponse: {
            objections: [
                {
                    id: 'obj_001',
                    targetComponent: 'node_wc',
                    severity: 'medium',
                    category: 'assumption',
                    description: 'The 17-day DSO reduction assumes full adoption within 12 months. Enterprise accounts may resist changing payment processes.',
                    suggestedRevision: 'Model phased adoption: 60% in months 1-6, 90% by month 12.',
                },
                {
                    id: 'obj_002',
                    targetComponent: 'node_bd',
                    severity: 'high',
                    category: 'data_quality',
                    description: 'The $1.7M write-off baseline includes a one-time $400K customer bankruptcy. This inflates the reduction target.',
                    suggestedRevision: 'Normalize baseline by excluding one-time write-off. Use 30% reduction rate.',
                },
                {
                    id: 'obj_003',
                    targetComponent: 'node_fte',
                    severity: 'low',
                    category: 'missing_evidence',
                    description: 'The 2.5 FTE figure is self-reported without time-tracking data.',
                },
            ],
            summary: 'Value case is directionally sound. Primary risks: adoption timeline for DSO reduction and inflated bad debt baseline.',
            hasCritical: false,
        },
    },
    {
        id: 'rt-eval-002',
        name: 'Manufacturing yield case — critical objection triggers revision',
        input: {
            valueCaseId: '550e8400-e29b-41d4-a716-446655440002',
            tenantId: 'tenant-precision-001',
            valueTree: {
                totalValue: 9_770_000,
                nodes: [
                    { id: 'node_scrap', label: 'Scrap Reduction', value: 3_520_000, formula: '8800000*0.40' },
                    { id: 'node_rework', label: 'Rework Reduction', value: 1_925_000, formula: '5500000*0.35' },
                    { id: 'node_warranty', label: 'Warranty Reduction', value: 2_520_000, formula: '4200000*0.60' },
                    { id: 'node_downtime', label: 'Downtime Reduction', value: 1_650_000, formula: 'estimated' },
                ],
            },
            narrativeBlock: {
                title: 'Driving $9.8M in Quality-Driven Value',
                executiveSummary: 'Predictive quality analytics improves yield from 87% to 94%.',
            },
            evidenceBundle: {
                items: [
                    { id: 'ev_101', sourceType: 'annual_report', tier: 1, confidence: 0.90 },
                    { id: 'ev_102', sourceType: 'gartner', tier: 2, confidence: 0.82 },
                    { id: 'ev_103', sourceType: 'customer_provided', tier: 1, confidence: 0.88 },
                    { id: 'ev_105', sourceType: 'internal_historical', tier: 3, confidence: 0.70 },
                ],
            },
            idempotencyKey: 'aa0e8400-e29b-41d4-a716-446655440002',
        },
        expectations: {
            minObjections: 2,
            maxObjections: 5,
            expectsCritical: true,
            requiredCategories: ['assumption', 'missing_evidence'],
            targetComponents: ['node_warranty', 'node_downtime'],
        },
        mockResponse: {
            objections: [
                {
                    id: 'obj_101',
                    targetComponent: 'node_warranty',
                    severity: 'critical',
                    category: 'assumption',
                    description: 'The 60% escape reduction assumes analytics can detect all defect categories. Material defects (19%) originate upstream and are not detectable by production-line sensors.',
                    suggestedRevision: 'Reduce escape reduction to 45% or add incoming inspection analytics as separate line item.',
                },
                {
                    id: 'obj_102',
                    targetComponent: 'node_downtime',
                    severity: 'high',
                    category: 'missing_evidence',
                    description: 'The $1.65M downtime reduction has no direct evidence. Baseline downtime cost is not provided in any evidence source.',
                    suggestedRevision: 'Request unplanned downtime logs. If unavailable, remove line item or flag as Tier 3.',
                },
                {
                    id: 'obj_103',
                    targetComponent: 'node_scrap',
                    severity: 'medium',
                    category: 'data_quality',
                    description: 'The 40% scrap reduction is at the upper end of the Gartner range and above the benchmark median of 38%.',
                    suggestedRevision: 'Use 35% or provide justification for the higher rate.',
                },
            ],
            summary: 'Critical issue: warranty reduction assumes full defect coverage but material defects are upstream. ' +
                'Downtime reduction lacks baseline data. Scrap reduction rate is optimistic.',
            hasCritical: true,
        },
    },
];
//# sourceMappingURL=red-team-agent.js.map