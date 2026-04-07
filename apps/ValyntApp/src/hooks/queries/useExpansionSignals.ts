/**
 * useExpansionSignals — Hook for expansion opportunity detection
 *
 * Phase 5.3: Realization Tracker (Full Implementation)
 *
 * Detects when KPIs exceed targets consistently, signaling expansion opportunities.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

export interface ExpansionSignal {
  /** Case ID that triggered the signal */
  caseId: string;
  /** Type of expansion trigger */
  triggerType: "kpi_exceeded" | "timeline_ahead" | "scope_increase";
  /** KPIs that exceeded targets */
  kpis: Array<{
    name: string;
    targetValue: number;
    actualValue: number;
    exceedancePercent: number;
    consecutiveCheckpoints: number;
  }>;
  /** Suggested action text */
  suggestedAction: string;
  /** Confidence in the signal */
  confidence: "high" | "medium" | "low";
  /** Timestamp when signal was generated */
  generatedAt: string;
}

interface UseExpansionSignalsResult {
  /** Active expansion signals */
  signals: ExpansionSignal[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Refetch function */
  refetch: () => void;
}

/**
 * Fetch expansion signals for a case.
 *
 * @param caseId — Case ID to check for expansion signals
 * @returns Expansion signals with loading/error states
 */
export function useExpansionSignals(
  caseId: string | undefined
): UseExpansionSignalsResult {
  const query = useQuery<ExpansionSignal[]>({
    queryKey: ["expansion-signals", caseId],
    queryFn: async () => {
      if (!caseId) return [];

      // TODO: Replace with actual API call
      // const response = await fetch(`/api/cases/${caseId}/expansion-signals`);
      // if (!response.ok) throw new Error("Failed to fetch signals");
      // return response.json();

      // Return empty for now - signals are computed from checkpoints
      return [];
    },
    staleTime: 300_000, // 5 minutes
    enabled: !!caseId,
  });

  return {
    signals: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

/**
 * Evaluate checkpoints for expansion triggers.
 *
 * @param checkpoints — Array of checkpoints with KPI data
 * @param kpiTargets — Target values for each KPI
 * @param thresholds — Configuration for trigger thresholds
 * @returns Expansion signal if triggers met, null otherwise
 */
export function evaluateExpansionTriggers(
  checkpoints: Array<{
    kpiName: string;
    targetValue: number;
    actualValue: number | null;
    date: string;
  }>,
  kpiTargets: Record<string, number>,
  thresholds: {
    exceedPercent: number;
    consecutiveCount: number;
  } = { exceedPercent: 15, consecutiveCount: 2 }
): ExpansionSignal | null {
  // Group checkpoints by KPI
  const byKpi = new Map<string, typeof checkpoints>();
  checkpoints.forEach((c) => {
    if (!byKpi.has(c.kpiName)) {
      byKpi.set(c.kpiName, []);
    }
    byKpi.get(c.kpiName)!.push(c);
  });

  const triggeredKpis: ExpansionSignal["kpis"] = [];

  byKpi.forEach((kpiCheckpoints, kpiName) => {
    // Sort by date descending
    const sorted = kpiCheckpoints.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Check consecutive exceedances
    let consecutiveExceedances = 0;
    for (const checkpoint of sorted) {
      if (checkpoint.actualValue === null) continue;

      const exceedancePercent =
        ((checkpoint.actualValue - checkpoint.targetValue) /
          checkpoint.targetValue) *
        100;

      if (exceedancePercent >= thresholds.exceedPercent) {
        consecutiveExceedances++;
      } else {
        break;
      }
    }

    if (consecutiveExceedances >= thresholds.consecutiveCount) {
      const latest = sorted.find((c) => c.actualValue !== null);
      if (latest) {
        triggeredKpis.push({
          name: kpiName,
          targetValue: latest.targetValue,
          actualValue: latest.actualValue!,
          exceedancePercent:
            ((latest.actualValue! - latest.targetValue) / latest.targetValue) *
            100,
          consecutiveCheckpoints: consecutiveExceedances,
        });
      }
    }
  });

  // Require at least 2 KPIs to trigger expansion signal
  if (triggeredKpis.length < 2) {
    return null;
  }

  return {
    caseId: "case-id", // Would be passed in
    triggerType: "kpi_exceeded",
    kpis: triggeredKpis,
    suggestedAction: `Consider expansion: ${triggeredKpis
      .map((k) => k.name)
      .join(", ")} exceeded targets for ${thresholds.consecutiveCount}+ consecutive checkpoints.`,
    confidence: triggeredKpis.length >= 3 ? "high" : "medium",
    generatedAt: new Date().toISOString(),
  };
}
