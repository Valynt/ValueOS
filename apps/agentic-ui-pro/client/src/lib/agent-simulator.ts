/**
 * Agent Simulator
 *
 * Simulates realistic async agent behavior for the demo environment.
 * Produces the same event shapes as the real backend SSE stream,
 * so the UI components are production-compatible.
 */

import type {
  AgentActivity,
  DefensibilityIssue,
  DefensibilityScore,
  Evidence,
  ExecutiveArtifact,
  HumanCheckpoint,
  MissingDataFlag,
  OpportunityContext,
  PainSignal,
  ScenarioModel,
  SourceClassification,
  Stakeholder,
  StreamToken,
  ValueGraph,
  ValueHypothesis,
  ValueNode,
  WorkflowProgress,
  WorkflowState,
  WorkflowStep,
} from '@/types/agent-ux';

// ─── SEED DATA ────────────────────────────────────────────────────────────────

const SEED_OPPORTUNITY: OpportunityContext = {
  id: 'opp-acme-2024-001',
  name: 'ACME Corp — Enterprise Platform Expansion',
  accountName: 'ACME Corporation',
  industry: 'Manufacturing',
  revenue: 2_400_000_000,
  employees: 12_000,
  stage: 'Proposal',
  closeDate: '2024-06-30',
  stakeholders: [
    { id: 'sh-1', name: 'Sarah Chen', title: 'VP Operations', role: 'champion', sentiment: 'positive', source: 'call-transcript' },
    { id: 'sh-2', name: 'Marcus Webb', title: 'CFO', role: 'economic-buyer', sentiment: 'neutral', source: 'crm' },
    { id: 'sh-3', name: 'Dr. Priya Nair', title: 'CTO', role: 'technical-buyer', sentiment: 'positive', source: 'call-transcript' },
    { id: 'sh-4', name: 'James Holloway', title: 'Procurement Director', role: 'blocker', sentiment: 'negative', source: 'email' },
  ],
  painSignals: [
    { id: 'ps-1', description: 'Manual procurement processes causing 3-4 day delays per cycle', severity: 'critical', source: 'call-transcript', mentionCount: 7, linkedValueDrivers: ['procurement-efficiency'] },
    { id: 'ps-2', description: 'Supplier visibility gaps leading to $2M+ in emergency purchases annually', severity: 'critical', source: 'sec-filing', mentionCount: 3, linkedValueDrivers: ['supply-chain-risk'] },
    { id: 'ps-3', description: 'Compliance reporting requires 40+ hours per quarter of manual effort', severity: 'significant', source: 'call-transcript', mentionCount: 4, linkedValueDrivers: ['compliance-automation'] },
    { id: 'ps-4', description: 'Inventory carrying costs 18% above industry benchmark', severity: 'significant', source: 'web-research', mentionCount: 2, linkedValueDrivers: ['inventory-optimization'] },
  ],
  useCases: [
    'Automated procurement workflow',
    'Supplier risk monitoring',
    'Compliance reporting automation',
    'Inventory optimization',
    'Spend analytics',
  ],
  missingDataFlags: [
    { id: 'mdf-1', field: 'Current procurement cycle time (days)', description: 'Needed to calculate efficiency gain baseline', impact: 'high', resolved: false },
    { id: 'mdf-2', field: 'Number of active suppliers', description: 'Required for supplier risk model', impact: 'medium', resolved: false },
    { id: 'mdf-3', field: 'Current compliance FTE count', description: 'Needed for automation savings calculation', impact: 'high', resolved: false },
  ],
  sources: [
    { type: 'crm', name: 'Salesforce Opportunity', retrievedAt: '2024-03-15T09:00:00Z', itemCount: 23 },
    { type: 'call-transcript', name: 'Discovery Call — Feb 28', retrievedAt: '2024-03-01T14:00:00Z', itemCount: 156 },
    { type: 'call-transcript', name: 'Technical Deep-Dive — Mar 10', retrievedAt: '2024-03-11T10:00:00Z', itemCount: 203 },
    { type: 'sec-filing', name: 'ACME 10-K 2023', retrievedAt: '2024-03-12T11:00:00Z', itemCount: 12 },
    { type: 'web-research', name: 'Manufacturing Industry Benchmarks', retrievedAt: '2024-03-14T16:00:00Z', itemCount: 8 },
  ],
  assembledAt: new Date().toISOString(),
};

