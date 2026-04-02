import {
  HypothesisConfidenceSchema,
  HypothesisStatusSchema,
  ValueHypothesisSchema,
  ValueRangeSchema,
  type ValueHypothesis,
} from "@valueos/shared/domain";
import { z } from "zod";

export const HypothesisOutputEnvelopeSchema = z.object({
  id: z.string().uuid(),
  case_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  agent_run_id: z.string().uuid().nullable(),
  hypotheses: z.array(z.unknown()),
  kpis: z.array(z.string()),
  confidence: HypothesisConfidenceSchema.nullable(),
  reasoning: z.string().nullable(),
  hallucination_check: z.boolean().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type HypothesisOutputEnvelope = z.infer<typeof HypothesisOutputEnvelopeSchema>;

const LegacyHypothesisSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(10),
  category: z.string().min(1),
  estimated_impact: z
    .object({
      low: z.number(),
      high: z.number(),
      unit: z.string(),
      timeframe_months: z.number(),
    })
    .nullable()
    .optional(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  kpi_targets: z.array(z.string()).default([]),
});

type LegacyHypothesis = z.infer<typeof LegacyHypothesisSchema>;

const CanonicalHypothesisPayloadSchema = ValueHypothesisSchema.extend({
  title: z.string().min(1).optional(),
  evidence: z.array(z.string()).optional(),
  assumptions: z.array(z.string()).optional(),
  kpi_targets: z.array(z.string()).optional(),
  confidence_score: z.number().min(0).max(1).optional(),
});

type CanonicalHypothesisPayload = z.infer<typeof CanonicalHypothesisPayloadSchema>;

const ImpactUnitSchema = z.enum(["usd", "percent", "hours", "headcount"]);

const mapConfidenceScoreToBand = (score: number): z.infer<typeof HypothesisConfidenceSchema> => {
  if (score >= 0.75) return "high";
  if (score >= 0.5) return "medium";
  return "low";
};

const normalizeLegacyImpact = (
  impact: LegacyHypothesis["estimated_impact"],
): z.infer<typeof ValueRangeSchema> | undefined => {
  if (!impact) return undefined;

  const unitResult = ImpactUnitSchema.safeParse(impact.unit);
  if (!unitResult.success) return undefined;

  return {
    low: String(impact.low),
    high: String(impact.high),
    unit: unitResult.data,
    timeframe_months: Math.max(1, Math.trunc(impact.timeframe_months)),
  };
};

export interface HypothesisPresentation {
  title: string;
  confidenceScore: number;
  evidence: string[];
  assumptions: string[];
  kpiTargets: string[];
}

export interface NormalizedHypothesis {
  entity: ValueHypothesis;
  presentation: HypothesisPresentation;
}

export interface HypothesisOutput {
  id: string;
  case_id: string;
  organization_id: string;
  agent_run_id: string | null;
  hypotheses: NormalizedHypothesis[];
  kpis: string[];
  confidence: "high" | "medium" | "low" | null;
  reasoning: string | null;
  hallucination_check: boolean | null;
  created_at: string;
  updated_at: string;
}

const normalizeCanonicalHypothesis = (
  hypothesis: CanonicalHypothesisPayload,
): NormalizedHypothesis => {
  const entity = ValueHypothesisSchema.parse(hypothesis);
  const confidenceScore = hypothesis.confidence_score
    ?? (entity.confidence === "high" ? 0.85 : entity.confidence === "medium" ? 0.65 : 0.35);

  return {
    entity,
    presentation: {
      title: hypothesis.title ?? entity.description,
      confidenceScore,
      evidence: hypothesis.evidence ?? [],
      assumptions: hypothesis.assumptions ?? [],
      kpiTargets: hypothesis.kpi_targets ?? [],
    },
  };
};

const normalizeLegacyHypothesis = (
  hypothesis: LegacyHypothesis,
  output: HypothesisOutputEnvelope,
): NormalizedHypothesis => {
  const normalizedConfidenceBand = mapConfidenceScoreToBand(hypothesis.confidence);
  const normalizedStatus = HypothesisStatusSchema.parse("proposed");
  const estimatedValue = normalizeLegacyImpact(hypothesis.estimated_impact);

  const candidate: ValueHypothesis = {
    id: crypto.randomUUID(),
    organization_id: output.organization_id,
    opportunity_id: output.case_id,
    description: hypothesis.description,
    category: hypothesis.category,
    estimated_value: estimatedValue,
    confidence: normalizedConfidenceBand,
    status: normalizedStatus,
    evidence_ids: [],
    hallucination_check: output.hallucination_check ?? undefined,
    created_at: output.created_at,
    updated_at: output.updated_at,
  };

  const entity = ValueHypothesisSchema.parse(candidate);

  return {
    entity,
    presentation: {
      title: hypothesis.title,
      confidenceScore: hypothesis.confidence,
      evidence: hypothesis.evidence,
      assumptions: hypothesis.assumptions,
      kpiTargets: hypothesis.kpi_targets,
    },
  };
};

const normalizeHypothesis = (
  hypothesis: unknown,
  output: HypothesisOutputEnvelope,
): NormalizedHypothesis => {
  const canonicalParsed = CanonicalHypothesisPayloadSchema.safeParse(hypothesis);
  if (canonicalParsed.success) {
    return normalizeCanonicalHypothesis(canonicalParsed.data);
  }

  const legacyParsed = LegacyHypothesisSchema.safeParse(hypothesis);
  if (legacyParsed.success) {
    return normalizeLegacyHypothesis(legacyParsed.data, output);
  }

  throw new Error("Hypothesis item schema mismatch");
};

export const normalizeHypothesisOutput = (payload: unknown): HypothesisOutput => {
  const parsedPayload = HypothesisOutputEnvelopeSchema.parse(payload);
  const hypotheses = parsedPayload.hypotheses.map((hypothesis) => normalizeHypothesis(hypothesis, parsedPayload));

  return {
    ...parsedPayload,
    hypotheses,
  };
};
