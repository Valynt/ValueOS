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

export const VALUE_LIFECYCLE_SCHEMA_VERSION = "v1" as const;
export type ValueLifecycleSchemaVersionLiteral = typeof VALUE_LIFECYCLE_SCHEMA_VERSION;
export type ValueLifecycleSchemaVersion = ValueLifecycleSchemaVersionLiteral;
export type ValueLifecycleSchemaVersionV1 = ValueLifecycleSchemaVersion;

/**
 * Shared version literal alias for lifecycle schemas.
 * Keep stage schemas bound to this alias so a future v2 upgrade remains centralized.
 */
export const ValueLifecycleSchemaVersionLiteral = z.literal(VALUE_LIFECYCLE_SCHEMA_VERSION);
export const ValueLifecycleSchemaVersionV1Literal = ValueLifecycleSchemaVersionLiteral;

const LifecycleSchemaVersionShape = {
  schemaVersion: ValueLifecycleSchemaVersionV1Literal,
} as const;

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
export const OpportunityContextV1Schema = z.object({
  ...AgentMetaShape,
  ...LifecycleSchemaVersionShape,
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

export type OpportunityContextV1 = z.infer<typeof OpportunityContextV1Schema>;

/**
 * DRAFTING
 */
export const ValueHypothesisDraftV1Schema = z.object({
  ...AgentMetaShape,
  ...LifecycleSchemaVersionShape,
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

export type ValueHypothesisDraftV1 = z.infer<typeof ValueHypothesisDraftV1Schema>;

/**
 * FINANCIAL / MODELING
 */
export const FinancialModelV1Schema = z.object({
  ...AgentMetaShape,
  ...LifecycleSchemaVersionShape,
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

export type FinancialModelV1 = z.infer<typeof FinancialModelV1Schema>;

/**
 * VALIDATING
 */
export const IntegrityAssessmentV1Schema = z.object({
  ...AgentMetaShape,
  ...LifecycleSchemaVersionShape,
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

export type IntegrityAssessmentV1 = z.infer<typeof IntegrityAssessmentV1Schema>;

/**
 * COMPOSING
 */
export const ExecutiveNarrativeV1Schema = z.object({
  ...AgentMetaShape,
  ...LifecycleSchemaVersionShape,
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

export type ExecutiveNarrativeV1 = z.infer<typeof ExecutiveNarrativeV1Schema>;

/**
 * Versioned schema composition pattern.
 *
 * - Keep per-version stage schemas exported (e.g., `OpportunityContextV1Schema`)
 * - Build version-level lifecycle unions (e.g., `ValueLifecycleV1Schema`)
 * - `ValueLifecycleSchema` can evolve into `z.union([ValueLifecycleV1Schema, ValueLifecycleV2Schema])`
 */
export const ValueLifecycleV1Schema = z.union([
  OpportunityContextV1Schema,
  ValueHypothesisDraftV1Schema,
  FinancialModelV1Schema,
  IntegrityAssessmentV1Schema,
  ExecutiveNarrativeV1Schema,
]);

/**
 * Reserved extension point for future lifecycle versions.
 * Add `ValueLifecycleV2Schema` and widen `ValueLifecycleSchema`/`ValueLifecycle` when v2 lands.
 */
// export const ValueLifecycleV2Schema = z.union([]);

export const ValueLifecycleSchemasByVersion = {
  v1: ValueLifecycleV1Schema,
} as const;

// Backward-compatible aliases (existing imports remain stable).
export const OpportunityContextSchema = OpportunityContextV1Schema;
export const ValueHypothesisDraftSchema = ValueHypothesisDraftV1Schema;
export const FinancialModelSchema = FinancialModelV1Schema;
export const IntegrityAssessmentSchema = IntegrityAssessmentV1Schema;
export const ExecutiveNarrativeSchema = ExecutiveNarrativeV1Schema;

export const ValueLifecycleSchema = ValueLifecycleV1Schema;

export type OpportunityContext = OpportunityContextV1;
export type ValueHypothesisDraft = ValueHypothesisDraftV1;
export type FinancialModel = FinancialModelV1;
export type IntegrityAssessment = IntegrityAssessmentV1;
export type ExecutiveNarrative = ExecutiveNarrativeV1;

export type ValueLifecycleV1 = z.infer<typeof ValueLifecycleV1Schema>;
export type ValueLifecycle = ValueLifecycleV1;

export type ValueLifecycleEventPayload = Omit<ValueLifecycle, "schemaVersion"> & {
  schemaVersion: ValueLifecycleSchemaVersion;
  schema_version: ValueLifecycleSchemaVersion;
};

export function toValueLifecycleEventPayload(payload: ValueLifecycle): ValueLifecycleEventPayload {
  const { schemaVersion, ...rest } = ValueLifecycleSchema.parse(payload);
  return {
    ...rest,
    schemaVersion,
    schema_version: schemaVersion,
  };
}

export type ValueLifecycleEventPayloadInput = Omit<ValueLifecycle, "schemaVersion"> & {
  schemaVersion?: ValueLifecycleSchemaVersion;
  schema_version?: ValueLifecycleSchemaVersion;
};

export function fromValueLifecycleEventPayload(payload: ValueLifecycleEventPayloadInput): ValueLifecycle {
  const { schema_version, schemaVersion, ...rest } = payload;
  const resolvedSchemaVersion = schemaVersion ?? schema_version;
  return ValueLifecycleSchema.parse({
    ...rest,
    schemaVersion: resolvedSchemaVersion,
  });
}