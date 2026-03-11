/**
 * useExpansion
 *
 * Fetches the latest expansion opportunities for a value case and provides
 * a mutation to invoke the ExpansionAgent.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/api/client/unified-api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExpansionOpportunity {
  id: string;
  organization_id: string;
  value_case_id: string;
  session_id: string | null;
  agent_run_id: string | null;
  title: string;
  description: string;
  type: "upsell" | "cross_sell" | "new_use_case" | "geographic_expansion" | "deeper_adoption";
  source_kpi_id: string | null;
  estimated_value_low: number | null;
  estimated_value_high: number | null;
  estimated_value_unit: string | null;
  estimated_value_timeframe_months: number | null;
  confidence: number | null;
  evidence: string[];
  prerequisites: string[];
  stakeholders: string[];
  portfolio_summary: string | null;
  total_expansion_value_low: number | null;
  total_expansion_value_high: number | null;
  total_expansion_currency: string | null;
  gap_analysis: unknown[];
  new_cycle_recommendations: unknown[];
  recommended_next_steps: string[];
  hallucination_check: boolean | null;
  source_agent: string;
  created_at: string;
  updated_at: string;
}

export interface AgentRunResponse {
  jobId: string;
  agentId: string;
  status: string;
  result?: Record<string, unknown>;
  confidence?: string;
  duration_ms?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// fetchJSON removed — use apiClient (Phase 8 / ADR-0014)

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useExpansionOpportunities(caseId: string | undefined) {
  return useQuery<ExpansionOpportunity[]>({
    queryKey: ["expansion", caseId],
    queryFn: async () => {
      const result = await apiClient.get<{ data: ExpansionOpportunity[] }>(
        `/api/v1/cases/${caseId}/expansion`,
      );
      if (!result.success) throw new Error(result.error?.message ?? "Request failed");
      return result.data?.data ?? [];
    },
    enabled: !!caseId,
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes("HTTP 404")) return false;
      return failureCount < 2;
    },
  });
}

export function useRunExpansionAgent(caseId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<AgentRunResponse, Error, Record<string, unknown> | undefined>({
    mutationFn: async (context) => {
      const res = await apiClient.post<{ data: AgentRunResponse }>(
        `/api/v1/cases/${caseId}/expansion/run`,
        { context: context ?? {} },
      );
      if (!res.success) throw new Error(res.error?.message ?? "Request failed");
      if (!res.data?.data) throw new Error("Empty response from expansion/run");
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expansion", caseId] });
    },
  });
}
