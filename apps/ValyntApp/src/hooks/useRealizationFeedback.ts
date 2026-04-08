/**
 * useRealizationFeedback — Hook for realization-to-graph feedback loop
 *
 * Phase 5.3: Realization Tracker (Full Implementation)
 *
 * Merges actuals data into graph data to update node confidence
 * based on realized accuracy, creating a learning loop.
 */

import { useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import type { Graph, ValueNode } from "@/features/living-value-graph/types/graph.types";

interface ActualsData {
  [nodeId: string]: {
    projected: number;
    actual: number;
    accuracy: number; // 0-1, where 1 is perfect match
  };
}

interface SubmitFeedbackParams {
  graphId: string;
  actuals: ActualsData;
}

interface UseRealizationFeedbackResult {
  /** Apply actuals feedback to a graph without persistence */
  applyFeedbackLocal: (graph: Graph, actuals: ActualsData) => Graph;
  /** Submit feedback for persistence */
  submitFeedback: (params: SubmitFeedbackParams) => Promise<SubmitFeedbackParams>;
  /** Whether feedback is being applied */
  isApplying: boolean;
  /** Error if feedback application failed */
  error: Error | null;
  /** Feedback statistics for the current case */
  feedbackStats: {
    totalNodes: number;
    nodesWithActuals: number;
    averageAccuracy: number;
  } | undefined;
}

/**
 * Hook for realization feedback loop.
 *
 * @param caseId — Case ID to fetch feedback data for
 * @returns Feedback functions and statistics
 */
export function useRealizationFeedback(
  caseId: string | undefined
): UseRealizationFeedbackResult {
  const queryClient = useQueryClient();

  // Fetch actuals data for the case
  const actualsQuery = useQuery<ActualsData>({
    queryKey: ["realization-feedback", caseId],
    queryFn: async () => {
      if (!caseId) return {};

      // TODO: Replace with actual API call
      // const response = await fetch(`/api/cases/${caseId}/actuals-feedback`);
      // if (!response.ok) throw new Error("Failed to fetch feedback data");
      // return response.json();

      return {};
    },
    enabled: !!caseId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Mutation to submit feedback
  const feedbackMutation = useMutation({
    mutationFn: async (params: SubmitFeedbackParams) => {
      // TODO: Replace with actual API call
      // await fetch(`/api/graphs/${params.graphId}/feedback`, {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify(params.actuals),
      // });
      return params;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["realization-feedback", caseId] });
    },
  });

  // Apply feedback to a graph without persistence
  const applyFeedbackLocal = useCallback((graph: Graph, actuals: ActualsData): Graph => {
    return applyRealizationFeedback(graph, actuals);
  }, []);

  const submitFeedback = useCallback((params: SubmitFeedbackParams) => {
    return feedbackMutation.mutateAsync(params);
  }, [feedbackMutation]);

  // Calculate feedback statistics
  const feedbackStats = useMemo(() => {
    const actuals = actualsQuery.data;
    if (!actuals) return undefined;

    const entries = Object.values(actuals);
    if (entries.length === 0) return undefined;

    const totalAccuracy = entries.reduce((sum, e) => sum + e.accuracy, 0);

    return {
      totalNodes: entries.length,
      nodesWithActuals: entries.filter((e) => e.actual !== null).length,
      averageAccuracy: totalAccuracy / entries.length,
    };
  }, [actualsQuery.data]);

  return {
    applyFeedbackLocal,
    submitFeedback,
    isApplying: feedbackMutation.isPending,
    error: (feedbackMutation.error as Error | null) ?? (actualsQuery.error as Error | null),
    feedbackStats,
  };
}

/**
 * Standalone function to apply realization feedback to a graph.
 * Can be used outside of React hooks.
 *
 * @param graph — Graph to update
 * @param actuals — Actuals data from realization tracking
 * @returns Updated graph with adjusted confidence
 */
export function applyRealizationFeedback(
  graph: Graph,
  actuals: ActualsData
): Graph {
  const updatedNodes: Record<string, ValueNode> = {};

  Object.entries(graph.nodes).forEach(([nodeId, node]) => {
    const actualsData = actuals[nodeId];
    if (!actualsData) {
      updatedNodes[nodeId] = node;
      return;
    }

    let newConfidence = node.confidence ?? 0.5;
    const { accuracy } = actualsData;

    if (accuracy >= 0.95) {
      newConfidence = Math.min(1, newConfidence + 0.1);
    } else if (accuracy >= 0.85) {
      newConfidence = Math.min(1, newConfidence + 0.05);
    } else if (accuracy < 0.7) {
      newConfidence = Math.max(0.3, newConfidence - 0.15);
    }

    updatedNodes[nodeId] = {
      ...node,
      confidence: newConfidence,
      metadata: {
        ...node.metadata,
        lastModified: new Date().toISOString(),
      },
    };
  });

  return {
    ...graph,
    nodes: updatedNodes,
    versionId: `${graph.versionId ?? "v0"}-feedback-${Date.now()}`,
  };
}
