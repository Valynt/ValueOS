import { z } from "zod";
import {
  AssumptionSchema,
  ConfidenceScoreSchema,
  EvidenceRefSchema,
  StakeholderSchema,
} from "./domain-primitives";

export const OpportunityContextSchema = z.object({
  organizationId: z.string().uuid(),
  opportunityId: z.string().uuid(),
  accountName: z.string().min(1),
  problemStatement: z.string().min(1),
  stakeholders: z.array(StakeholderSchema),
  evidence: z.array(EvidenceRefSchema),
  assumptions: z.array(AssumptionSchema),
  confidence: ConfidenceScoreSchema,
}).strict();

export type OpportunityContext = z.infer<typeof OpportunityContextSchema>;

export const ValueHypothesisDraftSchema = z.object({
  organizationId: z.string().uuid(),
  opportunityId: z.string().uuid(),
  hypotheses: z.array(z.object({
    id: z.string().uuid(),
    title: z.string().min(1),
    statement: z.string().min(1),
    assumptions: z.array(AssumptionSchema),
    evidence: z.array(EvidenceRefSchema),
    confidence: ConfidenceScoreSchema,
  }).strict()),
}).strict();

export type ValueHypothesisDraft = z.infer<typeof ValueHypothesisDraftSchema>;

export const FinancialModelSchema = z.object({
  organizationId: z.string().uuid(),
  opportunityId: z.string().uuid(),
  scenario: z.enum(["conservative", "base", "upside"]),
  assumptions: z.array(AssumptionSchema),
  roi: z.number().finite(),
  npv: z.number().finite(),
  paybackMonths: z.number().finite().min(0),
  confidence: ConfidenceScoreSchema,
  evidence: z.array(EvidenceRefSchema),
}).strict();

export type FinancialModel = z.infer<typeof FinancialModelSchema>;

export const IntegrityAssessmentSchema = z.object({
  organizationId: z.string().uuid(),
  opportunityId: z.string().uuid(),
  passed: z.boolean(),
  findings: z.array(z.object({
    rule: z.string().min(1),
    severity: z.enum(["low", "medium", "high", "critical"]),
    message: z.string().min(1),
    evidence: z.array(EvidenceRefSchema),
  }).strict()),
  confidence: ConfidenceScoreSchema,
}).strict();

export type IntegrityAssessment = z.infer<typeof IntegrityAssessmentSchema>;

export const ExecutiveNarrativeSchema = z.object({
  organizationId: z.string().uuid(),
  opportunityId: z.string().uuid(),
  headline: z.string().min(1),
  summary: z.string().min(1),
  keyAssumptions: z.array(AssumptionSchema),
  keyEvidence: z.array(EvidenceRefSchema),
  stakeholderReadout: z.array(StakeholderSchema),
  confidence: ConfidenceScoreSchema,
}).strict();

export type ExecutiveNarrative = z.infer<typeof ExecutiveNarrativeSchema>;
