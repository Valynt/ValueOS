import { useQuery } from "@tanstack/react-query";

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


export type AgentJobStatus =
  | "queued"
  | "processing"
  | "retrying"
  | "completed"
  | "failed"
  | "error"
  | "unavailable";

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
  /** BullMQ retry metadata — present when status is "retrying" */
  attemptsMade?: number;
  nextRetryAt?: string;
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
// "retrying" is intentionally excluded — polling must continue while the backend retries

/**
 * @param jobId - Job ID to poll. Null = no active run.
 * @param directResult - Pre-resolved result from a direct-mode invoke. When
 *   provided, polling is skipped and this value is returned immediately.
 * @param tenantId - Current tenant context. Query is disabled when null to
 *   prevent cross-tenant cache bleed during session switching.
 */
export function useAgentJob(
  jobId: string | null,
  directResult?: AgentJobResult | null,
  tenantId?: string | null,
) {
  return useQuery<AgentJobResult>({
    // tenantId scopes the cache key — prevents stale data from a previous
    // tenant being served if jobId collides after a context switch.
    // Always normalise to null so the key is stable regardless of whether
    // the caller passes null or undefined.
    queryKey: ["agent-job", jobId, tenantId ?? null],
    queryFn: () => fetchJobStatus(jobId!),
    // directResult bypasses the network entirely — served as initialData so
    // the result is available synchronously on the first render.
    initialData: directResult ?? undefined,
    // Use loose equality (!=) to guard against both null and undefined —
    // callers that omit tenantId receive undefined, which !== null would
    // incorrectly allow the query to fire without a tenant scope.
    enabled: !!jobId && !directResult && tenantId != null,
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
