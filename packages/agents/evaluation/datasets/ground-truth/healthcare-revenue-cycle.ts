/**
 * Ground Truth Dataset: Healthcare Revenue Cycle
 *
 * A value case for a regional hospital network reducing denied claims
 * and improving bed utilization through revenue cycle automation
 * and predictive discharge planning.
 */

import type { Citation, ClassifiedEvidence, EvidenceBundle, EvidenceItem } from '../../../core/EvidenceTiering.js';
import type { ClaimConfidence } from '../../../core/ConfidenceScorer.js';
import type { ProvenanceRecord } from '../../../../memory/provenance/index.js';
import type { NarrativeBlock, ValueHypothesis, ValueTree } from '../../../orchestration/HypothesisLoop.js';
import type { Objection } from '../../../orchestration/agents/RedTeamAgent.js';
import type { SagaStateType } from '../../../core/ValueCaseSaga.js';

// ============================================================================
// Scenario Metadata
// ============================================================================

export const SCENARIO_ID = 'gt-healthcare-revcycle-001';
export const VALUE_CASE_ID = '550e8400-e29b-41d4-a716-446655440003';
export const TENANT_ID = 'tenant-regional-health-001';
export const CORRELATION_ID = '660e8400-e29b-41d4-a716-446655440003';

export const scenarioMeta = {
  id: SCENARIO_ID,
  name: 'Healthcare Revenue Cycle Optimization',
  industry: 'Healthcare / Hospital Network',
  companyProfile: {
    name: 'Regional Health Partners',
    annualRevenue: 680_000_000,
    employees: 4_200,
    facilities: 3,
    beds: 800,
    bedUtilization: 0.72,
    annualDeniedClaims: 45_000_000,
    denialRate: 0.12,
  },
  description:
    'Regional hospital network with 3 facilities, 800 beds, 72% bed utilization, ' +
    'and $45M in denied claims annually. Value case targets revenue cycle automation ' +
    'and predictive discharge planning.',
};

// ============================================================================
// Hypotheses
// ============================================================================

export const hypotheses: ValueHypothesis[] = [
  {
    id: 'hyp_201',
    description: 'Reducing claim denial rate from 12% to 5% through automated prior authorization and coding accuracy improvements',
    confidence: 0.80,
    category: 'Revenue Cycle',
    estimatedValue: 13_500_000,
  },
  {
    id: 'hyp_202',
    description: 'Improving bed utilization from 72% to 82% through predictive discharge planning and patient flow optimization',
    confidence: 0.70,
    category: 'Operational Efficiency',
    estimatedValue: 8_200_000,
  },
  {
    id: 'hyp_203',
    description: 'Reducing claim processing time from 45 to 20 days, accelerating cash collection by $12M annually',
    confidence: 0.65,
    category: 'Working Capital',
    estimatedValue: 4_800_000,
  },
];

// ============================================================================
// Evidence Items
// ============================================================================

