/**
 * useAgentJob
 *
 * Polls /api/agents/jobs/:jobId for status updates.
 * Stops polling when the job reaches a terminal state (completed/error).
 */

import { useQuery } from "@tanstack/react-query";

export type AgentJobStatus = "queued" | "processing" | "completed" | "error" | "unavailable";

export interface AgentJobResult {
  jobId: string;
  status: AgentJobStatus;
  agentId?: string;
  result?: unknown;
  error?: string;
  latency?: number;
  queuedAt?: string;
  completedAt?: string;
  message?: string;
}

async function fetchJobStatus(jobId: string): Promise<AgentJobResult> {
  const res = await fetch(`/api/agents/jobs/${jobId}`);

  // Kafka unavailable — backend returns 503 or specific error
  if (res.status === 503) {
    return { jobId, status: "unavailable", message: "Agent infrastructure not available" };
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, string>;
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }

  const json = await res.json() as { success: boolean; data: AgentJobResult };
  return json.data;
}

const TERMINAL_STATUSES: AgentJobStatus[] = ["completed", "error", "unavailable"];

export function useAgentJob(jobId: string | null) {
  return useQuery<AgentJobResult>({
    queryKey: ["agent-job", jobId],
    queryFn: () => fetchJobStatus(jobId!),
    enabled: !!jobId,
    // Poll every 2s until terminal
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || TERMINAL_STATUSES.includes(status)) return false;
      return 2000;
    },
    staleTime: 0,
    retry: 1,
  });
}
