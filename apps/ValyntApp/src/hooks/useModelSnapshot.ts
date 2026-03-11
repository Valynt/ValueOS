/**
 * useModelSnapshot
 *
 * Fetches the latest financial model snapshot for a value case.
 * Backed by GET /api/v1/value-cases/:caseId/model-snapshots/latest.
 *
 * Also exports useRunFinancialModelingAgent for invoking the agent.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/api/client/unified-api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModelSnapshotModel {
  hypothesis_id: string;
  roi: number;
  npv: number;
  irr: number | null;
  payback_period: number | null;
  confidence: number;
  category: string;
}

export interface ModelSnapshot {
  id: string;
  case_id: string;
  organization_id: string;
  snapshot_version: number;
  roi: number | null;
  npv: number | null;
  payback_period_months: number | null;
  assumptions_json: string[];
  outputs_json: {
    models?: ModelSnapshotModel[];
    portfolio_summary?: string;
    total_npv?: number;
    average_confidence?: number;
  };
  source_agent: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// fetchJSON removed — use apiClient (Phase 8 / ADR-0014)

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetch the latest financial model snapshot for a case.
 * Returns null when no snapshot exists yet (404 is treated as empty, not error).
 */
export function useModelSnapshot(caseId: string | undefined) {
  return useQuery<ModelSnapshot | null>({
    queryKey: ["model-snapshot", caseId],
    queryFn: async () => {
      const result = await apiClient.get<{ data: ModelSnapshot | null }>(
        `/api/v1/value-cases/${caseId}/model-snapshots/latest`,
      );
      if (!result.success) throw new Error(result.error?.message ?? "Request failed");
      return result.data?.data ?? null;
    },
    enabled: !!caseId,
    staleTime: 30_000,
  });
}

/**
 * Invoke the FinancialModelingAgent for a case.
 * On success, invalidates the model-snapshot query so ModelStage reloads.
 */
export function useRunFinancialModelingAgent(caseId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<{ jobId: string }, Error, { query?: string }>({
    mutationFn: async (input) => {
      const res = await apiClient.post<{ data?: { jobId?: string } }>("/api/agents/financial-modeling/invoke", {
        query: input.query ?? "Build financial model for this value case",
        context: { value_case_id: caseId },
      });
      if (!res.success) throw new Error(res.error?.message ?? "Request failed");
      return { jobId: res.data?.data?.jobId ?? "" };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["model-snapshot", caseId] });
    },
  });
}
