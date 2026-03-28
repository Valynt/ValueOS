import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/api/client/unified-api-client";
import { useTenant } from "@/contexts/TenantContext";

export type ReviewStatus = "pending" | "approved" | "changes_requested";

export interface CheckpointReviewRecord {
  checkpointId: string | null;
  caseId: string;
  runId: string;
  stageId: string;
  status: ReviewStatus;
  rationale: string | null;
  actorId: string | null;
  decidedAt: string | null;
  riskLevel: "low" | "medium" | "high";
}

interface ReviewResponse {
  success: boolean;
  data: CheckpointReviewRecord;
}

interface DecideReviewInput {
  caseId: string;
  runId: string;
  stageId: string;
  decision: "approved" | "changes_requested";
  rationale?: string;
  riskLevel?: "low" | "medium" | "high";
}

async function fetchReviewStatus(caseId: string, runId: string, stageId: string): Promise<CheckpointReviewRecord> {
  const res = await apiClient.get<ReviewResponse>(`/api/v1/cases/${caseId}/checkpoints/review`, {
    runId,
    stageId,
  });

  if (!res.success || !res.data?.data) {
    throw new Error(res.error?.message ?? "Failed to fetch review status");
  }

  return res.data.data;
}

async function postReviewDecision(input: DecideReviewInput): Promise<CheckpointReviewRecord> {
  const res = await apiClient.post<ReviewResponse>(`/api/v1/cases/${input.caseId}/checkpoints/review`, {
    runId: input.runId,
    stageId: input.stageId,
    decision: input.decision,
    rationale: input.rationale,
    riskLevel: input.riskLevel,
  });

  if (!res.success || !res.data?.data) {
    throw new Error(res.error?.message ?? "Failed to submit review decision");
  }

  return res.data.data;
}

export function useCheckpointReview(caseId: string | null | undefined, runId: string | null | undefined, stageId: string) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;

  return useQuery({
    queryKey: ["checkpoint-review", tenantId, caseId, runId, stageId],
    queryFn: () => fetchReviewStatus(caseId!, runId!, stageId),
    enabled: Boolean(tenantId && caseId && runId),
    staleTime: 5_000,
  });
}

export function useCheckpointReviewDecision() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;

  return useMutation({
    mutationFn: postReviewDecision,
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["checkpoint-review", tenantId, data.caseId, data.runId, data.stageId],
        data,
      );
    },
  });
}
