/**
 * useNarrative
 *
 * Fetches the latest narrative draft for a value case and provides
 * a mutation to invoke the NarrativeAgent.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/api/client/unified-api-client";

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

// fetchJSON removed — use apiClient (Phase 8 / ADR-0014)

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useNarrativeDraft(caseId: string | undefined) {
  return useQuery<NarrativeDraft | null>({
    queryKey: ["narrative", caseId],
    queryFn: async () => {
      const result = await apiClient.get<{ data: NarrativeDraft }>(
        `/api/v1/cases/${caseId}/narrative`,
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

export function useRunNarrativeAgent(caseId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<AgentRunResponse, Error, Record<string, unknown> | undefined>({
    mutationFn: async (context) => {
      try {
        const res = await apiClient.post<{ data: AgentRunResponse }>(
          `/api/v1/cases/${caseId}/narrative/run`,
          { context: context ?? {} },
        );
        if (!res.success) throw new Error(res.error?.message ?? "Request failed");
        if (!res.data?.data) throw new Error("Empty response from narrative/run");
        return res.data.data;
      } catch (err) {
        // 409 means NarrativeAgent is async-scale-to-zero and cannot run on the
        // synchronous back-half route. Surface this as a structured response so
        // callers can redirect to the async queue workflow instead of treating
        // it as an unexpected error.
        if (err instanceof Error && err.message.includes("409")) {
          return {
            jobId: "",
            agentId: "narrative",
            status: "async-only",
            result: { coldStartClass: "async-scale-to-zero" },
          } satisfies AgentRunResponse;
        }
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["narrative", caseId] });
    },
  });
}