const SEED_HYPOTHESES: ValueHypothesis[] = [
  { id: 'vh-1', driver: 'Procurement Cycle Efficiency', estimatedImpactMin: 1_200_000, estimatedImpactMax: 2_400_000, evidenceTier: 'strong', confidenceScore: 0.87, status: 'pending' },
  { id: 'vh-2', driver: 'Supply Chain Risk Reduction', estimatedImpactMin: 800_000, estimatedImpactMax: 2_100_000, evidenceTier: 'moderate', confidenceScore: 0.71, status: 'pending' },
  { id: 'vh-3', driver: 'Compliance Automation', estimatedImpactMin: 450_000, estimatedImpactMax: 900_000, evidenceTier: 'strong', confidenceScore: 0.82, status: 'pending' },
  { id: 'vh-4', driver: 'Inventory Optimization', estimatedImpactMin: 600_000, estimatedImpactMax: 1_500_000, evidenceTier: 'moderate', confidenceScore: 0.68, status: 'pending' },
];

// ─── AGENT ACTIVITY SCRIPTS ───────────────────────────────────────────────────

type ActivityScript = Omit<AgentActivity, 'id' | 'timestamp' | 'isStreaming'>;

const DISCOVERY_ACTIVITIES: ActivityScript[] = [
  { agentId: 'orchestrator', agentName: 'Orchestrator', agentRole: 'orchestrator', type: 'thinking', message: 'Initializing value case for ACME Corporation', workflowStep: 'hypothesis' },
  { agentId: 'discovery-agent', agentName: 'Discovery Agent', agentRole: 'discovery', type: 'tool_call', message: 'Fetching CRM opportunity data', toolName: 'crm_fetch', workflowStep: 'hypothesis' },
  { agentId: 'discovery-agent', agentName: 'Discovery Agent', agentRole: 'discovery', type: 'tool_call', message: 'Analyzing call transcripts (2 sessions)', toolName: 'transcript_analyzer', workflowStep: 'hypothesis' },
  { agentId: 'discovery-agent', agentName: 'Discovery Agent', agentRole: 'discovery', type: 'tool_call', message: 'Retrieving ACME 10-K filing from SEC EDGAR', toolName: 'sec_edgar_fetch', workflowStep: 'hypothesis' },
  { agentId: 'discovery-agent', agentName: 'Discovery Agent', agentRole: 'discovery', type: 'result', message: 'Extracted 7 pain signals, 4 stakeholders, 5 use cases', workflowStep: 'hypothesis', confidence: 0.91 },
  { agentId: 'orchestrator', agentName: 'Orchestrator', agentRole: 'orchestrator', type: 'checkpoint', message: 'Discovery complete — 3 data gaps flagged for user review', workflowStep: 'hypothesis' },
];

const MODELING_ACTIVITIES: ActivityScript[] = [
  { agentId: 'modeling-agent', agentName: 'Modeling Agent', agentRole: 'modeling', type: 'thinking', message: 'Generating value hypotheses from discovery signals', workflowStep: 'model' },
  { agentId: 'modeling-agent', agentName: 'Modeling Agent', agentRole: 'modeling', type: 'tool_call', message: 'Querying benchmark database: manufacturing procurement', toolName: 'benchmark_lookup', workflowStep: 'model' },
  { agentId: 'modeling-agent', agentName: 'Modeling Agent', agentRole: 'modeling', type: 'tool_call', message: 'Building financial value tree (4 drivers)', toolName: 'value_tree_builder', workflowStep: 'model' },
  { agentId: 'modeling-agent', agentName: 'Modeling Agent', agentRole: 'modeling', type: 'result', message: 'Value tree complete — $3.05M–$6.9M total range', workflowStep: 'model', confidence: 0.78 },
  { agentId: 'modeling-agent', agentName: 'Modeling Agent', agentRole: 'modeling', type: 'tool_call', message: 'Fetching corroborating evidence for each driver', toolName: 'evidence_retriever', workflowStep: 'evidence' },
  { agentId: 'modeling-agent', agentName: 'Modeling Agent', agentRole: 'modeling', type: 'result', message: 'Evidence retrieved — 12 citations across 4 sources', workflowStep: 'evidence', confidence: 0.83 },
];

