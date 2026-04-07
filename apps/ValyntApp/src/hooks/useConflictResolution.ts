import { useState, useCallback } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/api/client';

/**
 * Conflict type - represents a merge conflict between local and remote changes
 */
export interface Conflict {
  id: string;
  caseId: string;
  nodeId: string;
  field: string;
  localValue: unknown;
  remoteValue: unknown;
  remoteUserId: string;
  remoteUserName: string;
  timestamp: string;
}

/**
 * Hook to detect and resolve collaborative edit conflicts
 * 
 * @param caseId - The case ID to monitor for conflicts
 * @returns Conflicts list and resolution functions
 */
export function useConflictResolution(caseId: string | undefined) {
  const queryClient = useQueryClient();
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  // Subscribe to conflict events
  const subscribeToConflicts = useCallback(() => {
    if (!caseId || typeof window === 'undefined') return () => {};

    const handleConflict = (event: CustomEvent<{ conflict: Conflict }>) => {
      const { conflict } = event.detail;
      if (conflict.caseId === caseId) {
        setConflicts((prev) => [...prev, conflict]);
      }
    };

    window.addEventListener('graph-conflict', handleConflict as EventListener);
    
    return () => {
      window.removeEventListener('graph-conflict', handleConflict as EventListener);
    };
  }, [caseId]);

  // Resolve conflict by accepting local or remote value
  const resolveConflict = useMutation({
    mutationFn: async ({
      conflictId,
      resolution,
    }: {
      conflictId: string;
      resolution: 'local' | 'remote' | 'merge';
    }) => {
      if (!caseId) throw new Error('Case ID is required');
      
      const response = await apiClient.post(`/cases/${caseId}/conflicts/${conflictId}/resolve`, {
        resolution,
      });
      return response.data;
    },

    onSuccess: (_, variables) => {
      // Remove resolved conflict from list
      setConflicts((prev) => prev.filter((c) => c.id !== variables.conflictId));
      
      // Invalidate graph to get updated state
      if (caseId) {
        queryClient.invalidateQueries({ queryKey: ['graph', caseId] });
      }
    },
  });

  // Dismiss conflict without resolution (keep both and manual fix later)
  const dismissConflict = useCallback((conflictId: string) => {
    setConflicts((prev) => prev.filter((c) => c.id !== conflictId));
  }, []);

  return {
    conflicts,
    subscribeToConflicts,
    resolveConflict: resolveConflict.mutate,
    isResolving: resolveConflict.isPending,
    dismissConflict,
  };
}

/**
 * Hook to batch resolve multiple conflicts
 * 
 * @param caseId - The case ID
 * @returns Batch resolution function
 */
export function useBatchResolveConflicts(caseId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conflictIds,
      resolution,
    }: {
      conflictIds: string[];
      resolution: 'local' | 'remote';
    }) => {
      if (!caseId) throw new Error('Case ID is required');
      
      const response = await apiClient.post(`/cases/${caseId}/conflicts/resolve-batch`, {
        conflictIds,
        resolution,
      });
      return response.data;
    },

    onSuccess: () => {
      if (caseId) {
        queryClient.invalidateQueries({ queryKey: ['graph', caseId] });
      }
    },
  });
}
