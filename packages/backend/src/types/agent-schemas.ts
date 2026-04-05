import { z } from "zod";
import {
  AssumptionSchema,
  ConfidenceScoreSchema,
  EvidenceRefSchema,
  StakeholderSchema,
} from "./domain-primitives";

/**
 * INITIATED
 */
export const OpportunityContextSchema = z.object({
  stage: z.literal("INITIATED"),

  organizationId: z.string().uuid(),
  opportunityId: z.string().uuid(),

  accountName: z.string().min(1),
  opportunityName: z.string().min(1).optional(),
  problemStatement: z.string().min(1),

  stakeholders: z.array(StakeholderSchema),

  // from main branch (valuable baseline context)
  baselineMetrics: z.array(
    z.object({
      metric: z.string().min(1),
      value: z.number().finite(),
      unit: z.string().min(1),
      period: z.enum(["monthly", "quarterly", "annual", "one-time"]),
    }).strict()
  ).default([]),

  evidence: z.array(EvidenceRefSchema),
  assumptions: z.array(AssumptionSchema),

  confidence: ConfidenceScoreSchema,

  createdAt: z.string().datetime(),
}).strict();

export type OpportunityContext = z.infer<typeof OpportunityContextSchema>;

/**
 * DRAFTING
 */
export const ValueHypothesisDraftSchema = z.object({
  stage: z.literal("DRAFTING"),

  organizationId: z.string().uuid(),
  opportunityId: z.string().uuid(),

  hypothesisId: z.string().uuid(),

  title: z.string().min(1),
  statement: z.string().min(1),
  valueDriver: z.string().min(1),

  // from main branch
  valueRange: z.object({
    low: z.number().finite(),
    expected: z.number().finite(),
    high: z.number().finite(),
  }).strict(),

  assumptions: z.array(AssumptionSchema),
  evidence: z.array(EvidenceRefSchema),

  confidence: ConfidenceScoreSchema,

  draftedAt: z.string().datetime(),
}).strict();

export type ValueHypothesisDraft = z.infer<typeof ValueHypothesisDraftSchema>;

/**
 * FINANCIAL / MODELING
 */
export const FinancialModelSchema = z.object({
  stage: z.literal("FINANCIAL"),

  organizationId: z.string().uuid(),
  opportunityId: z.string().uuid(),

  modelId: z.string().uuid(),
  hypothesisId: z.string().uuid(),
  modelVersion: z.string().min(1),

  scenarios: z.array(
    z.object({
      scenario: z.enum(["downside", "expected", "upside"]),
      benefit: z.number().finite(),
      cost: z.number().finite(),
      netValue: z.number().finite(),
      paybackMonths: z.number().nonnegative(),
      roiPercent: z.number().finite(),
    }).strict()
  ).min(1),

  assumptions: z.array(AssumptionSchema),
  evidence: z.array(EvidenceRefSchema),

  confidence: ConfidenceScoreSchema,

  generatedAt: z.string().datetime(),
}).strict();

export type FinancialModel = z.infer<typeof FinancialModelSchema>;

/**
 * VALIDATING
 */
export const IntegrityAssessmentSchema = z.object({
  stage: z.literal("VALIDATING"),

  organizationId: z.string().uuid(),
  opportunityId: z.string().uuid(),

  assessmentId: z.string().uuid(),
  modelId: z.string().uuid(),

  verdict: z.enum(["approved", "conditional", "rejected"]),

  checks: z.array(
    z.object({
      checkId: z.string().min(1),
      name: z.string().min(1),
      status: z.enum(["pass", "warning", "fail"]),
      finding: z.string().min(1),
      remediation: z.string().min(1).optional(),
    }).strict()
  ).min(1),

  residualRisk: z.enum(["low", "medium", "high"]),

  confidence: ConfidenceScoreSchema,

  assessedAt: z.string().datetime(),
}).strict();

export type IntegrityAssessment = z.infer<typeof IntegrityAssessmentSchema>;

/**
 * COMPOSING
 */
export const ExecutiveNarrativeSchema = z.object({
  stage: z.literal("COMPOSING"),

  organizationId: z.string().uuid(),
  opportunityId: z.string().uuid(),

  narrativeId: z.string().uuid(),

  audience: z.enum(["executive", "finance", "operator"]),

  headline: z.string().min(1),
  executiveSummary: z.string().min(1),

  sections: z.array(
    z.object({
      heading: z.string().min(1),
      body: z.string().min(1),
      claimIds: z.array(z.string().uuid()),
    }).strict()
  ).min(1),

  evidence: z.array(EvidenceRefSchema),
  assumptions: z.array(AssumptionSchema),

  confidence: ConfidenceScoreSchema,

  generatedAt: z.string().datetime(),
}).strict();

export type ExecutiveNarrative = z.infer<typeof ExecutiveNarrativeSchema>;

export const ValueLifecycleSchema = z.discriminatedUnion("stage", [
  OpportunityContextSchema,
  ValueHypothesisDraftSchema,
  FinancialModelSchema,
  IntegrityAssessmentSchema,
  ExecutiveNarrativeSchema,
]);

export type ValueLifecycle = z.infer<typeof ValueLifecycleSchema>;
