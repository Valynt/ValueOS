/**
 * useIntegrityOutput
 *
 * Fetches and manages IntegrityAgent output for a value case.
 *
 * - GET /api/v1/cases/:caseId/integrity — returns { data: IntegrityOutput | null }
 * - runAgent() — POSTs to /api/agents/integrity/invoke, then invalidates the query
 *
 * Phase 8: migrated from raw fetch() + manual auth headers to UnifiedApiClient (ADR-0014).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/api/client/unified-api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IntegrityClaim {
  claim_id?: string;
  text: string;
  confidence_score?: number;
  evidence_tier?: number;
  flagged: boolean;
  flag_reason?: string;
  source_url?: string;
  source_urls?: string[];
  provenance?: unknown;
}

export interface IntegrityOutput {
  id: string;
  case_id: string;
  organization_id: string;
  agent_run_id: string | null;
  claims: IntegrityClaim[];
  overall_confidence: number | null;
  veto_triggered: boolean;
  veto_reason: string | null;
  source_agent: string;
  created_at: string;
  updated_at: string;
}

export interface UseIntegrityOutputReturn {
  data: IntegrityOutput | null;
  isLoading: boolean;
  error: Error | null;
  runAgent: (organizationId: string) => void;
  isRunning: boolean;
}

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const integrityOutputKeys = {
  all: ["integrity-output"] as const,
  forCase: (caseId: string) => ["integrity-output", caseId] as const,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useIntegrityOutput(caseId: string | undefined): UseIntegrityOutputReturn {
  const queryClient = useQueryClient();

  const query = useQuery<IntegrityOutput | null, Error>({
    queryKey: integrityOutputKeys.forCase(caseId ?? ""),
    enabled: !!caseId,
    queryFn: async () => {
      const res = await apiClient.get<{ data: IntegrityOutput | null }>(
        `/api/v1/cases/${caseId}/integrity`,
      );
      if (!res.success) throw new Error(res.error?.message ?? "Request failed");
      return res.data?.data ?? null;
    },
  });

  const mutation = useMutation<unknown, Error, string>({
    mutationFn: async (organizationId: string) => {
      const idempotency_key = crypto.randomUUID();
      const res = await apiClient.post<{ mode: "direct" | "async"; jobId?: string; result?: unknown }>(
        "/api/agents/integrity/invoke",
        { caseId, organizationId, query: "validate claims", idempotency_key },
      );
      if (!res.success) throw new Error(res.error?.message ?? "Request failed");
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: integrityOutputKeys.forCase(caseId ?? ""),
      });
    },
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    runAgent: (organizationId: string) => mutation.mutate(organizationId),
    isRunning: mutation.isPending,
  };
}
