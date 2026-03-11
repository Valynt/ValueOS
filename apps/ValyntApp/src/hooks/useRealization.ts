/**
 * useRealization
 *
 * Fetches the latest realization report for a value case and provides
 * a mutation to invoke the RealizationAgent.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/api/client/unified-api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Milestone {
  id: string;
  title: string;
  description: string;
  target_date: string;
  owner: string;
  status: "not_started" | "in_progress" | "completed" | "blocked";
  dependencies: string[];
  success_criteria: string[];
}

export interface KpiTarget {
  kpi_name: string;
  current_value: number;
  target_value: number;
  unit: string;
  measurement_frequency: string;
  data_source: string;
  owner: string;
}

export interface Risk {
  id: string;
  description: string;
  probability: "high" | "medium" | "low";
  impact: "high" | "medium" | "low";
  mitigation: string;
  owner: string;
}

export interface RealizationReport {
  id: string;
  organization_id: string;
  value_case_id: string;
  session_id: string | null;
  milestones: Milestone[];
  kpi_targets: KpiTarget[];
  risks: Risk[];
  implementation_timeline_weeks: number | null;
  resource_requirements: string | null;
  success_criteria: string[];
  confidence: "high" | "medium" | "low" | null;
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

export function useRealizationReport(caseId: string | undefined) {
  return useQuery<RealizationReport | null>({
    queryKey: ["realization", caseId],
    queryFn: async () => {
      const result = await apiClient.get<{ data: RealizationReport }>(
        `/api/v1/cases/${caseId}/realization`,
      );
      if (!result.success) throw new Error(result.error?.message ?? "Request failed");
      return result.data?.data ?? null;
    },
    enabled: !!caseId,
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes("HTTP 404")) return false;
      return failureCount < 2;
    },
  });
}

export function useRunRealizationAgent(caseId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<AgentRunResponse, Error, Record<string, unknown> | undefined>({
    mutationFn: async (context) => {
      const res = await apiClient.post<{ data: AgentRunResponse }>(
        `/api/v1/cases/${caseId}/realization/run`,
        { context: context ?? {} },
      );
      if (!res.success) throw new Error(res.error?.message ?? "Request failed");
      if (!res.data?.data) throw new Error("Empty response from realization/run");
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["realization", caseId] });
    },
  });
}
