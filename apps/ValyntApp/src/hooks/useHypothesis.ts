/**
 * useHypothesis
 *
 * Fetches the latest hypothesis output for a value case and provides
 * a mutation to invoke the OpportunityAgent.
 *
 * Phase 8: migrated from raw fetch() to UnifiedApiClient (ADR-0014).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { apiClient } from "@/api/client/unified-api-client";
import { useTenant } from "@/contexts/TenantContext";
import {
  HypothesisOutputEnvelopeSchema,
  type HypothesisOutput,
  normalizeHypothesisOutput,
} from "@/hooks/hypothesisNormalization";

export type { NormalizedHypothesis } from "@/hooks/hypothesisNormalization";

const HypothesisApiResponseSchema = z.object({
  data: HypothesisOutputEnvelopeSchema.nullable(),
});

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
