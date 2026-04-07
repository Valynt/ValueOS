import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/api/client/unified-api-client";

export interface ValueFabricAlignmentPathway {
  id: string;
  licensor_node_id: string;
  licensor_node_name: string;
  licensor_node_type: "product" | "capability" | "use_case" | "persona" | "pain" | "outcome" | "proof_point";
  matched_target_signals: string[];
  shared_terms: string[];
  confidence_score: number;
  rationale: string;
}

export interface ValueFabricAlignmentSummary {
  licensor_nodes: number;
  target_signals: number;
  matched_pathways: number;
}

export interface TargetAlignmentPayload {
  context_id: string;
  licensor_scope: "persistent";
  target_scope: "project_scoped";
  case_id: string | null;
  alignment: {
    mode: "licensor_only" | "licensor_vs_target";
    pathways: ValueFabricAlignmentPathway[];
    summary: ValueFabricAlignmentSummary;
  };
}

export function useTargetAlignment(
  contextId: string | undefined,
  caseId: string | undefined
) {
  return useQuery<TargetAlignmentPayload>({
    queryKey: ["target-alignment", contextId, caseId],
    enabled: Boolean(contextId && caseId),
    staleTime: 30_000,
    queryFn: async () => {
      if (!contextId || !caseId) {
        throw new Error("Context ID and case ID are required");
      }

      const response = await apiClient.get<{ data: TargetAlignmentPayload }>(
        `/api/onboarding/contexts/${contextId}/target-alignment`,
        { caseId }
      );

      if (!response.success) {
        throw new Error(response.error?.message ?? "Failed to fetch target alignment");
      }

      if (!response.data?.data) {
        throw new Error("Target alignment response missing data payload");
      }

      return response.data.data;
    },
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes("404")) {
        return false;
      }
      return failureCount < 2;
    },
  });
}
