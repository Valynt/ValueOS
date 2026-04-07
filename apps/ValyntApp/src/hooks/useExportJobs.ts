/**
 * useExportJobs
 *
 * React Query hooks for async export jobs and history.
 * Supports polling for progress and real-time updates.
 *
 * @task P0/P1 - Async Export Queue & Export History
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { apiClient } from "@/api/client/unified-api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExportFormat = "pdf" | "pptx";
export type ExportType = "full" | "executive_summary" | "financials_only" | "hypotheses_only";
export type ExportJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface ExportJob {
  id: string;
  status: ExportJobStatus;
  progressPercent: number;
  currentStep: string | null;
  progressSteps: ProgressStep[];
  format: ExportFormat;
  exportType: ExportType;
  title: string | null;
  signedUrl: string | null;
  signedUrlExpiresAt: string | null;
  fileSizeBytes: number | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ProgressStep {
  name: string;
  label: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  percent: number;
}

export interface ExportHistoryItem {
  id: string;
  format: ExportFormat;
  exportType: ExportType;
  title: string | null;
  status: ExportJobStatus;
  fileSizeBytes: number | null;
  signedUrl: string | null;
  signedUrlExpiresAt: string | null;
  integrityScoreAtExport: number | null;
  readinessScoreAtExport: number | null;
  createdAt: string;
  completedAt: string | null;
}

interface AsyncExportResponse {
  jobId: string;
  status: ExportJobStatus;
  message: string;
}

// ---------------------------------------------------------------------------
// Async Export Mutation
// ---------------------------------------------------------------------------

interface AsyncExportVariables {
  format: ExportFormat;
  exportType?: ExportType;
  title?: string;
  ownerName?: string;
  renderUrl?: string;
}

export function useAsyncExport(caseId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<AsyncExportResponse, Error, AsyncExportVariables>({
    mutationFn: async (variables) => {
      if (!caseId) throw new Error("Case ID required");
      const res = await apiClient.post<{ success: boolean; data: AsyncExportResponse }>(
        `/api/v1/cases/${caseId}/export/async`,
        variables
      );
      if (!res.success || !res.data) {
        throw new Error("Failed to queue export job");
      }
      return res.data.data;
    },
    onSuccess: () => {
      // Invalidate export history cache
      queryClient.invalidateQueries({ queryKey: ["export-history", caseId] });
    },
  });
}

// ---------------------------------------------------------------------------
// Export Job Status (with polling)
// ---------------------------------------------------------------------------

interface ExportJobStatusResponse {
  id: string;
  status: ExportJobStatus;
  progressPercent: number;
  currentStep: string | null;
  progressSteps: ProgressStep[];
  format: ExportFormat;
  exportType: ExportType;
  title: string | null;
  signedUrl: string | null;
  signedUrlExpiresAt: string | null;
  fileSizeBytes: number | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export function useExportJobStatus(
  caseId: string | undefined,
  jobId: string | undefined,
  options?: { enabled?: boolean; pollInterval?: number }
) {
  const pollInterval = options?.pollInterval ?? 2000; // 2 second default polling

  return useQuery<ExportJob, Error>({
    queryKey: ["export-job", caseId, jobId],
    queryFn: async () => {
      if (!caseId || !jobId) throw new Error("Case ID and Job ID required");
      const res = await apiClient.get<{ success: boolean; data: ExportJobStatusResponse }>(
        `/api/v1/cases/${caseId}/export/jobs/${jobId}/status`
      );
      if (!res.success || !res.data) {
        throw new Error("Failed to fetch export job status");
      }
      return res.data.data;
    },
    enabled: !!caseId && !!jobId && options?.enabled !== false,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Stop polling when job reaches terminal state
      if (status === "completed" || status === "failed" || status === "cancelled") {
        return false;
      }
      return pollInterval;
    },
  });
}

// ---------------------------------------------------------------------------
// Export History (P1)
// ---------------------------------------------------------------------------

interface ExportHistoryResponse {
  id: string;
  format: ExportFormat;
  exportType: ExportType;
  title: string | null;
  status: ExportJobStatus;
  fileSizeBytes: number | null;
  signedUrl: string | null;
  signedUrlExpiresAt: string | null;
  integrityScoreAtExport: number | null;
  readinessScoreAtExport: number | null;
  createdAt: string;
  completedAt: string | null;
}

export function useExportHistory(caseId: string | undefined, limit: number = 10) {
  return useQuery<ExportHistoryItem[], Error>({
    queryKey: ["export-history", caseId, limit],
    queryFn: async () => {
      if (!caseId) throw new Error("Case ID required");
      const res = await apiClient.get<{ success: boolean; data: ExportHistoryResponse[] }>(
        `/api/v1/cases/${caseId}/export/history?limit=${limit}`
      );
      if (!res.success || !res.data) {
        throw new Error("Failed to fetch export history");
      }
      return res.data.data;
    },
    enabled: !!caseId,
  });
}

// ---------------------------------------------------------------------------
// Refresh Signed URL
// ---------------------------------------------------------------------------

interface RefreshUrlResponse {
  signedUrl: string;
  signedUrlExpiresAt: string;
}

export function useRefreshExportUrl(caseId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<RefreshUrlResponse, Error, { jobId: string }>({
    mutationFn: async ({ jobId }) => {
      if (!caseId) throw new Error("Case ID required");
      const res = await apiClient.post<{ success: boolean; data: RefreshUrlResponse }>(
        `/api/v1/cases/${caseId}/export/jobs/${jobId}/refresh`
      );
      if (!res.success || !res.data) {
        throw new Error("Failed to refresh signed URL");
      }
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["export-history", caseId] });
    },
  });
}

// ---------------------------------------------------------------------------
// Progress Streaming (SSE or Polling)
// ---------------------------------------------------------------------------

export interface ProgressEvent {
  type: "init" | "event" | "ready" | "progress";
  job?: ExportJob;
  event?: {
    id: string;
    event_type: string;
    event_data: Record<string, unknown>;
    created_at: string;
  };
  step?: string;
  percent?: number;
  message?: string;
}

export function useExportProgress(
  caseId: string | undefined,
  jobId: string | undefined,
  options?: { enabled?: boolean }
) {
  const [progress, setProgress] = useState<{
    percent: number;
    step: string;
    status: ExportJobStatus;
  }>({ percent: 0, step: "Initializing...", status: "queued" });
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Track mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Safe setState helpers that check mount status
  const safeSetProgress = useCallback((updater: (prev: typeof progress) => typeof progress) => {
    if (isMountedRef.current) {
      setProgress(updater);
    }
  }, []);

  const safeSetEvents = useCallback((updater: (prev: ProgressEvent[]) => ProgressEvent[]) => {
    if (isMountedRef.current) {
      setEvents(updater);
    }
  }, []);

  const safeSetIsComplete = useCallback((value: boolean) => {
    if (isMountedRef.current) {
      setIsComplete(value);
    }
  }, []);

  useEffect(() => {
    if (!caseId || !jobId || options?.enabled === false) {
      cleanup();
      return;
    }

    // Try SSE first, fall back to polling
    const useSSE = typeof EventSource !== "undefined";

    if (useSSE) {
      try {
        // Construct SSE URL from window location since apiClient doesn't expose base URL
        const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
        const sseUrl = `${baseUrl}/api/v1/cases/${caseId}/export/jobs/${jobId}/events`;
        const es = new EventSource(sseUrl, { withCredentials: true });
        eventSourceRef.current = es;

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as ProgressEvent;
            safeSetEvents((prev) => [...prev, data]);

            if (data.type === "init" && data.job) {
              safeSetProgress(() => ({
                percent: data.job!.progressPercent,
                step: data.job!.currentStep ?? "Initializing...",
                status: data.job!.status,
              }));
            } else if (data.type === "event" && data.event) {
              // Update progress from event data
              const eventData = data.event.event_data as {
                step?: string;
                overall_percent?: number;
                message?: string;
              };
              if (eventData.overall_percent !== undefined) {
                safeSetProgress((prev) => ({
                  ...prev,
                  percent: eventData.overall_percent ?? prev.percent,
                  step: eventData.message ?? prev.step,
                }));
              }
            } else if (data.type === "ready") {
              // SSE stream complete, switch to polling for updates
              es.close();
              startPolling();
            }

            // Check for terminal state
            if (
              data.job?.status === "completed" ||
              data.job?.status === "failed" ||
              data.job?.status === "cancelled"
            ) {
              safeSetIsComplete(true);
              es.close();
            }
          } catch {
            // Ignore parse errors
          }
        };

        es.onerror = () => {
          // SSE failed, fall back to polling
          es.close();
          startPolling();
        };
      } catch {
        startPolling();
      }
    } else {
      startPolling();
    }

    function startPolling() {
      // Poll for status updates
      const poll = async () => {
        try {
          const res = await apiClient.get<{ success: boolean; data: ExportJobStatusResponse }>(
            `/api/v1/cases/${caseId}/export/jobs/${jobId}/status`
          );
          if (res.success && res.data) {
            const job = res.data.data;
            setProgress({
              percent: job.progressPercent,
              step: job.currentStep ?? job.status,
              status: job.status,
            });

            if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
              safeSetIsComplete(true);
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
              }
            }
          }
        } catch {
          // Ignore poll errors
        }
      };

      poll(); // Initial poll
      pollIntervalRef.current = setInterval(poll, 2000);
    }

    return cleanup;
  }, [caseId, jobId, options?.enabled, cleanup]);

  return { progress, events, isComplete };
}
