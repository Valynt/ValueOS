/**
 * useNarrative
 *
 * Fetches the latest narrative draft for a value case and provides
 * a mutation to invoke the NarrativeAgent.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NarrativeDraft {
  id: string;
  organization_id: string;
  value_case_id: string;
  session_id: string | null;
  /** Full narrative text as stored in the narrative_drafts.content column. */
  content: string;
  format: "executive_summary" | "technical" | "board_deck" | "customer_facing";
  defense_readiness_score: number | null;
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

export function useNarrativeDraft(caseId: string | undefined) {
  return useQuery<NarrativeDraft | null>({
    queryKey: ["narrative", caseId],
    queryFn: async () => {
      const result = await fetchJSON<{ data: NarrativeDraft }>(
        `/api/v1/cases/${caseId}/narrative`,
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

export function useRunNarrativeAgent(caseId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<AgentRunResponse, Error, Record<string, unknown> | undefined>({
    mutationFn: async (context) => {
      const res = await fetchJSON<{ success: boolean; data: AgentRunResponse }>(
        `/api/v1/cases/${caseId}/narrative/run`,
        {
          method: "POST",
          body: JSON.stringify({ context: context ?? {} }),
        },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["narrative", caseId] });
    },
  });
}
