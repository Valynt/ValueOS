/**
 * useWorkspaceData — Main hook for workspace data management
 *
 * Combines graph data, warmth state, and real-time events into a single
 * cohesive hook for workspace components.
 *
 * Phase 6: Backend Integration
 */

import { useCallback } from 'react';

import { useGraphData } from './queries/useGraphData';
import { useValueCase } from './queries/useValueCase';
import { useWorkspaceEvents } from './useWorkspaceEvents';
import { useUpdateNode } from './mutations/useUpdateNode';
import { useConflictResolution } from './useConflictResolution';

interface UseWorkspaceDataOptions {
  caseId: string | undefined;
  enabled?: boolean;
}

interface UseWorkspaceDataReturn {
  // Case data with warmth
  caseData: ReturnType<typeof useValueCase>['data'];
  isCaseLoading: boolean;
  caseError: ReturnType<typeof useValueCase>['error'];
  
  // Graph data
  graph: ReturnType<typeof useGraphData>['graph'];
  isGraphLoading: boolean;
  graphError: ReturnType<typeof useGraphData>['error'];
  
  // Real-time status
  isConnected: boolean;
  connectionStatus: ReturnType<typeof useWorkspaceEvents>['connectionStatus'];
  
  // Mutations
  updateNode: ReturnType<typeof useUpdateNode>['mutate'];
  isUpdating: boolean;
  
  // Conflicts
  conflicts: ReturnType<typeof useConflictResolution>['conflicts'];
  resolveConflict: ReturnType<typeof useConflictResolution>['resolveConflict'];
  
  // Utilities
  refetch: () => void;
}

/**
 * Main workspace data hook - combines all Phase 6 features
 * 
 * @param options - Configuration options
 * @returns Combined workspace data and operations
 */
export function useWorkspaceData({ 
  caseId, 
  enabled = true 
}: UseWorkspaceDataOptions): UseWorkspaceDataReturn {
  // Fetch case with warmth
  const {
    data: caseData,
    isLoading: isCaseLoading,
    error: caseError,
    refetch: refetchCase,
  } = useValueCase(caseId);

  // Fetch graph data
  const {
    graph,
    isLoading: isGraphLoading,
    error: graphError,
    isConnected,
    connectionStatus,
    refetch: refetchGraph,
  } = useGraphData({ caseId, enabled });

  // Subscribe to real-time updates
  useWorkspaceEvents(caseId);

  // Node mutations
  const {
    mutate: updateNode,
    isPending: isUpdating,
  } = useUpdateNode();

  // Conflict resolution
  const {
    conflicts,
    resolveConflict,
  } = useConflictResolution(caseId);

  // Combined refetch
  const refetch = useCallback(() => {
    refetchCase();
    refetchGraph();
  }, [refetchCase, refetchGraph]);

  return {
    // Case data
    caseData,
    isCaseLoading,
    caseError,
    
    // Graph data
    graph,
    isGraphLoading,
    graphError,
    
    // Real-time
    isConnected,
    connectionStatus,
    
    // Mutations
    updateNode,
    isUpdating,
    
    // Conflicts
    conflicts,
    resolveConflict,
    
    // Utilities
    refetch,
  };
}
