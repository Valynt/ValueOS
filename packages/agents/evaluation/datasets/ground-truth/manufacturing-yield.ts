/**
 * Ground Truth Dataset: Manufacturing Yield Improvement
 *
 * A value case for a discrete manufacturing company improving
 * first-pass yield through predictive quality analytics.
 * Exercises different evidence tiers and a critical red-team objection
 * that triggers a revision cycle.
 */

import type { EvidenceItem, EvidenceBundle, ClassifiedEvidence, Citation } from '../../../core/EvidenceTiering.js';
import type { ClaimConfidence } from '../../../core/ConfidenceScorer.js';
import type { ProvenanceRecord } from '../../../../memory/provenance/index.js';
import type { ValueTree, NarrativeBlock, ValueHypothesis } from '../../../orchestration/HypothesisLoop.js';
import type { Objection } from '../../../orchestration/agents/RedTeamAgent.js';
import type { SagaStateType } from '../../../core/ValueCaseSaga.js';

// ============================================================================
// Scenario Metadata
// ============================================================================

export const SCENARIO_ID = 'gt-mfg-yield-001';
export const VALUE_CASE_ID = '550e8400-e29b-41d4-a716-446655440002';
export const TENANT_ID = 'tenant-precision-mfg-001';
export const CORRELATION_ID = '660e8400-e29b-41d4-a716-446655440002';

export const scenarioMeta = {
  id: SCENARIO_ID,
  name: 'Manufacturing First-Pass Yield Improvement',
  industry: 'Discrete Manufacturing / Automotive Parts',
  companyProfile: {
    name: 'Precision Parts Co.',
    annualRevenue: 220_000_000,
    employees: 1_200,
    currentYield: 0.87,
    targetYield: 0.94,
    annualScrapCost: 8_800_000,
    annualReworkCost: 5_500_000,
  },
  description:
    'Automotive parts manufacturer with 87% first-pass yield. Predictive quality analytics ' +
    'targets 94% yield, reducing scrap and rework costs by ~$7.5M annually.',
};

// ============================================================================
// Hypotheses
// ============================================================================

export const hypotheses: ValueHypothesis[] = [
  {
    id: 'hyp_101',
    description: 'Improving first-pass yield from 87% to 94% through real-time SPC and predictive defect detection',
    confidence: 0.78,
    category: 'Quality Improvement',
    estimatedValue: 5_720_000,
  },
  {
    id: 'hyp_102',
    description: 'Reducing unplanned downtime by 25% through predictive maintenance on CNC machines',
    confidence: 0.72,
    category: 'OEE Improvement',
    estimatedValue: 1_650_000,
  },
  {
    id: 'hyp_103',
    description: 'Reducing customer quality escapes by 60%, avoiding warranty claims and chargebacks',
    confidence: 0.65,
    category: 'Customer Retention',
    estimatedValue: 2_400_000,
  },
];

// ============================================================================
// Evidence Items
// ============================================================================

