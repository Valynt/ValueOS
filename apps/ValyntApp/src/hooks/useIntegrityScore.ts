/**
 * useIntegrityScore
 *
 * Fetches the composite integrity score and open violations for a business case.
 *
 * GET /api/v1/cases/:caseId/integrity
 *   Returns { integrity_score, defense_readiness_score, violations, hard_blocked, soft_warnings }
 *
 * POST /api/v1/cases/:caseId/integrity/resolve/:id
 *   Resolves a violation via RE_EVALUATE or DISMISS.
 *
 * Sprint 54 — Value Integrity Layer
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/api/client/unified-api-client";
import type { IntegrityViolation } from "@sdui/components/SDUI/IntegrityScoreCard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IntegrityScoreData {
  integrity_score: number | null;
  defense_readiness_score: number | null;
  violations: IntegrityViolation[];
  hard_blocked: boolean;
  soft_warnings: IntegrityViolation[];
}

export interface ResolveViolationInput {
  violationId: string;
  resolution_type: "RE_EVALUATE" | "DISMISS";
  reason_code?: string;
  comment?: string;
}

export interface UseIntegrityScoreReturn {
  data: IntegrityScoreData | null;
  isLoading: boolean;
  error: Error | null;
  resolveViolation: (input: ResolveViolationInput) => void;
  isResolving: boolean;
}

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const integrityScoreKeys = {
  all: ["integrity-score"] as const,
  forCase: (caseId: string) => ["integrity-score", caseId] as const,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useIntegrityScore(
  caseId: string | undefined,
): UseIntegrityScoreReturn {
  const queryClient = useQueryClient();

  const query = useQuery<IntegrityScoreData | null, Error>({
    queryKey: integrityScoreKeys.forCase(caseId ?? ""),
    enabled: !!caseId,
    queryFn: async () => {
      const res = await apiClient.get<IntegrityScoreData>(
        `/api/v1/cases/${caseId}/integrity`,
      );
      if (!res.success) throw new Error(res.error?.message ?? "Request failed");
      return res.data ?? null;
    },
    // Refresh every 30 seconds to pick up background agent run updates
    refetchInterval: 30_000,
  });

  const mutation = useMutation<unknown, Error, ResolveViolationInput>({
    mutationFn: async ({ violationId, resolution_type, reason_code, comment }) => {
      const res = await apiClient.post<{ data: IntegrityViolation }>(
        `/api/v1/cases/${caseId}/integrity/resolve/${violationId}`,
        { resolution_type, reason_code, comment },
      );
      if (!res.success) throw new Error(res.error?.message ?? "Request failed");
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: integrityScoreKeys.forCase(caseId ?? ""),
      });
    },
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    resolveViolation: (input) => mutation.mutate(input),
    isResolving: mutation.isPending,
  };
}
