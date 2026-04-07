/**
 * useGraphData — Hook for fetching graph data
 *
 * Stub implementation for Phase 5 testing.
 */

import { useQuery } from "@tanstack/react-query";

import type { Graph } from "@/features/living-value-graph/types/graph.types";

export function useGraphData(graphId: string | undefined) {
  return useQuery<Graph>({
    queryKey: ["graph", graphId],
    queryFn: async () => {
      // Stub - would fetch from API
      throw new Error("Not implemented");
    },
    enabled: !!graphId,
  });
}
