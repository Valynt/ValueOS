import { useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { useWorkspaceEvents } from '@/hooks/useWorkspaceEvents';
import type { Graph } from '@/features/living-value-graph/types/graph.types';

/**
 * Transform API response to Graph type
 * This transforms the backend data structure to the frontend Graph type
 */
function transformToGraph(apiData: unknown): Graph {
  // Default empty graph
  const defaultGraph: Graph = {
    id: '',
    versionId: null,
    scenarioId: 'baseline',
    nodes: {},
    edges: {},
    computedAt: null,
    globalMetrics: {
      npv: 0,
      confidence: 0,
      defensibilityScore: 0,
    },
    evidenceCoverage: 0,
  };

  if (!apiData || typeof apiData !== 'object') {
    return defaultGraph;
  }

  const data = apiData as Record<string, unknown>;

  return {
    id: (data.id as string) ?? '',
    versionId: (data.versionId as string | null) ?? null,
    scenarioId: (data.scenarioId as string) ?? 'baseline',
    nodes: (data.nodes as Graph['nodes']) ?? {},
    edges: (data.edges as Graph['edges']) ?? {},
    computedAt: (data.computedAt as string | null) ?? null,
    globalMetrics: {
      npv: (data.globalMetrics as Record<string, number>)?.npv ?? 0,
      roi: (data.globalMetrics as Record<string, number | undefined>)?.roi,
      paybackMonths: (data.globalMetrics as Record<string, number | undefined>)?.paybackMonths,
      confidence: (data.globalMetrics as Record<string, number>)?.confidence ?? 0,
      defensibilityScore: (data.globalMetrics as Record<string, number>)?.defensibilityScore ?? 0,
    },
    evidenceCoverage: (data.evidenceCoverage as number) ?? 0,
  };
}

interface UseGraphDataOptions {
  caseId: string | undefined;
  enabled?: boolean;
}

/**
 * Fetch graph data for a case with real-time updates
 * 
 * @param options - Configuration options
 * @returns Graph data with loading state and error
 */
export function useGraphData({ caseId, enabled = true }: UseGraphDataOptions) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['graph', caseId],
    queryFn: async () => {
      if (!caseId) throw new Error('Case ID is required');
      
      const response = await apiClient.get(`/cases/${caseId}/graph`);
      return transformToGraph(response.data);
    },
    staleTime: 60_000, // 1 minute
    enabled: !!caseId && enabled,
  });

  // Subscribe to real-time updates
  const { isConnected, connectionStatus } = useWorkspaceEvents(caseId);

  return {
    graph: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isConnected,
    connectionStatus,
    // Utility to refetch
    refetch: query.refetch,
  };
}

/**
 * Hook to get a specific node from the graph
 * 
 * @param caseId - The case ID
 * @param nodeId - The node ID
 * @returns The node data or null if not found
 */
export function useGraphNode(caseId: string | undefined, nodeId: string | undefined) {
  const { graph, isLoading } = useGraphData({ caseId });
  
  return {
    node: nodeId ? graph?.nodes[nodeId] ?? null : null,
    isLoading,
  };
}
