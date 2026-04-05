import { z } from "zod";
import {
  AssumptionSchema,
  ConfidenceScoreSchema,
  EvidenceRefSchema,
  StakeholderSchema,
} from "./domain-primitives";

export const VALUE_LIFECYCLE_SCHEMA_VERSION_V1 = "v1" as const;
export type ValueLifecycleSchemaVersionV1 = typeof VALUE_LIFECYCLE_SCHEMA_VERSION_V1;
export type ValueLifecycleSchemaVersion = ValueLifecycleSchemaVersionV1;

export const ValueLifecycleSchemaVersionV1Schema = z.literal(VALUE_LIFECYCLE_SCHEMA_VERSION_V1);

/**
 * INITIATED
 */
export const OpportunityContextSchemaV1 = z.object({
  schemaVersion: ValueLifecycleSchemaVersionV1Schema,
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

export type OpportunityContextV1 = z.infer<typeof OpportunityContextSchemaV1>;

/**
 * DRAFTING
 */
export const ValueHypothesisDraftSchemaV1 = z.object({
  schemaVersion: ValueLifecycleSchemaVersionV1Schema,
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

export type ValueHypothesisDraftV1 = z.infer<typeof ValueHypothesisDraftSchemaV1>;

/**
 * FINANCIAL / MODELING
 */
export const FinancialModelSchemaV1 = z.object({
  schemaVersion: ValueLifecycleSchemaVersionV1Schema,
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

export type FinancialModelV1 = z.infer<typeof FinancialModelSchemaV1>;

/**
 * VALIDATING
 */
export const IntegrityAssessmentSchemaV1 = z.object({
  schemaVersion: ValueLifecycleSchemaVersionV1Schema,
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

export type IntegrityAssessmentV1 = z.infer<typeof IntegrityAssessmentSchemaV1>;

/**
 * COMPOSING
 */
export const ExecutiveNarrativeSchemaV1 = z.object({
  schemaVersion: ValueLifecycleSchemaVersionV1Schema,
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

export type ExecutiveNarrativeV1 = z.infer<typeof ExecutiveNarrativeSchemaV1>;

export const ValueLifecycleSchemaV1 = z.discriminatedUnion("stage", [
  OpportunityContextSchemaV1,
  ValueHypothesisDraftSchemaV1,
  FinancialModelSchemaV1,
  IntegrityAssessmentSchemaV1,
  ExecutiveNarrativeSchemaV1,
]);

/**
 * Extension point for future versions:
 *   export const ValueLifecycleSchema = z.union([ValueLifecycleSchemaV1, ValueLifecycleSchemaV2]);
 */
export const ValueLifecycleSchema = ValueLifecycleSchemaV1;

export type ValueLifecycleV1 = z.infer<typeof ValueLifecycleSchemaV1>;
export type ValueLifecycle = z.infer<typeof ValueLifecycleSchema>;

/**
 * Backward-compatible exports retained for existing imports.
 * These currently point at v1 schemas/types.
 */
export const OpportunityContextSchema = OpportunityContextSchemaV1;
export type OpportunityContext = OpportunityContextV1;
export const ValueHypothesisDraftSchema = ValueHypothesisDraftSchemaV1;
export type ValueHypothesisDraft = ValueHypothesisDraftV1;
export const FinancialModelSchema = FinancialModelSchemaV1;
export type FinancialModel = FinancialModelV1;
export const IntegrityAssessmentSchema = IntegrityAssessmentSchemaV1;
export type IntegrityAssessment = IntegrityAssessmentV1;
export const ExecutiveNarrativeSchema = ExecutiveNarrativeSchemaV1;
export type ExecutiveNarrative = ExecutiveNarrativeV1;

export function serializeValueLifecyclePayload(payload: ValueLifecycle): string {
  return JSON.stringify(ValueLifecycleSchema.parse(payload));
}

export function deserializeValueLifecyclePayload(payload: string | unknown): ValueLifecycle {
  const raw = typeof payload === "string" ? JSON.parse(payload) : payload;
  return ValueLifecycleSchema.parse(raw);
}
