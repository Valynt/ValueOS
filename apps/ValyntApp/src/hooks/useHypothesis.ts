/**
 * useHypothesis
 *
 * Fetches the latest hypothesis output for a value case and provides
 * a mutation to invoke the OpportunityAgent.
 *
 * Phase 8: migrated from raw fetch() to UnifiedApiClient (ADR-0014).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  HypothesisConfidenceSchema,
  HypothesisStatusSchema,
  ValueHypothesisSchema,
  ValueRangeSchema,
  type ValueHypothesis,
} from "@valueos/shared/domain";
import { z } from "zod";

import { apiClient } from "@/api/client/unified-api-client";
import { useTenant } from "@/contexts/TenantContext";

// ---------------------------------------------------------------------------
// Boundary schemas + normalized model
// ---------------------------------------------------------------------------

const LegacyHypothesisSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
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
  confidence: z.number(),
  evidence: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  kpi_targets: z.array(z.string()).default([]),
});

const HypothesisOutputApiSchema = z.object({
  id: z.string().uuid(),
  case_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  agent_run_id: z.string().uuid().nullable(),
  hypotheses: z.array(z.unknown()),
  kpis: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low"]).nullable(),
  reasoning: z.string().nullable(),
  hallucination_check: z.boolean().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

const HypothesisApiResponseSchema = z.object({
  data: HypothesisOutputApiSchema.nullable(),
});

export interface NormalizedValueHypothesis {
  entity: ValueHypothesis;
  title: string;
  confidenceScore: number;
  evidence: string[];
  assumptions: string[];
  kpiTargets: string[];
}

export interface HypothesisOutput {
  id: string;
  case_id: string;
  organization_id: string;
  agent_run_id: string | null;
  hypotheses: NormalizedValueHypothesis[];
  kpis: string[];
  confidence: "high" | "medium" | "low" | null;
  reasoning: string | null;
  hallucination_check: boolean | null;
  created_at: string;
  updated_at: string;
}

const ImpactUnitSchema = z.enum(["usd", "percent", "hours", "headcount"]);

const mapConfidenceScoreToBand = (score: number): z.infer<typeof HypothesisConfidenceSchema> => {
  if (score >= 0.75) return "high";
  if (score >= 0.5) return "medium";
  return "low";
};

const normalizeLegacyImpact = (
  impact: z.infer<typeof LegacyHypothesisSchema>['estimated_impact'],
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

const normalizeHypothesis = (
  hypothesis: unknown,
  output: z.infer<typeof HypothesisOutputApiSchema>,
): NormalizedValueHypothesis => {
  const parsed = LegacyHypothesisSchema.parse(hypothesis);
  const normalizedConfidenceBand = mapConfidenceScoreToBand(parsed.confidence);
  const normalizedStatus = HypothesisStatusSchema.parse("proposed");
  const estimatedValue = normalizeLegacyImpact(parsed.estimated_impact);

  const candidate: ValueHypothesis = {
    id: crypto.randomUUID(),
    organization_id: output.organization_id,
    opportunity_id: output.case_id,
    description: parsed.description,
    category: parsed.category,
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
    title: parsed.title,
    confidenceScore: parsed.confidence,
    evidence: parsed.evidence,
    assumptions: parsed.assumptions,
    kpiTargets: parsed.kpi_targets,
  };
};

export const normalizeHypothesisOutput = (
  payload: z.infer<typeof HypothesisOutputApiSchema>,
): HypothesisOutput => {
  const hypotheses = payload.hypotheses.map((hypothesis) => normalizeHypothesis(hypothesis, payload));

  return {
    ...payload,
    hypotheses,
  };
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch the latest hypothesis output for a case.
 * Returns null data (not an error) when no run has been completed yet.
 */
export function useHypothesisOutput(caseId: string | undefined) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery<HypothesisOutput | null>({
    queryKey: ["hypothesis", caseId, tenantId],
    queryFn: async () => {
      const result = await apiClient.get<unknown>(`/api/v1/value-cases/${caseId}/hypothesis`);
      if (!result.success) throw new Error(result.error?.message ?? "Request failed");

      const parsedResponse = HypothesisApiResponseSchema.safeParse(result.data);
      if (!parsedResponse.success) {
        throw new Error("Hypothesis response shape mismatch");
      }

      if (!parsedResponse.data.data) return null;

      try {
        return normalizeHypothesisOutput(parsedResponse.data.data);
      } catch {
        throw new Error("Hypothesis payload validation failed");
      }
    },
    enabled: !!caseId && !!tenantId,
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes("404")) return false;
      return failureCount < 2;
    },
  });
}

export interface AgentInvokeResponse {
  jobId: string;
  /** Alias kept for backward compat with existing callers */
  runId: string;
  status: string;
  mode?: "direct" | "kafka";
  result?: unknown;
  confidence?: string;
  reasoning?: string;
  warnings?: string[];
  agentId?: string;
}

/**
 * Invoke the OpportunityAgent for a case.
 * On success, invalidates the hypothesis query so the stage reloads.
 */
export function useRunHypothesisAgent(caseId: string | undefined) {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useMutation<AgentInvokeResponse, Error, { companyName?: string; query?: string }>({
    mutationFn: async (input) => {
      const idempotency_key = `opportunity:${caseId ?? "unknown"}:${(input.query ?? input.companyName ?? "Analyze this value case").trim().toLowerCase()}`;
      const res = await apiClient.post<{ data: AgentInvokeResponse }>(
        `/api/agents/opportunity/invoke`,
        {
          caseId,
          value_case_id: caseId,
          query: input.query ?? input.companyName ?? "Analyze this value case",
          company_name: input.companyName,
          context: { value_case_id: caseId },
          idempotency_key,
        },
      );
      if (!res.success) throw new Error(res.error?.message ?? "Request failed");
      const data = res.data?.data;
      if (!data) throw new Error("No data in response");
      return { ...data, runId: data.jobId ?? data.runId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hypothesis", caseId, tenantId] });
    },
  });
}