export const evidenceItems: EvidenceItem[] = [
  {
    id: 'ev_101',
    sourceType: 'annual_report',
    sourceName: 'Precision Parts Co. Annual Report FY2025',
    content:
      'Cost of quality (CoQ) represented 6.5% of revenue ($14.3M), comprising scrap ($8.8M), ' +
      'rework ($5.5M), and warranty claims ($4.2M). First-pass yield averaged 87% across 3 production lines.',
    retrievedAt: '2026-01-10T08:00:00Z',
    metadata: { filingDate: '2026-01-30', fiscalYear: 2025 },
  },
  {
    id: 'ev_102',
    sourceType: 'gartner',
    sourceName: 'Gartner: Predictive Quality Analytics in Manufacturing 2025',
    sourceUrl: 'https://gartner.com/doc/pqa-manufacturing-2025',
    content:
      'Manufacturers deploying predictive quality analytics report median yield improvements of 5-8 percentage points. ' +
      'ROI typically achieved within 9-14 months. Scrap reduction ranges from 30-50% in discrete manufacturing.',
    retrievedAt: '2025-10-15T11:00:00Z',
    metadata: { publishDate: '2025-09-01' },
  },
  {
    id: 'ev_103',
    sourceType: 'customer_provided',
    sourceName: 'Precision Parts — Production Quality Dashboard Export',
    content:
      'Line 1: 89% yield, 42 defects/1000 units. Line 2: 85% yield, 68 defects/1000 units. ' +
      'Line 3: 87% yield, 51 defects/1000 units. Top defect categories: dimensional (38%), surface finish (27%), ' +
      'material (19%), assembly (16%). CNC machine age: 3-12 years.',
    retrievedAt: '2026-01-18T14:00:00Z',
    metadata: { reportPeriod: 'Q4 2025' },
  },
  {
    id: 'ev_104',
    sourceType: 'trade_publication',
    sourceName: 'IndustryWeek: Predictive Quality Case Studies 2025',
    sourceUrl: 'https://industryweek.com/pq-case-studies-2025',
    content:
      'Case study: Tier 1 automotive supplier achieved 92% first-pass yield (from 84%) after 18-month ' +
      'predictive quality deployment. Scrap reduced by 42%, rework by 35%. Investment: $2.1M, payback: 11 months.',
    retrievedAt: '2025-08-20T09:00:00Z',
    metadata: { publishDate: '2025-07-15' },
  },
  {
    id: 'ev_105',
    sourceType: 'internal_historical',
    sourceName: 'ValueOS Benchmark DB — Manufacturing Quality Outcomes',
    content:
      'Across 23 discrete manufacturing implementations: median yield improvement 5.2pp (IQR: 3.8-7.1pp). ' +
      'Scrap reduction: median 38% (IQR: 28-48%). Time to ROI: median 12 months.',
    retrievedAt: '2025-12-20T10:00:00Z',
    metadata: { datasetSize: 23 },
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
  timestamp: '2026-01-25T14:00:00Z',
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
      label: 'Total Value: Predictive Quality Analytics',
      value: 9_770_000,
      formula: 'node_scrap + node_rework + node_warranty',
      confidenceScore: 0.72,
      assumptions: ['All child node assumptions hold'],
      dependencies: [],
      citations: ['ev_101', 'ev_102', 'ev_103', 'ev_104', 'ev_105'],
      drivers: [],
      children: [
        {
          id: 'node_scrap',
          label: 'Scrap Cost Reduction',
          value: 3_520_000,
          formula: '$8,800,000 * 0.40 scrap reduction rate',
          confidenceScore: 0.78,
          assumptions: ['40% scrap reduction achievable with predictive analytics'],
          dependencies: [],
          citations: ['ev_101', 'ev_102', 'ev_105'],
          drivers: [{ metric: 'scrap_reduction_rate', value: 40, unit: 'percent' }],
        },
        {
          id: 'node_rework',
          label: 'Rework Cost Reduction',
          value: 1_925_000,
          formula: '$5,500,000 * 0.35 rework reduction rate',
          confidenceScore: 0.72,
          assumptions: ['35% rework reduction achievable'],
          dependencies: ['node_scrap'],
          citations: ['ev_101', 'ev_104'],
          drivers: [{ metric: 'rework_reduction_rate', value: 35, unit: 'percent' }],
        },
        {
          id: 'node_warranty',
          label: 'Warranty Claim Reduction',
          value: 2_520_000,
          formula: '$4,200,000 * 0.60 escape reduction rate',
          confidenceScore: 0.58,
          assumptions: ['60% escape reduction rate from improved quality'],
          dependencies: ['node_scrap'],
          citations: ['ev_101', 'ev_103'],
          drivers: [{ metric: 'escape_reduction_rate', value: 60, unit: 'percent' }],
        },
        {
          id: 'node_downtime',
          label: 'Unplanned Downtime Reduction',
          value: 1_650_000,
          formula: 'Estimated 25% reduction in unplanned downtime costs',
          confidenceScore: 0.65,
          assumptions: ['25% downtime reduction from predictive maintenance'],
          dependencies: [],
          citations: ['ev_103'],
          drivers: [{ metric: 'downtime_reduction', value: 25, unit: 'percent' }],
        },
      ],
    },
  ],
  totalValue: 9_770_000,
  currency: 'USD',
  timestamp: '2026-01-25T14:30:00Z',
};

// ============================================================================
// Confidence Scores
// ============================================================================

export const claimConfidences: ClaimConfidence[] = [
  {
    claimId: 'node_scrap',
    score: {
      overall: 0.78,
      freshness: 0.97,
      reliability: 0.9,
      transparency: 1.0,
      tier: 1,
      evidenceId: 'ev_101',
    },
    citations: citations.filter((c) => ['ev_101', 'ev_102', 'ev_105'].includes(c.evidenceId)),
  },
  {
    claimId: 'node_rework',
    score: {
      overall: 0.72,
      freshness: 0.95,
      reliability: 0.85,
      transparency: 1.0,
      tier: 1,
      evidenceId: 'ev_101',
    },
    citations: citations.filter((c) => ['ev_101', 'ev_104'].includes(c.evidenceId)),
  },
  {
    claimId: 'node_warranty',
    score: {
      overall: 0.58,
      freshness: 0.97,
      reliability: 0.85,
      transparency: 0.5,
      tier: 1,
      evidenceId: 'ev_101',
    },
    citations: citations.filter((c) => ['ev_101', 'ev_103'].includes(c.evidenceId)),
  },
  {
    claimId: 'node_downtime',
    score: {
      overall: 0.65,
      freshness: 0.98,
      reliability: 1.0,
      transparency: 0.5,
      tier: 1,
      evidenceId: 'ev_103',
    },
    citations: citations.filter((c) => c.evidenceId === 'ev_103'),
  },
];

// ============================================================================
// Narrative Block
// ============================================================================

