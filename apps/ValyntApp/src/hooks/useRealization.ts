/**
 * useRealization
 *
 * Fetches the latest realization report for a value case and provides
 * a mutation to invoke the RealizationAgent.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, string>;
    throw new Error(body["error"] ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useRealizationReport(caseId: string | undefined) {
  return useQuery<RealizationReport | null>({
    queryKey: ["realization", caseId],
    queryFn: async () => {
      const result = await fetchJSON<{ data: RealizationReport }>(
        `/api/v1/cases/${caseId}/realization`,
      );
      return result.data;
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
      const res = await fetchJSON<{ success: boolean; data: AgentRunResponse }>(
        `/api/v1/cases/${caseId}/realization/run`,
        {
          method: "POST",
          body: JSON.stringify({ context: context ?? {} }),
        },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["realization", caseId] });
    },
  });
}
