/**
 * useActualsTimeline — Hook for actuals vs projections data
 *
 * Phase 5.3: Realization Tracker (Full Implementation)
 *
 * Fetches timeline data showing projected vs actual values over time.
 */

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/api/client/unified-api-client";
import { useTenant } from "@/contexts/TenantContext";

import type { CheckpointStatus } from "@/types/checkpoint";

export interface ActualsTimelinePoint {
  /** Date of the checkpoint */
  date: string;
  /** Projected value at this point */
  projected: number;
  /** Actual value (null if not yet recorded) */
  actual: number | null;
  /** Lower bound of confidence band */
  confidenceLower: number;
  /** Upper bound of confidence band */
  confidenceUpper: number;
  /** Associated checkpoint ID */
  checkpointId?: string;
  /** Checkpoint status */
  status: CheckpointStatus;
  /** Warmth state at this point */
  warmthState?: "forming" | "firm" | "verified";
}

interface UseActualsTimelineResult {
  /** Timeline data points */
  data: ActualsTimelinePoint[] | undefined;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Refetch function */
  refetch: () => void;
}

/**
 * Fetch actuals vs projections timeline for a case.
 *
 * @param caseId — Case ID to fetch timeline for
 * @returns Timeline data with loading/error states
 */
export function useActualsTimeline(caseId: string | undefined): UseActualsTimelineResult {
  const { tenantId } = useTenant();

  const query = useQuery<ActualsTimelinePoint[]>({
    queryKey: ["actuals-timeline", caseId, tenantId],
    queryFn: async () => {
      if (!caseId || !tenantId) return [];

      const response = await apiClient.get(`/cases/${caseId}/realization/actuals-timeline`);

      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || "Failed to fetch timeline");
      }

      return response.data.data ?? [];
    },
    staleTime: 60_000, // 1 minute
    enabled: !!caseId && !!tenantId,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

/**
 * Generate mock timeline data for development.
 *
 * @param caseId — Case ID
 * @returns Mock timeline points
 */
function generateMockTimeline(caseId: string): ActualsTimelinePoint[] {
  const points: ActualsTimelinePoint[] = [];
  const baseDate = new Date("2026-01-01");
  const projectedValue = 1000000;

  for (let i = 0; i < 12; i++) {
    const date = new Date(baseDate);
    date.setMonth(date.getMonth() + i);

    const variance = (Math.random() - 0.5) * 0.3; // ±15% variance
    const actual = i < 8 ? projectedValue * (1 + variance) : null; // Last 4 months not yet recorded

    points.push({
      date: date.toISOString(),
      projected: projectedValue,
      actual,
      confidenceLower: projectedValue * 0.9,
      confidenceUpper: projectedValue * 1.1,
      checkpointId: `checkpoint-${i}`,
      status: actual ? "completed" : "pending",
      warmthState: actual && actual > projectedValue * 0.95 ? "verified" : "firm",
    });
  }

  return points;
}

/**
 * Calculate variance statistics from timeline data.
 *
 * @param points — Timeline points
 * @returns Variance statistics
 */
export function calculateVarianceStats(points: ActualsTimelinePoint[]): {
  averageVariance: number;
  maxVariance: number;
  minVariance: number;
  isOnTrack: boolean;
} {
  const completed = points.filter((p) => p.actual !== null);
  if (completed.length === 0) {
    return { averageVariance: 0, maxVariance: 0, minVariance: 0, isOnTrack: true };
  }

  const variances = completed.map((p) =>
    ((p.actual! - p.projected) / p.projected) * 100
  );

  const averageVariance = variances.reduce((a, b) => a + b, 0) / variances.length;
  const maxVariance = Math.max(...variances);
  const minVariance = Math.min(...variances);

  // On track if average variance within ±10%
  const isOnTrack = Math.abs(averageVariance) <= 10;

  return { averageVariance, maxVariance, minVariance, isOnTrack };
}
