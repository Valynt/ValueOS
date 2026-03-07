/**
 * useHypothesis
 *
 * Fetches the latest hypothesis output for a value case and provides
 * a mutation to invoke the OpportunityAgent.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValueHypothesis {
  title: string;
  description: string;
  category: string;
  estimated_impact: {
    low: number;
    high: number;
    unit: string;
    timeframe_months: number;
  };
  confidence: number;
  evidence: string[];
  assumptions: string[];
  kpi_targets: string[];
}

export interface HypothesisOutput {
  id: string;
  case_id: string;
  organization_id: string;
  agent_run_id: string | null;
  hypotheses: ValueHypothesis[];
  kpis: string[];
  confidence: "high" | "medium" | "low" | null;
  reasoning: string | null;
  hallucination_check: boolean | null;
  created_at: string;
  updated_at: string;
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
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch the latest hypothesis output for a case.
 * Returns null data (not an error) when no run has been completed yet.
 */
export function useHypothesisOutput(caseId: string | undefined) {
  return useQuery<HypothesisOutput | null>({
    queryKey: ["hypothesis", caseId],
    queryFn: async () => {
      const result = await fetchJSON<{ data: HypothesisOutput | null }>(
        `/api/v1/value-cases/${caseId}/hypothesis`,
      );
      return result.data;
    },
    enabled: !!caseId,
    staleTime: 30_000,
    // 404 means no output yet — treat as null, not an error
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes("HTTP 404")) return false;
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
 * Returns the full invoke response so callers can detect direct-mode results.
 */
export function useRunHypothesisAgent(caseId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<AgentInvokeResponse, Error, { companyName?: string; query?: string }>({
    mutationFn: async (input) => {
      const res = await fetch(`/api/agents/opportunity/invoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          value_case_id: caseId,
          query: input.query ?? input.companyName ?? "Analyze this value case",
          company_name: input.companyName,
          context: { value_case_id: caseId },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as Record<string, string>;
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json() as { data: AgentInvokeResponse };
      const data = json.data;
      // Normalise: jobId and runId are the same field
      return { ...data, runId: data.jobId ?? data.runId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hypothesis", caseId] });
    },
  });
}
