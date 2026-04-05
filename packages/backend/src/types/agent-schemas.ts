import { z } from "zod";
import {
  AssumptionSchema,
  ConfidenceScoreSchema,
  EvidenceRefSchema,
  StakeholderSchema,
} from "./domain-primitives";

export const AgentMetaSchema = z.object({
  traceId: z.string().min(1),
  agentId: z.string().min(1),
}).strict();

const AgentMetaEventSchema = z.object({
  trace_id: z.string().min(1),
  agent_id: z.string().min(1),
}).strict();

export type AgentMeta = z.infer<typeof AgentMetaSchema>;
export type AgentMetaEvent = z.infer<typeof AgentMetaEventSchema>;

export function toAgentMetaEvent(meta: AgentMeta): AgentMetaEvent {
  return AgentMetaEventSchema.parse({
    trace_id: meta.traceId,
    agent_id: meta.agentId,
  });
}

export function fromAgentMetaEvent(meta: AgentMetaEvent): AgentMeta {
  return AgentMetaSchema.parse({
    traceId: meta.trace_id,
    agentId: meta.agent_id,
  });
}

/**
 * INITIATED
 */
const OpportunityContextBaseSchema = z.object({
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

export const OpportunityContextSchema = OpportunityContextBaseSchema.merge(AgentMetaSchema);
export type OpportunityContext = z.infer<typeof OpportunityContextSchema>;
export function buildOpportunityContext(payload: OpportunityContext): OpportunityContext {
  return OpportunityContextSchema.parse(payload);
}

/**
 * DRAFTING
 */
const ValueHypothesisDraftBaseSchema = z.object({
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

export const ValueHypothesisDraftSchema = ValueHypothesisDraftBaseSchema.merge(AgentMetaSchema);
export type ValueHypothesisDraft = z.infer<typeof ValueHypothesisDraftSchema>;
export function buildValueHypothesisDraft(payload: ValueHypothesisDraft): ValueHypothesisDraft {
  return ValueHypothesisDraftSchema.parse(payload);
}

/**
 * FINANCIAL / MODELING
 */
const FinancialModelBaseSchema = z.object({
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

export const FinancialModelSchema = FinancialModelBaseSchema.merge(AgentMetaSchema);
export type FinancialModel = z.infer<typeof FinancialModelSchema>;
export function buildFinancialModel(payload: FinancialModel): FinancialModel {
  return FinancialModelSchema.parse(payload);
}

/**
 * VALIDATING
 */
const IntegrityAssessmentBaseSchema = z.object({
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

export const IntegrityAssessmentSchema = IntegrityAssessmentBaseSchema.merge(AgentMetaSchema);
export type IntegrityAssessment = z.infer<typeof IntegrityAssessmentSchema>;
export function buildIntegrityAssessment(payload: IntegrityAssessment): IntegrityAssessment {
  return IntegrityAssessmentSchema.parse(payload);
}

/**
 * COMPOSING
 */
const ExecutiveNarrativeBaseSchema = z.object({
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

export const ExecutiveNarrativeSchema = ExecutiveNarrativeBaseSchema.merge(AgentMetaSchema);
export type ExecutiveNarrative = z.infer<typeof ExecutiveNarrativeSchema>;
export function buildExecutiveNarrative(payload: ExecutiveNarrative): ExecutiveNarrative {
  return ExecutiveNarrativeSchema.parse(payload);
}
