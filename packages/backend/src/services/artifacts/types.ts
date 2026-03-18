/**
 * Artifact Generator Types and Schemas
 *
 * Shared types and Zod schemas for executive output generation.
 * Tasks: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Common Artifact Schemas
// ---------------------------------------------------------------------------

export const ProvenanceRefSchema = z.object({
  claimId: z.string(),
  sourceType: z.enum(["integrity_check", "financial_model", "benchmark", "assumption", "kpi"]),
  confidence: z.number().min(0).max(1),
});

export const FinancialHighlightSchema = z.object({
  metric: z.string(),
  value: z.string(),
  range: z.string().optional(),
  confidence: z.number().min(0).max(1),
  claimId: z.string(),
});

// ---------------------------------------------------------------------------
// Executive Memo Output Schema
// ---------------------------------------------------------------------------

export const ExecutiveMemoOutputSchema = z.object({
  title: z.string(),
  executive_summary: z.string(),
  value_hypothesis: z.string(),
  top_drivers: z.array(z.object({
    name: z.string(),
    impact_range: z.string(),
    confidence: z.number().min(0).max(1),
    claim_id: z.string(),
  })),
  confidence_assessment: z.object({
    overall_score: z.number().min(0).max(1),
    assessment: z.string(),
    blockers: z.array(z.string()),
  }),
  key_assumptions: z.array(z.object({
    assumption: z.string(),
    confidence: z.number().min(0).max(1),
    validated: z.boolean(),
  })),
  recommendation: z.string(),
  financial_highlights: z.object({
    roi_range: z.string(),
    npv: z.string(),
    payback_months: z.number(),
  }),
  provenance_refs: z.array(z.string()),
  // Traceability fields
  data_claim_ids: z.array(z.string()).optional(),
});

export type ExecutiveMemoOutput = z.infer<typeof ExecutiveMemoOutputSchema>;

// ---------------------------------------------------------------------------
// CFO Recommendation Output Schema
// ---------------------------------------------------------------------------

export const CFORecommendationOutputSchema = z.object({
  title: z.string(),
  recommendation: z.object({
    decision: z.enum(["approve", "reject", "defer"]),
    rationale: z.string(),
    confidence: z.number().min(0).max(1),
  }),
  financial_summary: z.object({
    scenarios: z.array(z.object({
      name: z.string(),
      probability: z.number(),
      roi_percent: z.number(),
      npv: z.string(),
      payback_months: z.number(),
      claim_id: z.string(),
    })),
    probability_weighted_roi: z.number(),
    risk_adjusted_npv: z.string(),
  }),
  key_assumptions: z.array(z.object({
    assumption: z.string(),
    value: z.string(),
    source_type: z.string(),
    source_id: z.string(),
    confidence: z.number().min(0).max(1),
  })),
  sensitivity_highlights: z.array(z.object({
    variable: z.string(),
    base_value: z.string(),
    impact_range: z.string(),
    npv_impact: z.string(),
  })),
  benchmark_context: z.array(z.object({
    metric: z.string(),
    our_projection: z.string(),
    industry_median: z.string(),
    percentile: z.string(),
    benchmark_id: z.string(),
  })),
  financial_risks: z.array(z.object({
    risk: z.string(),
    impact: z.string(),
    mitigation: z.string(),
  })),
  approval_conditions: z.array(z.string()),
  provenance_refs: z.array(z.string()),
  // Traceability fields
  data_claim_ids: z.array(z.string()).optional(),
});

export type CFORecommendationOutput = z.infer<typeof CFORecommendationOutputSchema>;

// ---------------------------------------------------------------------------
// Customer Narrative Output Schema
// ---------------------------------------------------------------------------

export const CustomerNarrativeOutputSchema = z.object({
  title: z.string(),
  industry_framing: z.string(),
  business_outcomes: z.array(z.object({
    outcome: z.string(),
    description: z.string(),
    value_range: z.string(),
    confidence: z.number().min(0).max(1),
    claim_id: z.string(),
  })),
  benchmark_context: z.array(z.object({
    metric: z.string(),
    comparison: z.string(),
    opportunity: z.string(),
    benchmark_id: z.string(),
  })),
  proof_points: z.array(z.object({
    headline: z.string(),
    details: z.string(),
    evidence_ref: z.string(),
  })),
  risk_mitigations: z.array(z.object({
    concern: z.string(),
    mitigation: z.string(),
  })),
  implementation_highlights: z.object({
    timeline: z.string(),
    key_milestones: z.array(z.string()),
    quick_wins: z.array(z.string()),
  }),
  next_steps: z.array(z.object({
    action: z.string(),
    owner: z.string(),
    timeframe: z.string(),
  })),
  provenance_refs: z.array(z.string()),
  // Traceability fields
  data_claim_ids: z.array(z.string()).optional(),
});

export type CustomerNarrativeOutput = z.infer<typeof CustomerNarrativeOutputSchema>;

// ---------------------------------------------------------------------------
// Internal Case Output Schema
// ---------------------------------------------------------------------------

export const InternalCaseOutputSchema = z.object({
  title: z.string(),
  deal_summary: z.object({
    acv: z.string(),
    tcv: z.string(),
    term_years: z.number(),
    quantified_value_range: z.string(),
    vp_ratio: z.string(),
    strategic_importance: z.string(),
  }),
  value_analysis: z.object({
    total_quantified_value: z.object({
      low: z.string(),
      high: z.string(),
      unit: z.string(),
    }),
    key_drivers: z.array(z.object({
      name: z.string(),
      impact: z.string(),
      confidence: z.number().min(0).max(1),
      claim_id: z.string(),
    })),
  }),
  competitive_context: z.object({
    primary_competitors: z.array(z.object({
      name: z.string(),
      positioning: z.string(),
      threat_level: z.enum(["high", "medium", "low"]),
    })),
    our_advantages: z.array(z.string()),
    competitive_risks: z.array(z.object({
      risk: z.string(),
      mitigation: z.string(),
    })),
  }),
  risk_assessment: z.array(z.object({
    category: z.string(),
    description: z.string(),
    likelihood: z.enum(["high", "medium", "low"]),
    financial_impact: z.string(),
    mitigation: z.string(),
    owner: z.string(),
  })),
  assumption_quality: z.object({
    overall_rating: z.enum(["high", "medium", "low"]),
    critical_assumptions: z.array(z.object({
      assumption: z.string(),
      quality: z.string(),
      validated: z.boolean(),
      evidence_strength: z.string(),
    })),
    gaps: z.array(z.string()),
  }),
  integrity_status: z.object({
    score: z.number().min(0).max(1),
    vetoed: z.boolean(),
    critical_issues: z.array(z.string()),
    recommended_actions: z.array(z.string()),
  }),
  recommendation: z.object({
    decision: z.enum(["proceed", "conditional", "defer", "pass"]),
    conditions: z.array(z.string()),
    rationale: z.string(),
  }),
  next_steps: z.array(z.object({
    action: z.string(),
    owner: z.string(),
    deadline: z.string(),
    priority: z.enum(["high", "medium", "low"]),
  })),
  provenance_refs: z.array(z.string()),
  // Traceability fields
  data_claim_ids: z.array(z.string()).optional(),
});

export type InternalCaseOutput = z.infer<typeof InternalCaseOutputSchema>;

// ---------------------------------------------------------------------------
// Generator Input Types
// ---------------------------------------------------------------------------

export interface GeneratorInput {
  tenantId: string;
  organizationId: string;
  caseId: string;
  valueCaseTitle: string;
  organizationName: string;
  industry?: string;
  size?: string;
  readinessScore: number;
  blockers?: string[];
}

export interface ExecutiveMemoInput extends GeneratorInput {
  valueHypothesis?: string;
  drivers: Array<{
    name: string;
    impactRange: { low: number; high: number };
    unit: string;
    confidence: number;
    provenance: { source: string; claimId: string };
  }>;
  integrityScore: number;
  vetoed: boolean;
  financials?: {
    roi: { low: number; high: number };
    npv: string;
    currency: string;
    payback: number;
  };
  assumptions: Array<{
    description: string;
    confidence: number;
    validated: boolean;
  }>;
}

export interface CFORecommendationInput extends GeneratorInput {
  scenarios: Array<{
    name: string;
    probability: number;
    roi: number;
    npv: number;
    currency: string;
    paybackMonths: number;
    claimId: string;
  }>;
  assumptions: Array<{
    description: string;
    value: string;
    sourceType: string;
    sourceId: string;
    confidence: number;
  }>;
  sensitivities: Array<{
    variable: string;
    baseValue: string;
    lowValue: string;
    highValue: string;
    impactOnNpv: string;
  }>;
  benchmarks: Array<{
    metricName: string;
    ourValue: string;
    industryMedian: string;
    comparison: string;
    benchmarkId: string;
  }>;
  riskAdjustedNpv?: string;
  riskAdjustedRoi?: number;
}

export interface CustomerNarrativeInput extends GeneratorInput {
  buyer?: {
    persona: string;
    role: string;
    painPoints: string[];
    priorities: string[];
  };
  industryContext?: {
    trends: string[];
    challenges: string[];
  };
  drivers: Array<{
    name: string;
    impactRange: { low: number; high: number };
    unit: string;
    industryFraming: string;
    evidence: string;
  }>;
  benchmarks: Array<{
    metricName: string;
    topQuartile: string;
    median: string;
    comparisonSummary: string;
    source: string;
  }>;
  proofPoints: Array<{
    headline: string;
    description: string;
    evidence: string;
    confidence: number;
  }>;
}

export interface InternalCaseInput extends GeneratorInput {
  deal: {
    stage: string;
    expectedCloseDate?: string;
    economics?: {
      acv: string;
      tcv: string;
      term: number;
      expansionPotential: string;
      servicesValue: string;
    };
  };
  valueModel: {
    totalValue: { low: number; high: number; unit: string };
    vpRatio: string;
    drivers: Array<{
      name: string;
      impact: string;
      confidence: number;
      claimId: string;
    }>;
  };
  competitors?: Array<{
    name: string;
    positioning: string;
  }>;
  competitiveAdvantages?: Array<{
    advantage: string;
    supportingEvidence: string;
  }>;
  competitiveRisks?: Array<{
    risk: string;
    mitigationStrategy: string;
  }>;
  risks: Array<{
    category: string;
    description: string;
    likelihood: "high" | "medium" | "low";
    impact: string;
    mitigation: string;
  }>;
  assumptions: Array<{
    description: string;
    quality: string;
    validated: boolean;
  }>;
  integrity: {
    score: number;
    vetoed: boolean;
    criticalIssues?: string[];
  };
}
