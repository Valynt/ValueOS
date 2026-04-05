import { z } from "zod";

const BaseLifecycleContextSchema = z.object({
  workspace_id: z.string().min(1),
  organization_id: z.string().min(1),
  user_id: z.string().min(1),
  lifecycle_stage: z.string().min(1),
  workspace_data: z.record(z.string(), z.unknown()).default({}),
  user_inputs: z.record(z.string(), z.unknown()).default({}),
  previous_stage_outputs: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const OpportunityAgentInputSchema = BaseLifecycleContextSchema.extend({
  user_inputs: z.record(z.string(), z.unknown()).and(
    z.object({
      query: z.string().optional(),
    }).passthrough(),
  ),
});

export const ValueHypothesisSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.enum([
    "revenue_growth",
    "cost_reduction",
    "risk_mitigation",
    "operational_efficiency",
    "strategic_advantage",
  ]),
  estimated_impact: z.object({
    low: z.number(),
    high: z.number(),
    unit: z.enum(["usd", "percent", "hours", "headcount"]),
    timeframe_months: z.number().int().positive(),
  }),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()).min(1),
  assumptions: z.array(z.string()),
  kpi_targets: z.array(z.string()),
});

export const OpportunityAnalysisSchema = z.object({
  company_summary: z.string(),
  industry_context: z.string(),
  hypotheses: z.array(ValueHypothesisSchema).min(1),
  stakeholder_roles: z.array(z.object({
    role: z.string(),
    relevance: z.string(),
    likely_concerns: z.array(z.string()),
  })),
  recommended_next_steps: z.array(z.string()),
});

const CashFlowProjectionSchema = z.object({
  hypothesis_id: z.string(),
  hypothesis_description: z.string(),
  category: z.enum([
    "cost_reduction",
    "revenue_growth",
    "risk_mitigation",
    "efficiency",
    "productivity",
  ]),
  assumptions: z.array(z.string()).min(1),
  cash_flows: z.array(z.number()).min(2),
  currency: z.string().default("USD"),
  period_type: z.enum(["monthly", "quarterly", "annual"]).default("annual"),
  discount_rate: z.number().min(0).max(1),
  total_investment: z.number(),
  total_benefit: z.number(),
  confidence: z.number().min(0).max(1),
  risk_factors: z.array(z.string()),
  data_sources: z.array(z.string()),
});

export const FinancialModelingInputSchema = BaseLifecycleContextSchema;

export const FinancialModelingOutputSchema = z.object({
  projections: z.array(CashFlowProjectionSchema).min(1),
  portfolio_summary: z.string(),
  key_assumptions: z.array(z.string()),
  sensitivity_parameters: z.array(z.object({
    name: z.string(),
    base_value: z.number(),
    perturbations: z.array(z.number()).min(2),
  })).optional(),
  recommended_next_steps: z.array(z.string()),
});

export const ClaimValidationSchema = z.object({
  claim_id: z.string(),
  claim_text: z.string(),
  verdict: z.enum(["supported", "partially_supported", "unsupported", "insufficient_evidence"]),
  confidence: z.number().min(0).max(1),
  evidence_assessment: z.string(),
  issues: z.array(z.object({
    type: z.enum(["hallucination", "data_integrity", "logic_error", "unsupported_assumption", "stale_data"]),
    severity: z.enum(["low", "medium", "high", "critical"]),
    description: z.string(),
  })),
  suggested_fix: z.string().optional(),
});

export const IntegrityAgentInputSchema = BaseLifecycleContextSchema;

export const IntegrityAnalysisSchema = z.object({
  claim_validations: z.array(ClaimValidationSchema).min(1),
  overall_assessment: z.string(),
  data_quality_score: z.number().min(0).max(1),
  logical_consistency_score: z.number().min(0).max(1),
  evidence_coverage_score: z.number().min(0).max(1),
});

export const NarrativeStructuredInputSchema = z.object({
  claims: z.array(z.record(z.string(), z.unknown())),
  integrityScore: z.number().min(0).max(1),
  vetoDecision: z.string(),
  kpis: z.array(z.record(z.string(), z.unknown())),
  financialSummary: z.string(),
});

export const NarrativeOutputSchema = z.object({
  executive_summary: z.string().min(1),
  value_proposition: z.string().min(1),
  key_proof_points: z.array(z.string()).min(1).max(10),
  risk_mitigations: z.array(z.string()),
  call_to_action: z.string(),
  defense_readiness_score: z.number().min(0).max(1),
  talking_points: z.array(
    z.object({
      audience: z.enum(["executive", "technical", "financial", "procurement"]),
      point: z.string(),
    }),
  ),
  hallucination_check: z.boolean().optional(),
});

export type GovernanceEngineInput = {
  averageConfidence: number;
  evidenceCoverage: number;
  minimumConfidence: number;
  minimumEvidenceCoverage: number;
};

export function runEvidenceConfidenceGovernance(input: GovernanceEngineInput): {
  approved: boolean;
  reason?: string;
} {
  if (input.averageConfidence < input.minimumConfidence) {
    return {
      approved: false,
      reason: `Confidence ${input.averageConfidence.toFixed(2)} below governance threshold ${input.minimumConfidence.toFixed(2)}`,
    };
  }
  if (input.evidenceCoverage < input.minimumEvidenceCoverage) {
    return {
      approved: false,
      reason: `Evidence coverage ${input.evidenceCoverage.toFixed(2)} below governance threshold ${input.minimumEvidenceCoverage.toFixed(2)}`,
    };
  }
  return { approved: true };
}