const VALIDATION_ACTIVITIES: ActivityScript[] = [
  { agentId: 'integrity-agent', agentName: 'Integrity Agent', agentRole: 'integrity', type: 'thinking', message: 'Running plausibility checks on all assumptions', workflowStep: 'objection' },
  { agentId: 'integrity-agent', agentName: 'Integrity Agent', agentRole: 'integrity', type: 'tool_call', message: 'Comparing claims against industry benchmarks', toolName: 'plausibility_checker', workflowStep: 'objection' },
  { agentId: 'red-team-agent', agentName: 'Red Team Agent', agentRole: 'red-team', type: 'thinking', message: 'Stress-testing value model assumptions', workflowStep: 'objection' },
  { agentId: 'red-team-agent', agentName: 'Red Team Agent', agentRole: 'red-team', type: 'result', message: 'Found 2 aggressive assumptions — flagging for review', workflowStep: 'objection', confidence: 0.65 },
  { agentId: 'integrity-agent', agentName: 'Integrity Agent', agentRole: 'integrity', type: 'tool_call', message: 'Calculating defensibility score', toolName: 'defensibility_scorer', workflowStep: 'revision' },
  { agentId: 'integrity-agent', agentName: 'Integrity Agent', agentRole: 'integrity', type: 'result', message: 'Defensibility score: 0.81 — Presentation Ready', workflowStep: 'revision', confidence: 0.81 },
];

const COMPOSING_ACTIVITIES: ActivityScript[] = [
  { agentId: 'narrative-agent', agentName: 'Narrative Agent', agentRole: 'narrative', type: 'thinking', message: 'Generating executive artifacts from validated model', workflowStep: 'narrative' },
  { agentId: 'narrative-agent', agentName: 'Narrative Agent', agentRole: 'narrative', type: 'tool_call', message: 'Drafting executive memo', toolName: 'artifact_generator', workflowStep: 'narrative' },
  { agentId: 'narrative-agent', agentName: 'Narrative Agent', agentRole: 'narrative', type: 'tool_call', message: 'Generating CFO recommendation note', toolName: 'artifact_generator', workflowStep: 'narrative' },
  { agentId: 'narrative-agent', agentName: 'Narrative Agent', agentRole: 'narrative', type: 'result', message: '4 executive artifacts generated — ready for review', workflowStep: 'narrative', confidence: 0.88 },
  { agentId: 'orchestrator', agentName: 'Orchestrator', agentRole: 'orchestrator', type: 'checkpoint', message: 'Awaiting Value Engineer approval to finalize', workflowStep: 'approval' },
];

// ─── VALUE GRAPH SEED ─────────────────────────────────────────────────────────

