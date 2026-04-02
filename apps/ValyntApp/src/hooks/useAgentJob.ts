import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/api/client/unified-api-client";
import { useTenant } from "@/contexts/TenantContext";

/**
 * useAgentJob
 *
 * Polls /api/agents/jobs/:jobId for status updates.
 * Stops polling when the job reaches a terminal state (completed/error).
 *
 * When the invoke endpoint returns a direct-mode result (mode: "direct"),
 * the caller can pass a pre-resolved `directResult` to skip polling entirely.
 *
 * The query key is tenant-scoped to prevent cross-tenant cache bleed during
 * session switching. The query is disabled when tenantId is unavailable.
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
  /** Persisted fallback from the most recent successful output for this runId. */
  lastKnownGoodOutput?: unknown;
  lastKnownGoodAt?: string;
}

interface LastGoodSnapshot {
  output: unknown;
  completedAt?: string;
}

type JobControlAction = "manual-retry" | "resume-polling";

function getLastKnownGoodKey(tenantId: string | null, jobId: string) {
  return `agent-job:last-good:${tenantId ?? "no-tenant"}:${jobId}`;
}

function getJobControlIdempotencyKey(
  tenantId: string | null,
  jobId: string,
  action: JobControlAction,
): string {
  return `${tenantId ?? "no-tenant"}:${jobId}:${action}`;
}

function readLastKnownGood(tenantId: string | null, jobId: string): LastGoodSnapshot | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(getLastKnownGoodKey(tenantId, jobId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastGoodSnapshot;
    if (typeof parsed !== "object" || parsed === null || !("output" in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistLastKnownGood(
  tenantId: string | null,
  jobId: string,
  payload: LastGoodSnapshot,
): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(getLastKnownGoodKey(tenantId, jobId), JSON.stringify(payload));
  } catch {
    // best-effort fallback persistence only
  }
}

// Phase 8: use UnifiedApiClient (ADR-0014)
async function fetchJobStatus(jobId: string, tenantId: string | null): Promise<AgentJobResult> {
  const res = await apiClient.get<{ data: AgentJobResult }>(`/api/agents/jobs/${jobId}`);
  if (!res.success) {
    const msg = res.error?.message ?? "";
    // 503 means agent infrastructure is down — treat as unavailable, not an error
    if (msg.includes("503") || msg.toLowerCase().includes("unavailable")) {
      const fallback = readLastKnownGood(tenantId, jobId);
      return {
        jobId,
        status: "unavailable",
        message: "Agent infrastructure not available",
        lastKnownGoodOutput: fallback?.output,
        lastKnownGoodAt: fallback?.completedAt,
      };
    }
    throw new Error(msg || "Failed to fetch job status");
  }

  const responseData = res.data?.data ?? {
    jobId,
    status: "unavailable" as const,
    message: "No data in response",
  };

  const fallback = readLastKnownGood(tenantId, jobId);

  if (responseData.status === "completed" && responseData.result !== undefined) {
    persistLastKnownGood(tenantId, jobId, {
      output: responseData.result,
      completedAt: responseData.completedAt,
    });
  }

  return {
    ...responseData,
    lastKnownGoodOutput: fallback?.output,
    lastKnownGoodAt: fallback?.completedAt,
  };
}

const TERMINAL_STATUSES: AgentJobStatus[] = ["completed", "failed", "error", "unavailable"];
// "retrying" is intentionally excluded — polling must continue while the backend retries

/**
 * @param jobId - Job ID to poll. Null = no active run.
 * @param directResult - Pre-resolved result from a direct-mode invoke. When
 *   provided, polling is skipped and this value is returned immediately.
 */
export function useAgentJob(
  jobId: string | null,
  directResult?: AgentJobResult | null,
) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;
  const queryClient = useQueryClient();

  const query = useQuery<AgentJobResult>({
    // tenantId scopes the cache key — prevents stale data from a previous
    // tenant being served if jobId collides after a context switch.
    queryKey: ["agent-job", tenantId, jobId],
    queryFn: () => {
      // Direct mode: result already available, no network call needed
      if (directResult) return Promise.resolve(directResult);
      return fetchJobStatus(jobId!, tenantId);
    },
    // directResult bypasses the network entirely — served as initialData so
    // the result is available synchronously on the first render.
    initialData: directResult ?? undefined,
    // Disable when tenantId is unavailable to prevent cross-tenant cache bleed,
    // or when directResult is already provided (no polling needed).
    enabled: !!jobId && !!tenantId && !directResult,
    // No polling for direct results or terminal states.
    // "retrying" is intentionally excluded — polling must continue while the backend retries.
    refetchInterval: (q) => {
      if (directResult) return false;
      const status = q.state.data?.status;
      if (!status || TERMINAL_STATUSES.includes(status)) return false;
      return 2000;
    },
    staleTime: 0,
    retry: 1,
  });

  const retryRun = useMutation<AgentJobResult, Error>({
    mutationFn: async () => {
      if (!jobId) throw new Error("Missing jobId");

      const idempotency_key = getJobControlIdempotencyKey(tenantId, jobId, "manual-retry");
      const res = await apiClient.post<{ data: AgentJobResult }>(`/api/agents/jobs/${jobId}/retry`, {
        idempotency_key,
      });

      if (!res.success) throw new Error(res.error?.message ?? "Retry run failed");
      return res.data?.data ?? { jobId, status: "queued", message: "Retry requested" };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-job", tenantId, jobId] });
    },
  });

  const resumePolling = useMutation<AgentJobResult, Error>({
    mutationFn: async () => {
      if (!jobId) throw new Error("Missing jobId");

      const idempotency_key = getJobControlIdempotencyKey(tenantId, jobId, "resume-polling");
      const res = await apiClient.post<{ data: AgentJobResult }>(`/api/agents/jobs/${jobId}/resume`, {
        idempotency_key,
      });

      if (!res.success) throw new Error(res.error?.message ?? "Resume polling failed");
      return res.data?.data ?? { jobId, status: "processing", message: "Polling resumed" };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-job", tenantId, jobId] });
      void query.refetch();
    },
  });

  return {
    ...query,
    retryRun,
    resumePolling,
  };
}
