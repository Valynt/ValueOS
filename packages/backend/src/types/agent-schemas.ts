import { z } from 'zod';

const CurrencyAmountSchema = z.object({
  amount: z.number().finite(),
  currency: z.string().min(3).max(3),
}).strict();

const ValueRangeSchema = z.object({
  low: z.number().finite(),
  expected: z.number().finite(),
  high: z.number().finite(),
}).strict();

const ConfidenceSchema = z.object({
  score: z.number().min(0).max(1),
  rationale: z.string().min(1),
}).strict();

const SourceReferenceSchema = z.object({
  sourceId: z.string().min(1),
  title: z.string().min(1),
  kind: z.enum(['internal', 'external', 'benchmark', 'assumption']),
  url: z.string().url().optional(),
}).strict();

const StakeholderSchema = z.object({
  stakeholderId: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  influence: z.enum(['low', 'medium', 'high']),
}).strict();

const MetricBaselineSchema = z.object({
  metric: z.string().min(1),
  value: z.number().finite(),
  unit: z.string().min(1),
  period: z.enum(['monthly', 'quarterly', 'annual', 'one-time']),
}).strict();

const AssumptionSchema = z.object({
  assumptionId: z.string().min(1),
  statement: z.string().min(1),
  confidence: ConfidenceSchema,
  sourceRefs: z.array(SourceReferenceSchema),
}).strict();

const ScenarioSchema = z.object({
  scenario: z.enum(['downside', 'expected', 'upside']),
  benefit: CurrencyAmountSchema,
  cost: CurrencyAmountSchema,
  netValue: CurrencyAmountSchema,
  paybackMonths: z.number().nonnegative(),
  roiPercent: z.number().finite(),
}).strict();

const IntegrityCheckSchema = z.object({
  checkId: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(['pass', 'warning', 'fail']),
  finding: z.string().min(1),
  remediation: z.string().min(1).optional(),
}).strict();

const NarrativeSectionSchema = z.object({
  heading: z.string().min(1),
  body: z.string().min(1),
  claimIds: z.array(z.string().min(1)),
}).strict();

export const OpportunityContextSchema = z.object({
  stage: z.literal('INITIATED'),
  opportunityId: z.string().min(1),
  organizationId: z.string().min(1),
  accountName: z.string().min(1),
  opportunityName: z.string().min(1),
  problemStatement: z.string().min(1),
  stakeholders: z.array(StakeholderSchema),
  baselineMetrics: z.array(MetricBaselineSchema),
  sourceRefs: z.array(SourceReferenceSchema),
  createdAt: z.string().datetime(),
}).strict();

export type OpportunityContext = z.infer<typeof OpportunityContextSchema>;

export const ValueHypothesisDraftSchema = z.object({
  stage: z.literal('DRAFTING'),
  hypothesisId: z.string().min(1),
  opportunityId: z.string().min(1),
  statement: z.string().min(1),
  valueDriver: z.string().min(1),
  valueRange: ValueRangeSchema,
  confidence: ConfidenceSchema,
  assumptions: z.array(AssumptionSchema),
  sourceRefs: z.array(SourceReferenceSchema),
  draftedAt: z.string().datetime(),
}).strict();

export type ValueHypothesisDraft = z.infer<typeof ValueHypothesisDraftSchema>;

export const FinancialModelSchema = z.object({
  stage: z.literal('FINANCIAL'),
  modelId: z.string().min(1),
  hypothesisId: z.string().min(1),
  modelVersion: z.string().min(1),
  scenarios: z.array(ScenarioSchema).min(1),
  assumptions: z.array(AssumptionSchema),
  confidence: ConfidenceSchema,
  generatedAt: z.string().datetime(),
}).strict();

export type FinancialModel = z.infer<typeof FinancialModelSchema>;

export const IntegrityAssessmentSchema = z.object({
  stage: z.literal('VALIDATING'),
  assessmentId: z.string().min(1),
  modelId: z.string().min(1),
  verdict: z.enum(['approved', 'conditional', 'rejected']),
  checks: z.array(IntegrityCheckSchema).min(1),
  residualRisk: z.enum(['low', 'medium', 'high']),
  assessedAt: z.string().datetime(),
}).strict();

export type IntegrityAssessment = z.infer<typeof IntegrityAssessmentSchema>;

export const ExecutiveNarrativeSchema = z.object({
  stage: z.literal('COMPOSING'),
  narrativeId: z.string().min(1),
  audience: z.enum(['executive', 'finance', 'operator']),
  headline: z.string().min(1),
  executiveSummary: z.string().min(1),
  sections: z.array(NarrativeSectionSchema).min(1),
  confidence: ConfidenceSchema,
  generatedAt: z.string().datetime(),
}).strict();

export type ExecutiveNarrative = z.infer<typeof ExecutiveNarrativeSchema>;
