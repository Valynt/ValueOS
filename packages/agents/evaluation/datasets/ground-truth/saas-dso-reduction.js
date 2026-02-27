/**
 * Ground Truth Dataset: SaaS DSO Reduction
 *
 * A complete value case scenario for a mid-market SaaS company
 * reducing Days Sales Outstanding (DSO) through accounts receivable automation.
 * Based on realistic financial data patterns from public SaaS companies.
 */
// ============================================================================
// Scenario Metadata
// ============================================================================
export const SCENARIO_ID = 'gt-saas-dso-001';
export const VALUE_CASE_ID = '550e8400-e29b-41d4-a716-446655440001';
export const TENANT_ID = 'tenant-acme-corp-001';
export const CORRELATION_ID = '660e8400-e29b-41d4-a716-446655440001';
export const scenarioMeta = {
    id: SCENARIO_ID,
    name: 'SaaS DSO Reduction via AR Automation',
    industry: 'SaaS / B2B Software',
    companyProfile: {
        name: 'Acme Cloud Inc.',
        annualRevenue: 85_000_000,
        employees: 450,
        currentDSO: 62,
        targetDSO: 45,
        arBalance: 14_400_000,
    },
    description: 'Mid-market SaaS company with $85M ARR experiencing cash flow pressure from 62-day DSO. ' +
        'Value case proposes AR automation to reduce DSO to 45 days, freeing ~$4M in working capital.',
};
// ============================================================================
// Hypotheses (Step 1 output)
// ============================================================================
export const hypotheses = [
    {
        id: 'hyp_001',
        description: 'Reducing DSO from 62 to 45 days through automated invoice delivery and payment reminders',
        confidence: 0.82,
        category: 'Working Capital Optimization',
        estimatedValue: 3_950_000,
    },
    {
        id: 'hyp_002',
        description: 'Eliminating manual AR reconciliation effort, saving 2.5 FTE in finance operations',
        confidence: 0.75,
        category: 'Operational Efficiency',
        estimatedValue: 312_500,
    },
    {
        id: 'hyp_003',
        description: 'Reducing bad debt write-offs by 40% through proactive collection workflows',
        confidence: 0.68,
        category: 'Revenue Protection',
        estimatedValue: 680_000,
    },
];
// ============================================================================
// Evidence Items (Step 3 input)
// ============================================================================
export const evidenceItems = [
    {
        id: 'ev_001',
        sourceType: '10-K',
        sourceName: 'Acme Cloud Inc. 10-K FY2025',
        sourceUrl: 'https://sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=ACME',
        content: 'Accounts receivable, net of allowance for doubtful accounts of $1.7M, was $14.4M as of December 31, 2025. ' +
            'Days Sales Outstanding was approximately 62 days, compared to 58 days in the prior year. ' +
            'The increase was primarily due to expansion into enterprise accounts with longer payment terms.',
        retrievedAt: '2026-01-15T10:00:00Z',
        metadata: { filingDate: '2026-02-10', fiscalYear: 2025 },
    },
    {
        id: 'ev_002',
        sourceType: 'analyst_report',
        sourceName: 'Gartner: AR Automation Market Guide 2025',
        sourceUrl: 'https://gartner.com/doc/ar-automation-2025',
        content: 'Organizations implementing AR automation solutions report median DSO reductions of 15-20 days within 12 months. ' +
            'Top-quartile performers achieve 25+ day reductions. Average implementation timeline is 3-6 months for mid-market.',
        retrievedAt: '2025-11-20T14:30:00Z',
        metadata: { publishDate: '2025-10-01', analystFirm: 'Gartner' },
    },
    {
        id: 'ev_003',
        sourceType: 'industry_benchmark',
        sourceName: 'SaaS Capital: 2025 SaaS Benchmarks',
        sourceUrl: 'https://saascapital.com/benchmarks-2025',
        content: 'Median DSO for B2B SaaS companies with $50-100M ARR is 48 days. ' +
            'Top quartile is 35 days. Companies with automated AR processes average 42 days vs 58 days for manual processes.',
        retrievedAt: '2025-12-01T09:00:00Z',
        metadata: { publishDate: '2025-09-15', sampleSize: 312 },
    },
    {
        id: 'ev_004',
        sourceType: 'customer_provided',
        sourceName: 'Acme Cloud Finance Team - AR Aging Report',
        content: 'Current AR aging: 0-30 days: $6.2M (43%), 31-60 days: $4.8M (33%), 61-90 days: $2.1M (15%), 90+ days: $1.3M (9%). ' +
            'Finance team spends approximately 2.5 FTE on manual invoice follow-up and reconciliation. ' +
            'Bad debt write-offs in FY2025: $1.7M (2% of revenue).',
        retrievedAt: '2026-01-20T16:00:00Z',
        metadata: { reportDate: '2026-01-15', providedBy: 'CFO Office' },
    },
    {
        id: 'ev_005',
        sourceType: 'internal_historical',
        sourceName: 'ValueOS Benchmark Database - AR Automation Outcomes',
        content: 'Across 47 mid-market SaaS implementations, average DSO reduction was 14.3 days (std dev: 5.2). ' +
            'FTE savings ranged from 1.5 to 4.0 with median of 2.2. Bad debt reduction averaged 35% (range: 20-55%).',
        retrievedAt: '2026-01-10T08:00:00Z',
        metadata: { datasetSize: 47, lastUpdated: '2025-12-31' },
    },
];
// ============================================================================
// Classified Evidence (after EvidenceTiering)
// ============================================================================
export const classifiedEvidence = [
    { ...evidenceItems[0], tier: 1, weight: 1.0, maxAgeDays: 365 },
    { ...evidenceItems[1], tier: 2, weight: 0.7, maxAgeDays: 730 },
    { ...evidenceItems[2], tier: 2, weight: 0.7, maxAgeDays: 730 },
    { ...evidenceItems[3], tier: 1, weight: 1.0, maxAgeDays: 365 },
    { ...evidenceItems[4], tier: 3, weight: 0.4, maxAgeDays: 1095 },
];
// ============================================================================
// Citations
// ============================================================================
export const citations = classifiedEvidence.map((ev) => ({
    evidenceId: ev.id,
    sourceName: ev.sourceName,
    sourceUrl: ev.sourceUrl,
    tier: ev.tier,
    excerpt: ev.content.substring(0, 200),
    retrievedAt: ev.retrievedAt,
}));
// ============================================================================
// Evidence Bundle
// ============================================================================
export const evidenceBundle = {
    valueCaseId: VALUE_CASE_ID,
    items: classifiedEvidence,
    citations,
    timestamp: '2026-01-25T12:00:00Z',
};
// ============================================================================
// Value Tree (Step 2 output)
// ============================================================================
export const valueTree = {
    id: `vt_${VALUE_CASE_ID}_0`,
    valueCaseId: VALUE_CASE_ID,
    nodes: [
        {
            id: 'node_root',
            label: 'Total Value: AR Automation',
            value: 4_942_500,
            formula: 'node_wc + node_fte + node_bd',
            confidenceScore: 0.76,
            citations: ['ev_001', 'ev_002', 'ev_003', 'ev_004', 'ev_005'],
            children: [
                {
                    id: 'node_wc',
                    label: 'Working Capital Freed',
                    value: 3_950_000,
                    formula: '(currentDSO - targetDSO) / 365 * annualRevenue = (62 - 45) / 365 * 85000000',
                    confidenceScore: 0.82,
                    citations: ['ev_001', 'ev_002', 'ev_003'],
                },
                {
                    id: 'node_fte',
                    label: 'FTE Savings (Finance Ops)',
                    value: 312_500,
                    formula: '2.5 FTE * $125,000 avg loaded cost',
                    confidenceScore: 0.75,
                    citations: ['ev_004'],
                },
                {
                    id: 'node_bd',
                    label: 'Bad Debt Reduction',
                    value: 680_000,
                    formula: '$1,700,000 * 0.40 reduction rate',
                    confidenceScore: 0.68,
                    citations: ['ev_004', 'ev_005'],
                },
            ],
        },
    ],
    totalValue: 4_942_500,
    currency: 'USD',
    timestamp: '2026-01-25T12:30:00Z',
};
// ============================================================================
// Confidence Scores (Step 3 output)
// ============================================================================
export const claimConfidences = [
    {
        claimId: 'node_wc',
        score: {
            overall: 0.82,
            freshness: 0.96,
            reliability: 0.9,
            transparency: 1.0,
            tier: 1,
            evidenceId: 'ev_001',
        },
        citations: citations.filter((c) => ['ev_001', 'ev_002', 'ev_003'].includes(c.evidenceId)),
    },
    {
        claimId: 'node_fte',
        score: {
            overall: 0.75,
            freshness: 0.98,
            reliability: 1.0,
            transparency: 1.0,
            tier: 1,
            evidenceId: 'ev_004',
        },
        citations: citations.filter((c) => c.evidenceId === 'ev_004'),
    },
    {
        claimId: 'node_bd',
        score: {
            overall: 0.68,
            freshness: 0.92,
            reliability: 0.7,
            transparency: 0.5,
            tier: 2,
            evidenceId: 'ev_005',
        },
        citations: citations.filter((c) => ['ev_004', 'ev_005'].includes(c.evidenceId)),
    },
];
// ============================================================================
// Narrative Block (Step 4 output)
// ============================================================================
export const narrativeBlock = {
    id: `narr_${VALUE_CASE_ID}_0`,
    valueCaseId: VALUE_CASE_ID,
    title: 'Unlocking $4.9M in Value Through AR Automation',
    executiveSummary: 'Acme Cloud\'s current 62-day DSO is 14 days above the SaaS industry median of 48 days, ' +
        'tying up approximately $14.4M in receivables. By implementing AR automation, Acme can reduce DSO to 45 days, ' +
        'freeing $3.95M in working capital while saving 2.5 FTE in finance operations and reducing bad debt by $680K annually. ' +
        'Total first-year value: $4.94M with a confidence score of 0.76.',
    sections: [
        {
            heading: 'Working Capital Impact',
            content: 'Reducing DSO from 62 to 45 days releases $3.95M in working capital. ' +
                'This projection is supported by Acme\'s 10-K filing showing $14.4M in AR, ' +
                'Gartner research indicating 15-20 day median DSO reductions, ' +
                'and SaaS Capital benchmarks showing 42-day DSO for automated AR processes.',
            claimIds: ['node_wc'],
            confidenceScore: 0.82,
        },
        {
            heading: 'Operational Efficiency',
            content: 'Acme\'s finance team currently dedicates 2.5 FTE to manual invoice follow-up and reconciliation. ' +
                'AR automation eliminates the majority of this manual effort, yielding $312.5K in annual savings ' +
                'at a loaded cost of $125K per FTE.',
            claimIds: ['node_fte'],
            confidenceScore: 0.75,
        },
        {
            heading: 'Revenue Protection',
            content: 'FY2025 bad debt write-offs totaled $1.7M (2% of revenue). Proactive collection workflows ' +
                'are projected to reduce write-offs by 40%, saving $680K annually. This estimate is conservative ' +
                'relative to the ValueOS benchmark database showing 35% average reduction across 47 implementations.',
            claimIds: ['node_bd'],
            confidenceScore: 0.68,
        },
    ],
    timestamp: '2026-01-25T13:00:00Z',
};
// ============================================================================
// Red Team Objections (Step 5 output)
// ============================================================================
export const objections = [
    {
        id: 'obj_001',
        targetComponent: 'node_wc',
        severity: 'medium',
        category: 'assumption',
        description: 'The 17-day DSO reduction assumes full adoption within 12 months. Enterprise accounts (which drove the DSO increase) ' +
            'may resist changing payment processes. A phased adoption curve would reduce first-year impact by 30-40%.',
        suggestedRevision: 'Model a phased adoption: 60% of AR volume automated in months 1-6, 90% by month 12.',
    },
    {
        id: 'obj_002',
        targetComponent: 'node_bd',
        severity: 'high',
        category: 'data_quality',
        description: 'The 40% bad debt reduction rate is sourced from internal benchmarks (Tier 3) with a wide range (20-55%). ' +
            'The $1.7M write-off figure includes a one-time $400K write-off from a single customer bankruptcy, ' +
            'which inflates the baseline.',
        suggestedRevision: 'Normalize the baseline by excluding the one-time write-off. Use 30% reduction rate (closer to median).',
    },
    {
        id: 'obj_003',
        targetComponent: 'node_fte',
        severity: 'low',
        category: 'missing_evidence',
        description: 'The 2.5 FTE figure is self-reported by the finance team without time-tracking data. ' +
            'Actual time allocation may be lower if staff multitask across AR and other finance functions.',
    },
];
// ============================================================================
// Provenance Records
// ============================================================================
export const provenanceRecords = [
    {
        valueCaseId: VALUE_CASE_ID,
        claimId: 'node_wc',
        dataSource: 'Acme Cloud Inc. 10-K FY2025 — AR balance $14.4M, DSO 62 days',
        evidenceTier: 1,
        formula: '(62 - 45) / 365 * 85000000 = 3,958,904 ≈ 3,950,000',
        agentId: 'financial-modeling-agent',
        agentVersion: '1.0.0',
        confidenceScore: 0.82,
    },
    {
        valueCaseId: VALUE_CASE_ID,
        claimId: 'node_fte',
        dataSource: 'Acme Cloud Finance Team — AR Aging Report, 2.5 FTE on manual AR',
        evidenceTier: 1,
        formula: '2.5 * 125000 = 312,500',
        agentId: 'financial-modeling-agent',
        agentVersion: '1.0.0',
        confidenceScore: 0.75,
    },
    {
        valueCaseId: VALUE_CASE_ID,
        claimId: 'node_bd',
        dataSource: 'Acme Cloud Finance Team — $1.7M bad debt; ValueOS Benchmark DB — 35% avg reduction',
        evidenceTier: 3,
        formula: '1700000 * 0.40 = 680,000',
        agentId: 'financial-modeling-agent',
        agentVersion: '1.0.0',
        confidenceScore: 0.68,
        parentRecordId: undefined,
    },
];
// ============================================================================
// Expected Saga State Transitions
// ============================================================================
export const expectedStateTransitions = [
    { from: 'NONE', to: 'INITIATED', trigger: 'INITIALIZATION' },
    { from: 'INITIATED', to: 'DRAFTING', trigger: 'OPPORTUNITY_INGESTED' },
    { from: 'DRAFTING', to: 'VALIDATING', trigger: 'HYPOTHESIS_CONFIRMED' },
    { from: 'VALIDATING', to: 'COMPOSING', trigger: 'INTEGRITY_PASSED' },
    { from: 'COMPOSING', to: 'REFINING', trigger: 'FEEDBACK_RECEIVED' },
    { from: 'REFINING', to: 'FINALIZED', trigger: 'VE_APPROVED' },
];
// ============================================================================
// Full Scenario Export
// ============================================================================
export const saassDsoReductionScenario = {
    meta: scenarioMeta,
    valueCaseId: VALUE_CASE_ID,
    tenantId: TENANT_ID,
    correlationId: CORRELATION_ID,
    hypotheses,
    evidenceItems,
    classifiedEvidence,
    citations,
    evidenceBundle,
    valueTree,
    claimConfidences,
    narrativeBlock,
    objections,
    provenanceRecords,
    expectedStateTransitions,
};
//# sourceMappingURL=saas-dso-reduction.js.map