export const narrativeBlock: NarrativeBlock = {
  id: `narr_${VALUE_CASE_ID}_0`,
  valueCaseId: VALUE_CASE_ID,
  title: 'Driving $9.8M in Quality-Driven Value Through Predictive Analytics',
  executiveSummary:
    'Precision Parts\' 87% first-pass yield results in $14.3M annual cost of quality. ' +
    'Predictive quality analytics can improve yield to 94%, reducing scrap by $3.5M, rework by $1.9M, ' +
    'and warranty claims by $2.5M. Combined with $1.65M in downtime reduction, total annual value is $9.8M.',
  sections: [
    {
      heading: 'Scrap and Rework Reduction',
      content:
        'Current scrap costs of $8.8M and rework costs of $5.5M represent the largest quality cost drivers. ' +
        'Predictive defect detection targets 40% scrap reduction and 35% rework reduction, ' +
        'consistent with Gartner benchmarks (30-50% scrap reduction) and IndustryWeek case studies.',
      claimIds: ['node_scrap', 'node_rework'],
      confidenceScore: 0.75,
    },
    {
      heading: 'Customer Quality and Warranty',
      content:
        'Reducing quality escapes by 60% addresses $4.2M in annual warranty claims. ' +
        'This is the highest-impact but lowest-confidence component, as escape reduction ' +
        'depends on defect detection coverage across all failure modes.',
      claimIds: ['node_warranty'],
      confidenceScore: 0.58,
    },
    {
      heading: 'Equipment Uptime',
      content:
        'Predictive maintenance on CNC machines (aged 3-12 years) targets 25% reduction in unplanned downtime, ' +
        'valued at $1.65M annually.',
      claimIds: ['node_downtime'],
      confidenceScore: 0.65,
    },
  ],
  timestamp: '2026-01-25T15:00:00Z',
};

// ============================================================================
// Red Team Objections — includes a CRITICAL objection to trigger revision
// ============================================================================

export const objections: Objection[] = [
  {
    id: 'obj_101',
    targetComponent: 'node_warranty',
    severity: 'critical',
    category: 'assumption',
    description:
      'The 60% quality escape reduction assumes predictive analytics can detect all defect categories equally. ' +
      'However, material defects (19% of total) originate from incoming raw material variation, which is upstream ' +
      'of the production line sensors. The model should exclude material-related escapes from the reduction target.',
    suggestedRevision:
      'Reduce escape reduction rate to 45% (excluding material defects) or add incoming inspection analytics as a separate line item.',
  },
  {
    id: 'obj_102',
    targetComponent: 'node_downtime',
    severity: 'high',
    category: 'missing_evidence',
    description:
      'The $1.65M downtime reduction has no direct evidence. The unplanned downtime baseline cost is not provided ' +
      'in any evidence source. The 25% reduction rate is asserted without supporting data.',
    suggestedRevision:
      'Request unplanned downtime logs from the customer. If unavailable, remove this line item or flag as Tier 3 estimate.',
  },
  {
    id: 'obj_103',
    targetComponent: 'node_scrap',
    severity: 'medium',
    category: 'data_quality',
    description:
      'The 40% scrap reduction rate is at the upper end of the Gartner range (30-50%) and above the ValueOS ' +
      'benchmark median of 38%. Using the upper bound without justification introduces optimism bias.',
    suggestedRevision: 'Use 35% (closer to benchmark median) or provide justification for the higher rate.',
  },
];

// ============================================================================
// Provenance Records
// ============================================================================

export const provenanceRecords: Omit<ProvenanceRecord, 'id' | 'createdAt'>[] = [
  {
    valueCaseId: VALUE_CASE_ID,
    claimId: 'node_scrap',
    dataSource: 'Precision Parts Annual Report FY2025 — $8.8M scrap cost',
    evidenceTier: 1,
    formula: '8800000 * 0.40 = 3,520,000',
    agentId: 'financial-modeling-agent',
    agentVersion: '1.0.0',
    confidenceScore: 0.78,
  },
  {
    valueCaseId: VALUE_CASE_ID,
    claimId: 'node_rework',
    dataSource: 'Precision Parts Annual Report FY2025 — $5.5M rework cost',
    evidenceTier: 1,
    formula: '5500000 * 0.35 = 1,925,000',
    agentId: 'financial-modeling-agent',
    agentVersion: '1.0.0',
    confidenceScore: 0.72,
  },
  {
    valueCaseId: VALUE_CASE_ID,
    claimId: 'node_warranty',
    dataSource: 'Precision Parts Annual Report FY2025 — $4.2M warranty claims',
    evidenceTier: 1,
    formula: '4200000 * 0.60 = 2,520,000',
    agentId: 'financial-modeling-agent',
    agentVersion: '1.0.0',
    confidenceScore: 0.58,
  },
  {
    valueCaseId: VALUE_CASE_ID,
    claimId: 'node_downtime',
    dataSource: 'Estimated from production dashboard — no direct evidence',
    evidenceTier: 3,
    formula: 'Estimated 25% of unplanned downtime cost (baseline not provided)',
    agentId: 'financial-modeling-agent',
    agentVersion: '1.0.0',
    confidenceScore: 0.65,
  },
];

// ============================================================================
// Expected State Transitions — includes revision cycle due to critical objection
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
  // Red team finds critical objection → revision cycle
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

export const manufacturingYieldScenario = {
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
  /** This scenario triggers a revision cycle due to obj_101 (critical) */
  expectsRevision: true,
  expectedRevisionCount: 1,
} as const;
