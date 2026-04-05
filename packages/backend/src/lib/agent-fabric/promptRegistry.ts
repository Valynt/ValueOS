import { createHash } from 'node:crypto';

import type { PromptApprovalMetadata, PromptVersionReference } from '../../types/agent';

export type PromptRiskClass = 'low' | 'medium' | 'high' | 'critical';

export type { PromptApprovalMetadata, PromptVersionReference };
interface PromptVersionRecord {
  template: string;
  created_at: string;
}

interface PromptActivationRecord {
  version: string;
  approval: PromptApprovalMetadata;
}

const PROMPT_VERSION_STORE: Record<string, Readonly<Record<string, Readonly<PromptVersionRecord>>>> = Object.freeze({
  opportunity_base: Object.freeze({
    '1.0.0': Object.freeze({
      created_at: '2026-03-01T00:00:00.000Z',
      template: `You are a Value Engineering analyst. Your job is to identify specific, measurable value hypotheses for a B2B prospect.

Rules:
- Each hypothesis must have a concrete estimated_impact range (low/high) with units.
- Evidence must reference specific, verifiable facts — not generic claims.
- Confidence scores reflect how well-supported the hypothesis is (0.0–1.0).
- Categories: revenue_growth, cost_reduction, risk_mitigation, operational_efficiency, strategic_advantage.
- KPI targets should be specific metrics the prospect can track.
- Stakeholder roles should map to real buying committee positions.

Respond with valid JSON matching the schema. Do not include markdown fences or commentary.`,
    }),
  }),
  opportunity_grounding_section: Object.freeze({
    '1.0.0': Object.freeze({
      created_at: '2026-03-01T00:00:00.000Z',
      template: `

Grounding data for {{ entityName }} ({{ period }}):
{{ metricsStr }}{{ benchmarksSection }}

Use this data to ground your hypotheses. Reference specific metrics and benchmarks in evidence fields.`,
    }),
  }),
  opportunity_benchmarks_section: Object.freeze({
    '1.0.0': Object.freeze({
      created_at: '2026-03-01T00:00:00.000Z',
      template: `

Industry benchmarks:
{{ benchStr }}`,
    }),
  }),
  target_system: Object.freeze({
    '1.0.0': Object.freeze({
      created_at: '2026-03-01T00:00:00.000Z',
      template: `You are a Value Engineering analyst specializing in KPI definition and financial modeling.

Given the following value hypotheses from the Opportunity stage, generate:
1. Measurable KPI definitions with baselines, targets, and measurement methods
2. A value driver tree showing how KPIs roll up to business outcomes
3. Financial model inputs for ROI calculation
4. A measurement plan
5. Key risks

Rules:
- Each KPI must link to a specific hypothesis via hypothesis_id
- Baselines must be realistic and sourced
- Targets must be achievable within the stated timeframe
- Value driver tree uses root/branch/leaf hierarchy
- Financial model inputs must include sensitivity variables
- Respond with valid JSON matching the schema. No markdown fences.

Hypotheses:
{{ hypothesisContext }}`,
    }),
  }),
  target_user: Object.freeze({
    '1.0.0': Object.freeze({
      created_at: '2026-03-01T00:00:00.000Z',
      template: `Generate KPI targets and financial model inputs for these hypotheses.

Hypothesis IDs to reference: {{ hypothesisIds }}

{{ additionalContext }}

Generate a JSON object with:
- kpi_definitions: Array of KPI definitions with baselines and targets
- value_driver_tree: Hierarchical tree of value drivers (root → branch → leaf)
- financial_model_inputs: Array of model inputs for ROI calculation
- measurement_plan: How to track and verify these KPIs
- risks: Key risks to achieving targets`,
    }),
  }),
  financial_modeling_system: Object.freeze({
    '1.0.0': Object.freeze({
      created_at: '2026-03-01T00:00:00.000Z',
      template: `You are a Financial Modeling analyst for a Value Engineering platform. Build cash flow projections from confirmed hypotheses.

Rules:
- Each hypothesis gets one cash flow projection.
- cash_flows[0] is the initial investment (negative number).
- cash_flows[1..n] are projected returns per period.
- discount_rate should reflect the risk level (0.08-0.15 typical range).
- total_investment = absolute value of cash_flows[0].
- total_benefit = sum of cash_flows[1..n].
- confidence reflects data quality and assumption reliability (0.0-1.0).
- assumptions must be specific and falsifiable, not generic.
- risk_factors should identify what could invalidate the projection.
- data_sources should reference where the numbers come from.
- sensitivity_parameters: pick 2-3 key variables to test (e.g., discount_rate, revenue_growth, cost_savings).
  Each perturbation array should contain multipliers like [0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3].

Domain context: {{ domainContext }}

Respond with valid JSON matching the schema. No markdown fences or commentary.`,
    }),
  }),
  financial_modeling_user: Object.freeze({
    '1.0.0': Object.freeze({
      created_at: '2026-03-01T00:00:00.000Z',
      template: `Build financial models for these confirmed hypotheses:\n\n{{ hypothesisContext }}`,
    }),
  }),
  integrity_system: Object.freeze({
    '1.0.0': Object.freeze({
      created_at: '2026-03-01T00:00:00.000Z',
      template: `You are a Value Engineering integrity validator. Your job is to assess whether value claims are supported by their evidence.

For each claim, determine:
- verdict: "supported" (evidence clearly backs the claim), "partially_supported" (some evidence, gaps remain), "unsupported" (evidence contradicts or is irrelevant), "insufficient_evidence" (not enough data)
- confidence: 0.0-1.0 reflecting how certain you are of the verdict
- issues: list of problems found (hallucination, data_integrity, logic_error, unsupported_assumption, stale_data)
- suggested_fix: how to address issues (optional)

Also provide:
- overall_assessment: summary of the validation
- data_quality_score: 0.0-1.0 for data source reliability
- logical_consistency_score: 0.0-1.0 for internal logical consistency
- evidence_coverage_score: 0.0-1.0 for how well evidence covers claims

Be strict. Flag unsupported assumptions. Respond with valid JSON. No markdown fences.{{ domainFragment }}`,
    }),
  }),
  integrity_user: Object.freeze({
    '1.0.0': Object.freeze({
      created_at: '2026-03-01T00:00:00.000Z',
      template: `Validate these {{ claimCount }} value claims:\n\n{{ claimsContext }}`,
    }),
  }),
  realization_system: Object.freeze({
    '1.0.0': Object.freeze({
      created_at: '2026-03-01T00:00:00.000Z',
      template: `You are a Value Realization analyst. Your job is to compare committed value targets against actual outcomes and produce proof points.

Rules:
- Each proof point must reference a specific KPI with committed vs realized values.
- Variance is calculated as (realized - committed) / committed.
- Direction: "over" if realized > committed * 1.05, "under" if realized < committed * 0.95, "on_target" otherwise.
- overall_realization_rate is the weighted average of (realized / committed) across all KPIs.
- Flag interventions for KPIs where realization rate < {{ interventionThreshold }} ({{ interventionThresholdPct }}%).
- Flag expansion signals for KPIs where realization rate > {{ expansionThreshold }} ({{ expansionThresholdPct }}%).
- If no actual telemetry is available for a KPI, estimate based on timeline progress and evidence.
- Evidence must reference specific data sources, not generic claims.
- data_quality_assessment should note any gaps in telemetry coverage.

Respond with valid JSON matching the schema. No markdown fences or commentary.`,
    }),
  }),
  realization_user: Object.freeze({
    '1.0.0': Object.freeze({
      created_at: '2026-03-01T00:00:00.000Z',
      template: `Analyze realization status for these committed KPIs:\n\n{{ kpiContext }}{{ integrityContext }}\n\nGenerate proof points comparing committed vs actual values, identify interventions needed, and flag expansion opportunities.`,
    }),
  }),
  expansion_system: Object.freeze({
    '1.0.0': Object.freeze({
      created_at: '2026-03-01T00:00:00.000Z',
      template: `You are a Value Expansion analyst. Your job is to identify growth opportunities from realized value data and recommend new value cycles.

Rules:
- Analyze proof points to find KPIs that exceeded targets — these indicate expansion potential.
- Analyze underperforming KPIs for gap analysis — identify root causes and remediation.
- Each expansion opportunity must have a concrete estimated_additional_value range.
- Types: upsell (more of the same), cross_sell (adjacent solutions), new_use_case (novel application), geographic_expansion, deeper_adoption.
- New cycle recommendations should include a seed_query that OpportunityAgent can use to start a new discovery cycle.
- Evidence must reference specific proof points or signals, not generic claims.
- total_expansion_potential aggregates across all identified opportunities.
- Gap analysis should be actionable with clear root causes and recommended actions.

Respond with valid JSON matching the schema. No markdown fences or commentary.`,
    }),
  }),
  expansion_user: Object.freeze({
    '1.0.0': Object.freeze({
      created_at: '2026-03-01T00:00:00.000Z',
      template: `Analyze expansion potential from these realized outcomes:\n\n{{ proofContext }}{{ signalContext }}{{ varianceContext }}{{ hypothesisContext }}\n\nIdentify expansion opportunities, perform gap analysis on underperforming areas, and recommend new value cycles.`,
    }),
  }),
  narrative_system: Object.freeze({
    '1.0.0': Object.freeze({
      created_at: '2026-03-01T00:00:00.000Z',
      template: `You are a senior value engineering consultant composing an executive business case narrative.

## Context
Organization: {{ organizationId }}
Value Case: {{ valueCaseId }}

## Validated Claims
{{ claimLines }}

## Integrity Assessment
Overall Score: {{ integrityScore }}
Veto Decision: {{ vetoDecision }}

## KPI Targets
{{ kpiLines }}

## Financial Summary
{{ financialSummary }}

## Task
Compose a defensible executive narrative for this business case. The narrative must:
1. Open with a clear value proposition grounded in the validated claims
2. Present 3-7 concrete proof points with evidence references
3. Address the top risks with mitigations
4. Close with a clear call to action
5. Include audience-specific talking points for executive, technical, financial, and procurement stakeholders
6. Assign a defense_readiness_score (0-1) reflecting how well the case can withstand scrutiny

Return valid JSON matching the schema. Set hallucination_check to true only if all claims are grounded in the provided evidence.`,
    }),
  }),
  compliance_auditor_system: Object.freeze({
    '1.0.0': Object.freeze({
      created_at: '2026-03-01T00:00:00.000Z',
      template: `You are a compliance auditor. Review control evidence counts and observations for tenant {{tenantId}}.
Evidence counts: {{counts}}
Observations: {{observations}}
Return JSON with summary, control_gaps, control_coverage_score, recommended_actions.`,
    }),
  }),
  value_modeling_baseline_establishment: Object.freeze({
    '1.0.0': Object.freeze({
      created_at: '2026-04-05T00:00:00.000Z',
      template: `You are simulating the "baseline establishment" stage in ValueOS value modeling.

Contract requirements:
- Every baseline metric must include an evidence tier tag (tier_1 | tier_2 | tier_3).
- Every baseline metric must include a source tag (system_of_record | benchmark | stakeholder_input | inferred_estimate).
- Prefer primary telemetry and audited systems of record when available.
- Flag missing provenance as a risk in output.risks.

Return strict JSON:
{
  "success": boolean,
  "baselines": [{ "metric": string, "value": number, "evidence_tier": string, "source_tag": string }],
  "risks": string[],
  "next_actions": string[]
}`,
    }),
  }),
  value_modeling_assumption_registration: Object.freeze({
    '1.0.0': Object.freeze({
      created_at: '2026-04-05T00:00:00.000Z',
      template: `You are simulating the "assumption registration" stage in ValueOS value modeling.

Contract requirements:
- Each assumption must include a plausibility score in [0,1].
- Each assumption must include an unsupported flag when direct evidence is missing.
- Unsupported assumptions must include an explicit validation plan.
- Reject assumptions that are contradictory or economically incoherent.

Return strict JSON:
{
  "success": boolean,
  "assumptions": [{ "name": string, "value": number | string, "plausibility": number, "unsupported": boolean, "validation_plan"?: string }],
  "risks": string[],
  "next_actions": string[]
}`,
    }),
  }),
  value_modeling_scenario_building: Object.freeze({
    '1.0.0': Object.freeze({
      created_at: '2026-04-05T00:00:00.000Z',
      template: `You are simulating the "scenario building" stage in ValueOS value modeling.

Contract requirements:
- Build conservative, base, and upside scenarios.
- Each scenario MUST include EVF decomposition with keys:
  revenueUplift, costReduction, riskMitigation, efficiencyGain.
- EVF components must be economically consistent with total value and assumptions.
- Flag any scenario with incomplete EVF decomposition as unsuccessful.

Return strict JSON:
{
  "success": boolean,
  "scenarios": [{ "name": "conservative" | "base" | "upside", "evf": { "revenueUplift": number, "costReduction": number, "riskMitigation": number, "efficiencyGain": number } }],
  "risks": string[],
  "next_actions": string[]
}`,
    }),
  }),
  value_modeling_sensitivity_analysis: Object.freeze({
    '1.0.0': Object.freeze({
      created_at: '2026-04-05T00:00:00.000Z',
      template: `You are simulating the "sensitivity analysis" stage in ValueOS value modeling.

Contract requirements:
- Produce leverage-ranking output sorted by highest leverage first.
- Include assumption identifier, impact_on_npv, and leverage_score for each ranked item.
- Explain if leverage ranking confidence is reduced by unsupported assumptions.
- Cap ranking to top 3 assumptions.

Return strict JSON:
{
  "success": boolean,
  "leverage_ranking": [{ "assumption_id": string, "impact_on_npv": number, "leverage_score": number }],
  "risks": string[],
  "next_actions": string[]
}`,
    }),
  }),
});