function buildSeedValueGraph(): ValueGraph {
  const makeEvidence = (source: string, sourceType: SourceClassification, confidence: number): Evidence => ({
    id: `ev-${Math.random().toString(36).slice(2, 8)}`,
    source,
    sourceType,
    citation: `${source} — retrieved ${new Date().toLocaleDateString()}`,
    confidence,
    retrievedAt: new Date().toISOString(),
    isStale: false,
    weight: confidence,
  });

  const nodes: Record<string, ValueNode> = {
    'root': {
      id: 'root',
      label: 'Total Value Opportunity',
      category: 'efficiency',
      value: 4_950_000,
      unit: 'USD/year',
      assumptions: [],
      evidence: [],
      confidence: 0.81,
      isLeaf: false,
      children: ['procurement', 'supply-chain', 'compliance', 'inventory'],
      metadata: { createdBy: 'modeling-agent', lastModified: new Date().toISOString(), agentId: 'modeling-agent', version: 3 },
    },
    'procurement': {
      id: 'procurement',
      label: 'Procurement Cycle Efficiency',
      category: 'efficiency',
      value: 1_800_000,
      unit: 'USD/year',
      formula: 'cycle_time_saved × transactions_per_year × cost_per_hour',
      assumptions: [
        { id: 'a-1', label: 'Cycle time reduction', value: 2.5, unit: 'days', source: 'benchmark-derived', confidence: 0.87, benchmarkRef: 'Gartner 2023 Procurement Benchmark', isUnsupported: false, plausibilityFlag: 'base' },
        { id: 'a-2', label: 'Annual procurement transactions', value: 4800, unit: 'transactions', source: 'internally-observed', confidence: 0.92, isUnsupported: false, plausibilityFlag: 'conservative' },
      ],
      evidence: [
        makeEvidence('Gartner 2023 Procurement Benchmark', 'benchmark-derived', 0.87),
        makeEvidence('ACME Discovery Call — Feb 28', 'customer-confirmed', 0.94),
        makeEvidence('Aberdeen Group Manufacturing Report', 'externally-researched', 0.79),
      ],
      confidence: 0.87,
      isLeaf: true,
      metadata: { createdBy: 'modeling-agent', lastModified: new Date().toISOString(), agentId: 'modeling-agent', version: 2 },
    },
    'supply-chain': {
      id: 'supply-chain',
      label: 'Supply Chain Risk Reduction',
      category: 'risk',
      value: 1_450_000,
      unit: 'USD/year',
      formula: 'emergency_purchase_reduction + stockout_avoidance',
      assumptions: [
        { id: 'a-3', label: 'Emergency purchase reduction', value: 65, unit: '%', source: 'benchmark-derived', confidence: 0.71, benchmarkRef: 'IDC Supply Chain Study 2023', isUnsupported: false, plausibilityFlag: 'aggressive' },
        { id: 'a-4', label: 'Current emergency purchase spend', value: 2_100_000, unit: 'USD', source: 'sec-filing', confidence: 0.96, isUnsupported: false, plausibilityFlag: 'conservative' },
      ],
      evidence: [
        makeEvidence('ACME 10-K 2023 — Note 14', 'externally-researched', 0.96),
        makeEvidence('IDC Supply Chain Study 2023', 'benchmark-derived', 0.71),
      ],
      confidence: 0.71,
      isLeaf: true,
      metadata: { createdBy: 'modeling-agent', lastModified: new Date().toISOString(), agentId: 'modeling-agent', version: 2 },
    },
    'compliance': {
      id: 'compliance',
      label: 'Compliance Automation',
      category: 'cost-avoidance',
      value: 675_000,
      unit: 'USD/year',
      formula: 'fte_hours_saved × fully_loaded_cost + penalty_risk_reduction',
      assumptions: [
        { id: 'a-5', label: 'Compliance FTE hours saved', value: 160, unit: 'hours/quarter', source: 'customer-confirmed', confidence: 0.89, isUnsupported: false, plausibilityFlag: 'base' },
        { id: 'a-6', label: 'Fully loaded FTE cost', value: 95_000, unit: 'USD/year', source: 'benchmark-derived', confidence: 0.82, isUnsupported: false, plausibilityFlag: 'base' },
      ],
      evidence: [
        makeEvidence('ACME Technical Deep-Dive — Mar 10', 'customer-confirmed', 0.89),
        makeEvidence('BLS Compensation Survey 2023', 'benchmark-derived', 0.82),
      ],
      confidence: 0.85,
      isLeaf: true,
      metadata: { createdBy: 'modeling-agent', lastModified: new Date().toISOString(), agentId: 'modeling-agent', version: 1 },
    },
    'inventory': {
      id: 'inventory',
      label: 'Inventory Optimization',
      category: 'cost-avoidance',
      value: 1_025_000,
      unit: 'USD/year',
      formula: 'inventory_reduction × carrying_cost_rate',
      assumptions: [
        { id: 'a-7', label: 'Inventory reduction', value: 12, unit: '%', source: 'benchmark-derived', confidence: 0.68, benchmarkRef: 'McKinsey Operations Benchmark', isUnsupported: false, plausibilityFlag: 'base' },
        { id: 'a-8', label: 'Current inventory value', value: 48_000_000, unit: 'USD', source: 'sec-filing', confidence: 0.95, isUnsupported: false, plausibilityFlag: 'conservative' },
      ],
      evidence: [
        makeEvidence('ACME 10-K 2023 — Balance Sheet', 'externally-researched', 0.95),
        makeEvidence('McKinsey Operations Benchmark 2023', 'benchmark-derived', 0.68),
      ],
      confidence: 0.75,
      isLeaf: true,
      metadata: { createdBy: 'modeling-agent', lastModified: new Date().toISOString(), agentId: 'modeling-agent', version: 1 },
    },
  };

  const conservative: ScenarioModel = {
    label: 'Conservative',
    roi: 187,
    npv: 3_240_000,
    paybackMonths: 8,
    evf: 2.87,
    totalValue: 3_050_000,
    assumptions: { procurement_reduction: '1.5 days', supply_chain_reduction: '40%', compliance_hours: 120, inventory_reduction: '8%' },
  };

  const base: ScenarioModel = {
    label: 'Base',
    roi: 312,
    npv: 5_890_000,
    paybackMonths: 5,
    evf: 4.12,
    totalValue: 4_950_000,
    assumptions: { procurement_reduction: '2.5 days', supply_chain_reduction: '65%', compliance_hours: 160, inventory_reduction: '12%' },
  };

  const upside: ScenarioModel = {
    label: 'Upside',
    roi: 498,
    npv: 9_100_000,
    paybackMonths: 3,
    evf: 5.98,
    totalValue: 6_900_000,
    assumptions: { procurement_reduction: '3.5 days', supply_chain_reduction: '80%', compliance_hours: 200, inventory_reduction: '18%' },
  };

  return {
    id: 'vg-acme-2024-001',
    opportunityId: 'opp-acme-2024-001',
    nodes,
    rootNodeId: 'root',
    scenarios: { conservative, base, upside },
    totalValue: 4_950_000,
    defensibilityScore: 0.81,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ─── DEFENSIBILITY SCORE ──────────────────────────────────────────────────────

function buildSeedDefensibilityScore(): DefensibilityScore {
  return {
    global: 0.81,
    byNode: {
      procurement: 0.87,
      'supply-chain': 0.71,
      compliance: 0.85,
      inventory: 0.75,
    },
    totalValue: 4_950_000,
    backedValue: 4_009_500,
    readinessLevel: 'presentation-ready',
    issues: [
      {
        id: 'di-1',
        type: 'benchmark_mismatch',
        severity: 'warning',
        nodeId: 'supply-chain',
        description: 'Emergency purchase reduction (65%) is above the 50th percentile benchmark',
        remediation: 'Adjust to 50% for conservative scenario or add customer confirmation',
        canAutoResolve: false,
      },
      {
        id: 'di-2',
        type: 'single_source',
        severity: 'warning',
        nodeId: 'supply-chain',
        description: 'Supply chain risk model relies on a single benchmark source',
        remediation: 'Add a second independent benchmark or customer-confirmed data point',
        canAutoResolve: false,
      },
      {
        id: 'di-3',
        type: 'evidence_gap',
        severity: 'info',
        nodeId: 'inventory',
        description: 'Inventory reduction assumption lacks customer confirmation',
        remediation: 'Request current inventory turnover data from ACME operations team',
        canAutoResolve: false,
      },
    ],
    lastCalculatedAt: new Date().toISOString(),
  };
}

// ─── EXECUTIVE ARTIFACTS ──────────────────────────────────────────────────────

function buildSeedArtifacts(): ExecutiveArtifact[] {
  return [
    {
      id: 'art-1',
      type: 'executive-memo',
      title: 'Executive Value Summary — ACME Corporation',
      content: `**To:** Marcus Webb, CFO — ACME Corporation
**From:** ValueOS Analysis
**Re:** Strategic Platform Investment — Value Case Summary
**Date:** ${new Date().toLocaleDateString()}

---

**Executive Summary**

Based on a comprehensive analysis of ACME's operational data, call intelligence, and industry benchmarks, we have identified a **$4.95M annual value opportunity** (base scenario) from deploying the ValueOS platform across procurement, supply chain, compliance, and inventory functions.

**Key Value Drivers**

| Driver | Annual Value | Confidence |
|--------|-------------|------------|
| Procurement Cycle Efficiency | $1.80M | 87% |
| Supply Chain Risk Reduction | $1.45M | 71% |
| Inventory Optimization | $1.03M | 75% |
| Compliance Automation | $0.68M | 85% |

**Financial Summary (Base Scenario)**

- **3-Year ROI:** 312%
- **Net Present Value:** $5.89M
- **Payback Period:** 5 months
- **Defensibility Score:** 81% (Presentation Ready)

**Recommendation**

The investment case is well-supported by customer-confirmed data, SEC filings, and industry benchmarks. We recommend proceeding to contract negotiation with the base scenario as the primary reference point.`,
      isDraft: false,
      readinessScore: 0.81,
      editHistory: [],
      generatedAt: new Date().toISOString(),
      financialClaims: [
        {
          id: 'fc-1',
          text: '$4.95M annual value opportunity',
          value: 4_950_000,
          nodeId: 'root',
          derivationChain: [
            { label: 'Procurement', value: '$1.80M', source: 'Gartner Benchmark + Customer Confirmed', agentId: 'modeling-agent', confidence: 0.87 },
            { label: 'Supply Chain', value: '$1.45M', source: 'SEC 10-K + IDC Benchmark', agentId: 'modeling-agent', confidence: 0.71 },
            { label: 'Compliance', value: '$0.68M', source: 'Customer Confirmed', agentId: 'modeling-agent', confidence: 0.85 },
            { label: 'Inventory', value: '$1.03M', source: 'SEC 10-K + McKinsey Benchmark', agentId: 'modeling-agent', confidence: 0.75 },
          ],
        },
      ],
    },
    {
      id: 'art-2',
      type: 'cfo-recommendation',
      title: 'CFO Recommendation Note — ACME Corporation',
      content: `**FINANCIAL REVIEW: ValueOS Platform Investment**

**Investment:** $1.58M (Year 1 platform + implementation)
**Expected Return:** $4.95M annually (base scenario)
**Risk-Adjusted NPV:** $5.89M over 3 years

**Evidence Quality Assessment**

All major financial claims have been validated against:
- Customer-confirmed operational data (3 sources)
- SEC EDGAR filings (ACME 10-K 2023)
- Industry benchmarks (Gartner, IDC, McKinsey)

**Sensitivity Analysis**

The model is most sensitive to the supply chain risk reduction assumption (65%). In a conservative scenario (40% reduction), total value decreases to $3.05M — still representing a 187% ROI.

**Finance Recommendation:** Proceed. The investment case meets the 3x return threshold with high evidence quality.`,
      isDraft: false,
      readinessScore: 0.81,
      editHistory: [],
      generatedAt: new Date().toISOString(),
      financialClaims: [],
    },
    {
      id: 'art-3',
      type: 'customer-narrative',
      title: 'Customer Value Narrative — ACME Corporation',
      content: `**Your Path to Operational Excellence**

ACME Corporation is at an inflection point. Your operations team has identified procurement delays, supply chain blind spots, and compliance overhead as the primary barriers to operational efficiency. ValueOS addresses each of these directly.

**What Changes for Your Team**

Your procurement team currently spends 3-4 days on each procurement cycle. With ValueOS, that drops to under 1 day — freeing your team to focus on strategic supplier relationships rather than administrative overhead.

Your supply chain team will gain real-time visibility into supplier risk, eliminating the $2M+ in emergency purchases that appear in your annual filings.

**The Numbers That Matter**

Based on your operational data and industry benchmarks, we project:
- **$1.8M** in procurement efficiency gains
- **$1.45M** in supply chain risk reduction  
- **$675K** in compliance automation savings
- **$1.03M** in inventory optimization

**Total: $4.95M in annual value** — with a 5-month payback period.`,
      isDraft: false,
      readinessScore: 0.81,
      editHistory: [],
      generatedAt: new Date().toISOString(),
      financialClaims: [],
    },
    {
      id: 'art-4',
      type: 'internal-case',
      title: 'Internal Business Case — ACME Corporation',
      content: `**INTERNAL: Deal Strategy and Value Case**

**Opportunity:** ACME Corp Enterprise Platform Expansion
**Stage:** Proposal | **Close Date:** June 30, 2024
**Champion:** Sarah Chen (VP Operations) | **Economic Buyer:** Marcus Webb (CFO)

**Deal Dynamics**

James Holloway (Procurement Director) is flagged as a potential blocker — sentiment negative. Recommended approach: engage with compliance automation ROI data, which directly impacts his team's workload.

**Value Case Confidence**

- Procurement driver: HIGH confidence (customer-confirmed + benchmark)
- Supply chain driver: MEDIUM confidence (SEC data + single benchmark)
- Compliance driver: HIGH confidence (customer-confirmed)
- Inventory driver: MEDIUM confidence (SEC data + benchmark)

**Next Steps**

1. Fill data gap: Request current procurement cycle time from Sarah Chen
2. Fill data gap: Confirm compliance FTE count with Dr. Nair
3. Schedule CFO briefing with Marcus Webb using the CFO Recommendation Note
4. Address Holloway's concerns with compliance automation case study`,
      isDraft: false,
      readinessScore: 0.81,
      editHistory: [],
      generatedAt: new Date().toISOString(),
      financialClaims: [],
    },
  ];
}

// ─── HUMAN CHECKPOINT ─────────────────────────────────────────────────────────

function buildSeedCheckpoint(): HumanCheckpoint {
  return {
    id: 'hc-1',
    workflowId: 'wf-acme-2024-001',
    type: 'approval',
    title: 'Approve Value Case for Finalization',
    description: 'The value case has passed all integrity checks and is ready for finalization. Review the executive artifacts and approve to lock the business case.',
    context: {
      defensibilityScore: 0.81,
      totalValue: 4_950_000,
      roi: 312,
      paybackMonths: 5,
      openIssues: 3,
    },
    options: [
      { id: 'approve', label: 'Approve & Finalize', description: 'Lock the business case and generate the promise baseline', consequence: 'Case is finalized and ready for customer presentation', isDefault: true },
      { id: 'revise', label: 'Request Revisions', description: 'Send back for additional refinement', consequence: 'Workflow returns to REFINING state for further edits' },
      { id: 'reject', label: 'Reject', description: 'Reject this value case', consequence: 'Case is archived and workflow is terminated' },
    ],
    deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    riskLevel: 'medium',
    confidence: 0.81,
    createdAt: new Date().toISOString(),
  };
}

// ─── SIMULATOR CLASS ──────────────────────────────────────────────────────────

export type SimulatorEventType =
  | 'activity'
  | 'progress'
  | 'stream_token'
  | 'state_change'
  | 'checkpoint'
  | 'graph_update'
  | 'defensibility_update';

export type SimulatorEvent =
  | { type: 'activity'; data: AgentActivity }
  | { type: 'progress'; data: WorkflowProgress }
  | { type: 'stream_token'; data: StreamToken }
  | { type: 'state_change'; data: { from: WorkflowState; to: WorkflowState } }
  | { type: 'checkpoint'; data: HumanCheckpoint }
  | { type: 'graph_update'; data: ValueGraph }
  | { type: 'defensibility_update'; data: DefensibilityScore };

type EventListener = (event: SimulatorEvent) => void;

export class AgentSimulator {
  private listeners: EventListener[] = [];
  private isRunning = false;
  private currentState: WorkflowState = 'INITIATED';
  private currentStep: WorkflowStep = 'hypothesis';
  private activityLog: AgentActivity[] = [];
  private progress: WorkflowProgress;
  private abortController: AbortController | null = null;

  constructor() {
    this.progress = {
      workflowId: 'wf-acme-2024-001',
      currentState: 'INITIATED',
      currentStep: 'hypothesis',
      percentComplete: 0,
      completedSteps: [],
      activeAgents: [],
      lastUpdatedAt: new Date().toISOString(),
      status: 'running',
      statusMessage: 'Initializing...',
    };
  }

  on(listener: EventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private emit(event: SimulatorEvent) {
    this.listeners.forEach(l => l(event));
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, ms);
      if (this.abortController) {
        this.abortController.signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new Error('aborted'));
        });
      }
    });
  }

  private makeActivity(script: ActivityScript): AgentActivity {
    return {
      ...script,
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      isStreaming: false,
    };
  }

  private updateProgress(updates: Partial<WorkflowProgress>) {
    this.progress = { ...this.progress, ...updates, lastUpdatedAt: new Date().toISOString() };
    this.emit({ type: 'progress', data: this.progress });
  }

  private async runActivities(scripts: ActivityScript[], baseProgress: number, progressRange: number) {
    for (let i = 0; i < scripts.length; i++) {
      const activity = this.makeActivity(scripts[i]);
      this.activityLog.push(activity);
      this.emit({ type: 'activity', data: activity });

      const progress = baseProgress + (progressRange * (i + 1)) / scripts.length;
      this.updateProgress({
        percentComplete: Math.round(progress),
        activeAgents: [scripts[i].agentId],
        statusMessage: scripts[i].message,
      });

      await this.delay(800 + Math.random() * 600);
    }
  }

  private async streamText(text: string, field: string) {
    const words = text.split(' ');
    for (const word of words) {
      const token: StreamToken = {
        id: `tok-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        workflowId: 'wf-acme-2024-001',
        field,
        token: word + ' ',
        isComplete: false,
        timestamp: new Date().toISOString(),
      };
      this.emit({ type: 'stream_token', data: token });
      await this.delay(40 + Math.random() * 30);
    }
    this.emit({
      type: 'stream_token',
      data: {
        id: `tok-${Date.now()}-end`,
        workflowId: 'wf-acme-2024-001',
        field,
        token: '',
        isComplete: true,
        timestamp: new Date().toISOString(),
      },
    });
  }

  private async transitionState(to: WorkflowState) {
    const from = this.currentState;
    this.currentState = to;
    this.emit({ type: 'state_change', data: { from, to } });
    this.updateProgress({ currentState: to, status: 'running' });
    await this.delay(500);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.abortController = new AbortController();

    try {
      // ── PHASE 1: DISCOVERY ────────────────────────────────────────────────
      await this.transitionState('INITIATED');
      this.updateProgress({ currentStep: 'hypothesis', statusMessage: 'Assembling opportunity context...' });
      await this.runActivities(DISCOVERY_ACTIVITIES, 0, 20);

      // Emit opportunity context
      await this.delay(500);

      // ── PHASE 2: MODELING ─────────────────────────────────────────────────
      await this.transitionState('DRAFTING');
      this.updateProgress({ currentStep: 'model', statusMessage: 'Building value hypothesis...' });
      await this.runActivities(MODELING_ACTIVITIES, 20, 25);

      // Emit value graph
      const graph = buildSeedValueGraph();
      this.emit({ type: 'graph_update', data: graph });
      await this.delay(800);

      // ── PHASE 3: VALIDATION ───────────────────────────────────────────────
      await this.transitionState('VALIDATING');
      this.updateProgress({ currentStep: 'objection', statusMessage: 'Verifying evidence and scoring confidence...' });
      await this.runActivities(VALIDATION_ACTIVITIES, 45, 20);

      // Emit defensibility score
      const defensibility = buildSeedDefensibilityScore();
      this.emit({ type: 'defensibility_update', data: defensibility });
      await this.delay(800);

      // ── PHASE 4: COMPOSING ────────────────────────────────────────────────
      await this.transitionState('COMPOSING');
      this.updateProgress({ currentStep: 'narrative', statusMessage: 'Generating executive artifacts...' });
      await this.runActivities(COMPOSING_ACTIVITIES, 65, 15);

      // Stream executive summary
      await this.streamText(
        'Based on comprehensive analysis of ACME operational data, call intelligence, and industry benchmarks, we have identified a $4.95M annual value opportunity from deploying the platform across procurement, supply chain, compliance, and inventory functions.',
        'executive_summary'
      );

      // ── PHASE 5: REFINING / HUMAN CHECKPOINT ─────────────────────────────
      await this.transitionState('REFINING');
      this.updateProgress({
        currentStep: 'approval',
        percentComplete: 90,
        status: 'paused',
        statusMessage: 'Awaiting Value Engineer approval...',
        activeAgents: [],
      });

      // Emit human checkpoint
      const checkpoint = buildSeedCheckpoint();
      this.emit({ type: 'checkpoint', data: checkpoint });

    } catch (err) {
      if ((err as Error).message !== 'aborted') {
        console.error('Simulator error:', err);
        this.updateProgress({ status: 'failed', statusMessage: 'An error occurred' });
      }
    }
  }

  async approveCheckpoint(): Promise<void> {
    await this.transitionState('FINALIZED');
    this.updateProgress({
      percentComplete: 100,
      status: 'completed',
      statusMessage: 'Business case finalized and ready for presentation.',
      activeAgents: [],
    });
  }

  stop(): void {
    this.isRunning = false;
    this.abortController?.abort();
  }

  reset(): void {
    this.stop();
    this.currentState = 'INITIATED';
    this.currentStep = 'hypothesis';
    this.activityLog = [];
    this.isRunning = false;
    this.progress = {
      workflowId: 'wf-acme-2024-001',
      currentState: 'INITIATED',
      currentStep: 'hypothesis',
      percentComplete: 0,
      completedSteps: [],
      activeAgents: [],
      lastUpdatedAt: new Date().toISOString(),
      status: 'running',
      statusMessage: 'Ready to start',
    };
  }

  getActivityLog(): AgentActivity[] {
    return this.activityLog;
  }

  getSeedOpportunity(): OpportunityContext {
    return SEED_OPPORTUNITY;
  }

  getSeedHypotheses(): ValueHypothesis[] {
    return SEED_HYPOTHESES;
  }

  getSeedValueGraph(): ValueGraph {
    return buildSeedValueGraph();
  }

  getSeedDefensibilityScore(): DefensibilityScore {
    return buildSeedDefensibilityScore();
  }

  getSeedArtifacts(): ExecutiveArtifact[] {
    return buildSeedArtifacts();
  }

  getSeedCheckpoint(): HumanCheckpoint {
    return buildSeedCheckpoint();
  }
}

// Singleton
export const agentSimulator = new AgentSimulator();