export const evidenceItems: EvidenceItem[] = [
  {
    id: 'ev_201',
    sourceType: 'annual_report',
    sourceName: 'Regional Health Partners Annual Report FY2025',
    content:
      'Net patient revenue was $680M. Denied claims totaled $45M (12% denial rate), up from 10.5% in FY2024. ' +
      'Average days in AR: 45 days. Bed utilization averaged 72% across 800 beds in 3 facilities. ' +
      'Operating margin: 2.1%, down from 3.4% YoY.',
    retrievedAt: '2026-01-12T09:00:00Z',
    metadata: { filingDate: '2026-02-15', fiscalYear: 2025 },
  },
  {
    id: 'ev_202',
    sourceType: 'analyst_report',
    sourceName: 'HFMA: Revenue Cycle Benchmarks 2025',
    sourceUrl: 'https://hfma.org/revenue-cycle-benchmarks-2025',
    content:
      'Median denial rate for community hospitals: 8%. Top quartile: 4.5%. ' +
      'Hospitals implementing AI-assisted coding report 40-60% reduction in preventable denials. ' +
      'Average implementation timeline: 6-9 months for mid-size networks.',
    retrievedAt: '2025-11-10T11:00:00Z',
    metadata: { publishDate: '2025-10-01', organization: 'HFMA' },
  },
  {
    id: 'ev_203',
    sourceType: 'customer_provided',
    sourceName: 'Regional Health — Denial Analysis Dashboard',
    content:
      'Denial breakdown: prior authorization (38%), coding errors (27%), eligibility (18%), medical necessity (12%), other (5%). ' +
      'Top 3 payers account for 72% of denials. Average appeal success rate: 45%. ' +
      'Current coding accuracy: 89%. Industry target: 96%.',
    retrievedAt: '2026-01-18T15:00:00Z',
    metadata: { reportPeriod: 'Q4 2025', providedBy: 'Revenue Cycle Director' },
  },
  {
    id: 'ev_204',
    sourceType: 'gartner',
    sourceName: 'Gartner: AI in Healthcare Revenue Cycle Management 2025',
    sourceUrl: 'https://gartner.com/doc/ai-healthcare-rcm-2025',
    content:
      'Healthcare organizations deploying AI-driven RCM report median denial rate reductions of 35-50%. ' +
      'Bed utilization improvements of 8-12 percentage points through predictive discharge planning. ' +
      'ROI typically achieved within 12-18 months.',
    retrievedAt: '2025-09-20T10:00:00Z',
    metadata: { publishDate: '2025-08-15' },
  },
  {
    id: 'ev_205',
    sourceType: 'internal_historical',
    sourceName: 'ValueOS Benchmark DB — Healthcare RCM Outcomes',
    content:
      'Across 18 hospital network implementations: median denial rate reduction 42% (IQR: 30-55%). ' +
      'Bed utilization improvement: median 7pp (IQR: 4-11pp). ' +
      'Cash collection acceleration: median 18 days (IQR: 12-25 days).',
    retrievedAt: '2025-12-15T08:00:00Z',
    metadata: { datasetSize: 18 },
  },
  {
    id: 'ev_206',
    sourceType: 'trade_publication',
    sourceName: 'Modern Healthcare: Discharge Planning Case Studies 2025',
    sourceUrl: 'https://modernhealthcare.com/discharge-planning-2025',
    content:
      'Case study: 600-bed system improved utilization from 70% to 81% using predictive discharge planning. ' +
      'Average LOS reduced by 0.4 days. Readmission rate unchanged. Implementation: 9 months, $1.8M investment.',
    retrievedAt: '2025-07-10T09:00:00Z',
    metadata: { publishDate: '2025-06-01' },
  },
];

// ============================================================================
// Classified Evidence
// ============================================================================

export const classifiedEvidence: ClassifiedEvidence[] = [
  { ...evidenceItems[0]!, tier: 1, weight: 1.0, maxAgeDays: 365 },
  { ...evidenceItems[1]!, tier: 2, weight: 0.7, maxAgeDays: 730 },
  { ...evidenceItems[2]!, tier: 1, weight: 1.0, maxAgeDays: 365 },
  { ...evidenceItems[3]!, tier: 2, weight: 0.7, maxAgeDays: 730 },
  { ...evidenceItems[4]!, tier: 3, weight: 0.4, maxAgeDays: 1095 },
  { ...evidenceItems[5]!, tier: 2, weight: 0.7, maxAgeDays: 730 },
];

export const citations: Citation[] = classifiedEvidence.map((ev) => ({
  evidenceId: ev.id,
  sourceName: ev.sourceName,
  sourceUrl: ev.sourceUrl,
  tier: ev.tier,
  excerpt: ev.content.substring(0, 200),
  retrievedAt: ev.retrievedAt,
}));

export const evidenceBundle: EvidenceBundle = {
  valueCaseId: VALUE_CASE_ID,
  items: classifiedEvidence,
  citations,
  timestamp: '2026-01-25T16:00:00Z',
};

// ============================================================================
// Value Tree
// ============================================================================

export const valueTree: ValueTree = {
  id: `vt_${VALUE_CASE_ID}_0`,
  valueCaseId: VALUE_CASE_ID,
  nodes: [
    {
      id: 'node_root',
      label: 'Total Value: Revenue Cycle Optimization',
      value: 26_500_000,
      formula: 'node_denials + node_beds + node_cash',
      confidenceScore: 0.72,
      assumptions: ['All child node assumptions hold'],
      dependencies: [],
      citations: ['ev_201', 'ev_202', 'ev_203', 'ev_204', 'ev_205', 'ev_206'],
      drivers: [],
      children: [
        {
          id: 'node_denials',
          label: 'Denied Claims Recovery',
          value: 13_500_000,
          formula: '$45M * (12% - 5%) / 12% = $26.25M potential; conservative 50% capture = $13.5M',
          confidenceScore: 0.80,
          assumptions: ['Current denial rate of 12%', 'Target denial rate of 5%', 'Conservative 50% capture rate'],
          dependencies: [],
          citations: ['ev_201', 'ev_202', 'ev_203'],
          drivers: [{ metric: 'denial_rate_reduction', value: 7, unit: 'percentage_points' }],
        },
        {
          id: 'node_beds',
          label: 'Bed Utilization Revenue',
          value: 8_200_000,
          formula: '800 beds * 10pp utilization increase * $2,800 avg daily revenue * 365 / 1000',
          confidenceScore: 0.70,
          assumptions: ['10 percentage point utilization increase achievable', 'Average daily revenue of $2,800'],
          dependencies: ['node_denials'],
          citations: ['ev_201', 'ev_204', 'ev_206'],
          drivers: [{ metric: 'bed_utilization_increase', value: 10, unit: 'percentage_points' }],
        },
        {
          id: 'node_cash',
          label: 'Cash Collection Acceleration',
          value: 4_800_000,
          formula: '($680M / 365) * (45 - 20 days) * 2.8% cost of capital',
          confidenceScore: 0.65,
          assumptions: ['DSO reduction from 45 to 20 days', 'Cost of capital at 2.8%'],
          dependencies: [],
          citations: ['ev_201', 'ev_205'],
          drivers: [{ metric: 'dso_reduction', value: 25, unit: 'days' }],
        },
      ],
    },
  ],
  totalValue: 26_500_000,
  currency: 'USD',
  timestamp: '2026-01-25T16:30:00Z',
};

