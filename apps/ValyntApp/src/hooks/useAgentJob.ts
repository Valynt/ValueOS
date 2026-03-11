import { apiClient } from "@/api/client/unified-api-client";
/**
 * useAgentJob
 *
 * Polls /api/agents/jobs/:jobId for status updates.
 * Stops polling when the job reaches a terminal state (completed/error).
 *
 * When the invoke endpoint returns a direct-mode result (mode: "direct"),
 * the caller can pass a pre-resolved `directResult` to skip polling entirely.
 */

import { useQuery } from "@tanstack/react-query";

export type AgentJobStatus = "queued" | "processing" | "completed" | "failed" | "error" | "unavailable";

export interface AgentJobResult {
  jobId: string;
  status: AgentJobStatus;
  agentId?: string;
  mode?: "direct" | "kafka";
  result?: unknown;
  confidence?: string;
  reasoning?: string;
  warnings?: string[];
  error?: string;
  latency?: number;
  queuedAt?: string;
  completedAt?: string;
  message?: string;
}

// Phase 8: use UnifiedApiClient (ADR-0014)
async function fetchJobStatus(jobId: string): Promise<AgentJobResult> {
  const res = await apiClient.get<{ data: AgentJobResult }>(`/api/agents/jobs/${jobId}`);
  if (!res.success) {
    const msg = res.error?.message ?? "";
    // 503 means agent infrastructure is down — treat as unavailable, not an error
    if (msg.includes("503") || msg.toLowerCase().includes("unavailable")) {
      return { jobId, status: "unavailable", message: "Agent infrastructure not available" };
    }
    throw new Error(msg || "Failed to fetch job status");
  }
  return res.data?.data ?? { jobId, status: "unavailable", message: "No data in response" };
}

const TERMINAL_STATUSES: AgentJobStatus[] = ["completed", "failed", "error", "unavailable"];

/**
 * @param jobId - Job ID to poll. Null = no active run.
 * @param directResult - Pre-resolved result from a direct-mode invoke. When
 *   provided, polling is skipped and this value is returned immediately.
 */
export function useAgentJob(
  jobId: string | null,
  directResult?: AgentJobResult | null,
) {
  return useQuery<AgentJobResult>({
    queryKey: ["agent-job", jobId, directResult?.mode],
    queryFn: () => {
      // Direct mode: result already available, no network call needed
      if (directResult) return Promise.resolve(directResult);
      return fetchJobStatus(jobId!);
    },
    enabled: !!jobId,
    // No polling for direct results or terminal states
    refetchInterval: (query) => {
      if (directResult) return false;
      const status = query.state.data?.status;
      if (!status || TERMINAL_STATUSES.includes(status)) return false;
      return 2000;
    },
    staleTime: 0,
    retry: 1,
  });
}