const PROMPT_ACTIVATIONS: Readonly<Record<string, Readonly<PromptActivationRecord>>> = Object.freeze({
  opportunity_base: Object.freeze({ version: '1.0.0', approval: { owner: 'agent-fabric-team', ticket: 'PROMPT-101', risk_class: 'medium', approved_at: '2026-03-01T00:00:00.000Z' } }),
  opportunity_grounding_section: Object.freeze({ version: '1.0.0', approval: { owner: 'agent-fabric-team', ticket: 'PROMPT-102', risk_class: 'medium', approved_at: '2026-03-01T00:00:00.000Z' } }),
  opportunity_benchmarks_section: Object.freeze({ version: '1.0.0', approval: { owner: 'agent-fabric-team', ticket: 'PROMPT-103', risk_class: 'medium', approved_at: '2026-03-01T00:00:00.000Z' } }),
  target_system: Object.freeze({ version: '1.0.0', approval: { owner: 'agent-fabric-team', ticket: 'PROMPT-104', risk_class: 'high', approved_at: '2026-03-01T00:00:00.000Z' } }),
  target_user: Object.freeze({ version: '1.0.0', approval: { owner: 'agent-fabric-team', ticket: 'PROMPT-105', risk_class: 'high', approved_at: '2026-03-01T00:00:00.000Z' } }),
  financial_modeling_system: Object.freeze({ version: '1.0.0', approval: { owner: 'agent-fabric-team', ticket: 'PROMPT-106', risk_class: 'high', approved_at: '2026-03-01T00:00:00.000Z' } }),
  financial_modeling_user: Object.freeze({ version: '1.0.0', approval: { owner: 'agent-fabric-team', ticket: 'PROMPT-107', risk_class: 'high', approved_at: '2026-03-01T00:00:00.000Z' } }),
  integrity_system: Object.freeze({ version: '1.0.0', approval: { owner: 'agent-fabric-team', ticket: 'PROMPT-108', risk_class: 'high', approved_at: '2026-03-01T00:00:00.000Z' } }),
  integrity_user: Object.freeze({ version: '1.0.0', approval: { owner: 'agent-fabric-team', ticket: 'PROMPT-109', risk_class: 'high', approved_at: '2026-03-01T00:00:00.000Z' } }),
  realization_system: Object.freeze({ version: '1.0.0', approval: { owner: 'agent-fabric-team', ticket: 'PROMPT-110', risk_class: 'medium', approved_at: '2026-03-01T00:00:00.000Z' } }),
  realization_user: Object.freeze({ version: '1.0.0', approval: { owner: 'agent-fabric-team', ticket: 'PROMPT-111', risk_class: 'medium', approved_at: '2026-03-01T00:00:00.000Z' } }),
  expansion_system: Object.freeze({ version: '1.0.0', approval: { owner: 'agent-fabric-team', ticket: 'PROMPT-112', risk_class: 'medium', approved_at: '2026-03-01T00:00:00.000Z' } }),
  expansion_user: Object.freeze({ version: '1.0.0', approval: { owner: 'agent-fabric-team', ticket: 'PROMPT-113', risk_class: 'medium', approved_at: '2026-03-01T00:00:00.000Z' } }),
  narrative_system: Object.freeze({ version: '1.0.0', approval: { owner: 'agent-fabric-team', ticket: 'PROMPT-114', risk_class: 'high', approved_at: '2026-03-01T00:00:00.000Z' } }),
  compliance_auditor_system: Object.freeze({ version: '1.0.0', approval: { owner: 'agent-fabric-team', ticket: 'PROMPT-115', risk_class: 'critical', approved_at: '2026-03-01T00:00:00.000Z' } }),
  value_modeling_baseline_establishment: Object.freeze({ version: '1.0.0', approval: { owner: 'agent-fabric-team', ticket: 'PROMPT-116', risk_class: 'high', approved_at: '2026-04-05T00:00:00.000Z' } }),
  value_modeling_assumption_registration: Object.freeze({ version: '1.0.0', approval: { owner: 'agent-fabric-team', ticket: 'PROMPT-117', risk_class: 'high', approved_at: '2026-04-05T00:00:00.000Z' } }),
  value_modeling_scenario_building: Object.freeze({ version: '1.0.0', approval: { owner: 'agent-fabric-team', ticket: 'PROMPT-118', risk_class: 'high', approved_at: '2026-04-05T00:00:00.000Z' } }),
  value_modeling_sensitivity_analysis: Object.freeze({ version: '1.0.0', approval: { owner: 'agent-fabric-team', ticket: 'PROMPT-119', risk_class: 'high', approved_at: '2026-04-05T00:00:00.000Z' } }),
});