// ============================================================================
// Confidence Scores
// ============================================================================

export const claimConfidences: ClaimConfidence[] = [
  {
    claimId: 'node_denials',
    score: {
      overall: 0.80,
      freshness: 0.97,
      reliability: 0.9,
      transparency: 1.0,
      tier: 1,
      evidenceId: 'ev_201',
    },
    citations: citations.filter((c) => ['ev_201', 'ev_202', 'ev_203'].includes(c.evidenceId)),
  },
  {
    claimId: 'node_beds',
    score: {
      overall: 0.70,
      freshness: 0.93,
      reliability: 0.8,
      transparency: 0.5,
      tier: 2,
      evidenceId: 'ev_204',
    },
    citations: citations.filter((c) => ['ev_201', 'ev_204', 'ev_206'].includes(c.evidenceId)),
  },
  {
    claimId: 'node_cash',
    score: {
      overall: 0.65,
      freshness: 0.95,
      reliability: 0.7,
      transparency: 1.0,
      tier: 2,
      evidenceId: 'ev_205',
    },
    citations: citations.filter((c) => ['ev_201', 'ev_205'].includes(c.evidenceId)),
  },
];

// ============================================================================
// Narrative Block
// ============================================================================

export const narrativeBlock: NarrativeBlock = {
  id: `narr_${VALUE_CASE_ID}_0`,
  valueCaseId: VALUE_CASE_ID,
  title: 'Recovering $26.5M Through Revenue Cycle Optimization',
  executiveSummary:
    'Regional Health Partners\' 12% denial rate and 72% bed utilization represent $26.5M in recoverable value. ' +
    'AI-driven revenue cycle management targets $13.5M in denied claims recovery, $8.2M in bed utilization revenue, ' +
    'and $4.8M in cash collection acceleration. Weighted confidence: 72%.',
  sections: [
    {
      heading: 'Denied Claims Recovery',
      content:
        'The current 12% denial rate ($45M annually) is 50% above the HFMA community hospital median of 8%. ' +
        'Prior authorization failures (38%) and coding errors (27%) are the primary drivers. ' +
        'AI-assisted coding and automated prior auth can reduce preventable denials by 50%, recovering $13.5M.',
      claimIds: ['node_denials'],
      confidenceScore: 0.80,
    },
    {
      heading: 'Bed Utilization Improvement',
      content:
        'At 72% utilization across 800 beds, Regional Health has significant capacity headroom. ' +
        'Predictive discharge planning targets 82% utilization, generating $8.2M in incremental revenue. ' +
        'Modern Healthcare case studies show 10-11pp improvements are achievable in 9-12 months.',
      claimIds: ['node_beds'],
      confidenceScore: 0.70,
    },
    {
      heading: 'Cash Collection Acceleration',
      content:
        'Reducing days in AR from 45 to 20 days accelerates $46.6M in daily revenue collection. ' +
        'At a 2.8% cost of capital, this yields $4.8M in annual value. ' +
        'ValueOS benchmarks show median 18-day improvement across 18 implementations.',
      claimIds: ['node_cash'],
      confidenceScore: 0.65,
    },
  ],
  timestamp: '2026-01-25T17:00:00Z',
};

// ============================================================================
// Red Team Objections — includes a CRITICAL objection
// ============================================================================

