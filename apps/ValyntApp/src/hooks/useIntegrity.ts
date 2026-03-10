/**
 * useIntegrity
 *
 * Fetches the latest integrity result for a value case and provides
 * a mutation to invoke the IntegrityAgent.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClaimValidation {
  claim_id: string;
  claim_text: string;
  verdict: "supported" | "partially_supported" | "unsupported" | "insufficient_evidence";
  confidence: number;
  evidence_assessment: string;
  issues: Array<{ type: string; severity: string; description: string }>;
  suggested_fix?: string;
}

export interface IntegrityResult {
  id: string;
  organization_id: string;
  value_case_id: string;
  session_id: string | null;
  claims: ClaimValidation[];
  veto_decision: "pass" | "veto" | "re_refine" | null;
  overall_score: number | null;
  data_quality_score: number | null;
  logic_score: number | null;
  evidence_score: number | null;
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

export function useIntegrityResult(caseId: string | undefined) {
  return useQuery<IntegrityResult | null>({
    queryKey: ["integrity", caseId],
    queryFn: async () => {
      const result = await fetchJSON<{ data: IntegrityResult }>(
        `/api/v1/cases/${caseId}/integrity`,
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

export function useRunIntegrityAgent(caseId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<AgentRunResponse, Error, Record<string, unknown> | undefined>({
    mutationFn: async (context) => {
      const res = await fetchJSON<{ success: boolean; data: AgentRunResponse }>(
        `/api/v1/cases/${caseId}/integrity/run`,
        {
          method: "POST",
          body: JSON.stringify({ context: context ?? {} }),
        },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrity", caseId] });
    },
  });
}
