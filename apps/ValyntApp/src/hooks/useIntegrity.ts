/**
 * useIntegrity
 *
 * Fetches the latest integrity result for a value case and provides
 * a mutation to invoke the IntegrityAgent.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/api/client/unified-api-client";

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

// ---------------------------------------------------------------------------
// Hooks — Phase 8: use UnifiedApiClient (ADR-0014)
// ---------------------------------------------------------------------------

export function useIntegrityResult(caseId: string | undefined) {
  return useQuery<IntegrityResult | null>({
    queryKey: ["integrity", caseId],
    queryFn: async () => {
      const res = await apiClient.get<{ data: IntegrityResult }>(
        `/api/v1/cases/${caseId}/integrity`,
      );
      if (!res.success) throw new Error(res.error?.message ?? "Request failed");
      return res.data?.data ?? null;
    },
    enabled: !!caseId,
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes("404")) return false;
      return failureCount < 2;
    },
  });
}

export function useRunIntegrityAgent(caseId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<AgentRunResponse, Error, Record<string, unknown> | undefined>({
    mutationFn: async (context) => {
      const res = await apiClient.post<{ data: AgentRunResponse }>(
        `/api/v1/cases/${caseId}/integrity/run`,
        { context: context ?? {} },
      );
      if (!res.success) throw new Error(res.error?.message ?? "Request failed");
      if (!res.data?.data) throw new Error("No data in response");
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrity", caseId] });
    },
  });
}