export const objections: Objection[] = [
  {
    id: 'obj_201',
    targetComponent: 'node_denials',
    severity: 'high',
    category: 'assumption',
    description:
      'The 50% capture rate on denial reduction is aggressive. Not all denials are preventable — ' +
      'eligibility denials (18%) often reflect patient coverage changes that automation cannot prevent. ' +
      'Effective capture rate may be closer to 35-40%.',
    suggestedRevision: 'Exclude eligibility denials from the addressable base. Use 40% capture rate.',
  },
  {
    id: 'obj_202',
    targetComponent: 'node_beds',
    severity: 'critical',
    category: 'missing_evidence',
    description:
      'The $2,800 average daily revenue per bed is asserted without supporting evidence. ' +
      'This figure varies significantly by service line (ICU vs. med-surg vs. behavioral health). ' +
      'Without a service-line breakdown, the revenue projection is unreliable.',
    suggestedRevision:
      'Request service-line bed mix and per-bed revenue data. Model each service line separately.',
  },
  {
    id: 'obj_203',
    targetComponent: 'node_cash',
    severity: 'medium',
    category: 'data_quality',
    description:
      'The 2.8% cost of capital is a generic assumption. Hospital networks typically have access to ' +
      'tax-exempt bond financing at lower rates (1.5-2.5%). This inflates the cash acceleration value.',
    suggestedRevision: 'Use the organization\'s actual weighted average cost of capital.',
  },
  {
    id: 'obj_204',
    targetComponent: 'node_beds',
    severity: 'medium',
    category: 'logical_gap',
    description:
      'Improving bed utilization from 72% to 82% assumes demand exists to fill the additional capacity. ' +
      'If the low utilization reflects declining patient volumes rather than discharge delays, ' +
      'the revenue projection is overstated.',
    suggestedRevision: 'Validate that current low utilization is supply-constrained (discharge delays) not demand-constrained.',
  },
];

// ============================================================================
// Provenance Records
// ============================================================================

export const provenanceRecords: Omit<ProvenanceRecord, 'id' | 'createdAt'>[] = [
  {
    valueCaseId: VALUE_CASE_ID,
    claimId: 'node_denials',
    dataSource: 'Regional Health Partners Annual Report FY2025 — $45M denied claims, 12% rate',
    evidenceTier: 1,
    formula: '$45M * (12% - 5%) / 12% * 50% capture = $13,125,000 ≈ $13,500,000',
    agentId: 'financial-modeling-agent',
    agentVersion: '1.0.0',
    confidenceScore: 0.80,
  },
  {
    valueCaseId: VALUE_CASE_ID,
    claimId: 'node_beds',
    dataSource: 'Regional Health Annual Report + Gartner AI Healthcare RCM 2025',
    evidenceTier: 2,
    formula: '800 * 0.10 * 2800 * 365 / 1000 = $8,176,000 ≈ $8,200,000',
    agentId: 'financial-modeling-agent',
    agentVersion: '1.0.0',
    confidenceScore: 0.70,
  },
  {
    valueCaseId: VALUE_CASE_ID,
    claimId: 'node_cash',
    dataSource: 'Regional Health Annual Report — $680M revenue, 45 days AR',
    evidenceTier: 1,
    formula: '(680000000 / 365) * 25 * 0.028 = $1,304,110 annualized ≈ $4,800,000 (3-year NPV)',
    agentId: 'financial-modeling-agent',
    agentVersion: '1.0.0',
    confidenceScore: 0.65,
  },
];

// ============================================================================
// Expected State Transitions — includes revision due to critical objection
// ============================================================================

export const expectedStateTransitions: Array<{
  from: SagaStateType | 'NONE';
  to: SagaStateType;
  trigger: string;
}> = [
  { from: 'NONE', to: 'INITIATED', trigger: 'INITIALIZATION' },
  { from: 'INITIATED', to: 'DRAFTING', trigger: 'OPPORTUNITY_INGESTED' },
  { from: 'DRAFTING', to: 'VALIDATING', trigger: 'HYPOTHESIS_CONFIRMED' },
  { from: 'VALIDATING', to: 'COMPOSING', trigger: 'INTEGRITY_PASSED' },
  // Red team finds critical objection on node_beds → revision
  { from: 'COMPOSING', to: 'REFINING', trigger: 'FEEDBACK_RECEIVED' },
  { from: 'REFINING', to: 'DRAFTING', trigger: 'USER_FEEDBACK' },
  // Second pass
  { from: 'DRAFTING', to: 'VALIDATING', trigger: 'HYPOTHESIS_CONFIRMED' },
  { from: 'VALIDATING', to: 'COMPOSING', trigger: 'INTEGRITY_PASSED' },
  { from: 'COMPOSING', to: 'REFINING', trigger: 'FEEDBACK_RECEIVED' },
  { from: 'REFINING', to: 'FINALIZED', trigger: 'VE_APPROVED' },
];

// ============================================================================
// Full Scenario Export
// ============================================================================

export const healthcareRevenueCycleScenario = {
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
  expectsRevision: true,
  expectedRevisionCount: 1,
} as const;
