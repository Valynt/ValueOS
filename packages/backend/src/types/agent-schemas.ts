import { z } from "zod";
import {
  AssumptionSchema as BaseAssumptionSchema,
  ConfidenceScoreSchema,
  EvidenceRefSchema,
  StakeholderSchema,
} from "./domain-primitives";

export const AgentMetaSchema = z.object({
  traceId: z.string().min(1),
  agentId: z.string().min(1),
}).strict();
const AgentMetaShape = AgentMetaSchema.shape;

export type AgentMetadata = z.infer<typeof AgentMetaSchema>;

/**
 * Canonical translation adapter:
 * - Payloads and API contracts use camelCase (`traceId`, `agentId`)
 * - Logs/events use snake_case (`trace_id`, `agent_id`)
 */
export function toAgentEventMetadata(metadata: AgentMetadata): { trace_id: string; agent_id: string } {
  return {
    trace_id: metadata.traceId,
    agent_id: metadata.agentId,
  };
}

export function fromAgentEventMetadata(metadata: { trace_id: string; agent_id: string }): AgentMetadata {
  return {
    traceId: metadata.trace_id,
    agentId: metadata.agent_id,
  };
}

const SourceReferenceSchema = EvidenceRefSchema;
const LinkedEvidenceRefsSchema = z.array(SourceReferenceSchema).min(1, "assumptions require at least one linked evidence reference");

const BaseAssumptionSchemaWithoutEvidence = BaseAssumptionSchema.omit({
  evidence: true,
});

const SupportedAssumptionLinkageSchema = BaseAssumptionSchemaWithoutEvidence.extend({
  evidenceState: z.literal("supported"),
  evidenceRefs: LinkedEvidenceRefsSchema,
}).strict();

const PendingAssumptionLinkageSchema = BaseAssumptionSchemaWithoutEvidence.extend({
  evidenceState: z.literal("pending"),
  pendingReason: z.string().min(1),
  evidenceRefs: z.array(SourceReferenceSchema).default([]),
}).strict();

export const AssumptionSchema = z.discriminatedUnion("evidenceState", [
  SupportedAssumptionLinkageSchema,
  PendingAssumptionLinkageSchema,
]);

function validateAssumptionEvidenceLinkage(
  assumptions: z.infer<typeof AssumptionSchema>[],
  ctx: z.RefinementCtx
): void {
  assumptions.forEach((assumption, index) => {
    if (assumption.evidenceState === "supported" && assumption.evidenceRefs.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "supported assumptions require linked evidence references",
        path: ["assumptions", index, "evidenceRefs"],
      });
    }

    if (assumption.evidenceState === "pending" && (!assumption.pendingReason || assumption.pendingReason.trim().length < 1)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "pending assumptions require pendingReason",
        path: ["assumptions", index, "pendingReason"],
      });
    }

    if (assumption.evidenceState === "pending" && assumption.evidenceRefs.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "pending assumptions must not include evidence refs until support is provided",
        path: ["assumptions", index, "evidenceRefs"],
      });
    }
  });
}

/**
 * INITIATED
 */
export const OpportunityContextSchema = z.object({
  ...AgentMetaShape,
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
  ...AgentMetaShape,
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
}).strict().superRefine((payload, ctx) => {
  validateAssumptionEvidenceLinkage(payload.assumptions, ctx);
});

export type ValueHypothesisDraft = z.infer<typeof ValueHypothesisDraftSchema>;

/**
 * FINANCIAL / MODELING
 */
export const FinancialModelSchema = z.object({
  ...AgentMetaShape,
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
}).strict().superRefine((payload, ctx) => {
  validateAssumptionEvidenceLinkage(payload.assumptions, ctx);
});

export type FinancialModel = z.infer<typeof FinancialModelSchema>;

/**
 * VALIDATING
 */
export const IntegrityAssessmentSchema = z.object({
  ...AgentMetaShape,
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
  ...AgentMetaShape,
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

export const ValueLifecycleSchema = z.union([
  OpportunityContextSchema,
  ValueHypothesisDraftSchema,
  FinancialModelSchema,
  IntegrityAssessmentSchema,
  ExecutiveNarrativeSchema,
]);

export type ValueLifecycle = z.infer<typeof ValueLifecycleSchema>;