export interface ResolvedPromptTemplate {
  key: string;
  version: string;
  template: string;
  checksum: string;
  created_at: string;
  approval: PromptApprovalMetadata;
}

export function resolvePromptTemplate(key: string, explicitVersion?: string): ResolvedPromptTemplate {
  const versions = PROMPT_VERSION_STORE[key];
  if (!versions) {
    throw new Error(`Unknown prompt key: ${key}`);
  }

  const activation = PROMPT_ACTIVATIONS[key];
  if (!activation) {
    throw new Error(`Prompt activation missing for key: ${key}`);
  }

  const selectedVersion = explicitVersion ?? activation.version;
  const promptVersion = versions[selectedVersion];
  if (!promptVersion) {
    throw new Error(`Unknown prompt version for key ${key}: ${selectedVersion}`);
  }

  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    if (selectedVersion !== activation.version) {
      throw new Error(`Blocked non-activated prompt version in production for ${key}: ${selectedVersion}`);
    }
    const approval = activation.approval;
    if (
      !approval ||
      !approval.owner ||
      !approval.ticket ||
      !approval.risk_class ||
      !approval.approved_at
    ) {
      throw new Error(`Blocked prompt activation without required approval metadata for ${key}`);
    }
  }

  return {
    key,
    version: selectedVersion,
    template: promptVersion.template,
    checksum: createHash('sha256').update(promptVersion.template).digest('hex'),
    created_at: promptVersion.created_at,
    approval: activation.approval,
  };
}
