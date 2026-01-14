/**
 * Value Case Query Hook
 *
 * Implements React Query for efficient data fetching and caching.
 * Provides automatic background updates, stale-while-revalidate, and optimistic updates.
 */

import React from 'react';
import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import { valueCaseService } from '../services/ValueCaseService';
import { ValueCase } from '../components/ChatCanvas/types';

interface ValueCaseCreate {
  name: string;
  description?: string;
  company: string;
  stage: 'opportunity' | 'target' | 'realization' | 'expansion';
  status: 'in-progress' | 'completed' | 'paused';
}

// Create a query client instance
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 3,
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Query keys
export const queryKeys = {
  valueCases: ['valueCases'] as const,
  valueCase: (id: string) => ['valueCase', id] as const,
  workflowState: (sessionId: string) => ['workflowState', sessionId] as const,
};

/**
 * Hook for fetching value cases with caching
 */
export function useValueCases() {
  return useQuery({
    queryKey: queryKeys.valueCases,
    queryFn: async () => {
      const cases = await valueCaseService.getValueCases();
      return cases.map(c => ({
        id: c.id,
        name: c.name,
        company: c.company,
        stage: c.stage,
        status: c.status,
        updatedAt: c.updated_at,
      }));
    },
    staleTime: 2 * 60 * 1000, // 2 minutes for cases list
    select: (data: ValueCase[]) => {
      // Sort by updated date descending
      return data.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    },
  });
}

/**
 * Hook for fetching a single value case
 */
export function useValueCase(id: string) {
  return useQuery({
    queryKey: queryKeys.valueCase(id),
    queryFn: async () => {
      const caseData = await valueCaseService.getValueCase(id);
      if (!caseData) {
        throw new Error('Case not found');
      }
      return {
        id: caseData.id,
        name: caseData.name,
        company: caseData.company,
        stage: caseData.stage,
        status: caseData.status,
        updatedAt: caseData.updated_at,
      };
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes for individual case
  });
}

/**
 * Hook for creating a new value case
 */
export function useCreateValueCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (caseData: Partial<ValueCase>) => {
      // Ensure required fields are present
      const requiredCaseData = {
        name: caseData.name || '',
        company: caseData.company || '',
        stage: caseData.stage || 'opportunity',
        status: caseData.status || 'in-progress',
        ...caseData,
      };

      const newCase = await valueCaseService.createValueCase(requiredCaseData);
      if (!newCase) {
        throw new Error('Failed to create case');
      }
      return {
        id: newCase.id,
        name: newCase.name,
        company: newCase.company,
        stage: newCase.stage,
        status: newCase.status,
        updatedAt: newCase.updated_at,
      };
    },
    onSuccess: (newCase: ValueCase) => {
      // Update the cases list cache
      queryClient.setQueryData(queryKeys.valueCases, (old: ValueCase[] | undefined) => {
        return old ? [newCase, ...old] : [newCase];
      });

      // Set the individual case cache
      queryClient.setQueryData(queryKeys.valueCase(newCase.id), newCase);
    },
    onError: (error) => {
      console.error('Failed to create value case:', error);
    },
  });
}

/**
 * Hook for updating a value case
 */
export function useUpdateValueCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ValueCase> }) => {
      const updatedCase = await valueCaseService.updateValueCase(id, updates);
      if (!updatedCase) {
        throw new Error('Failed to update case');
      }
      return {
        id: updatedCase.id,
        name: updatedCase.name,
        company: updatedCase.company,
        stage: updatedCase.stage,
        status: updatedCase.status,
        updatedAt: updatedCase.updated_at,
      };
    },
    onMutate: async ({ id, updates }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.valueCase(id) });

      // Snapshot the previous value
      const previousCase = queryClient.getQueryData(queryKeys.valueCase(id));

      // Optimistically update to the new value
      queryClient.setQueryData(queryKeys.valueCase(id), (old: ValueCase | undefined) => {
        return old ? { ...old, ...updates, updatedAt: new Date() } : undefined;
      });

      // Update the list cache as well
      queryClient.setQueryData(queryKeys.valueCases, (old: ValueCase[] | undefined) => {
        return old?.map(c => c.id === id ? { ...c, ...updates, updatedAt: new Date() } : c);
      });

      return { previousCase };
    },
    onError: (error: unknown, variables: { id: string; updates: Partial<ValueCase> }, context: { previousCase?: ValueCase } | undefined) => {
      // Rollback on error
      if (context?.previousCase) {
        queryClient.setQueryData(queryKeys.valueCase(variables.id), context.previousCase);
      }
      console.error('Failed to update value case:', error);
    },
    onSettled: (data: ValueCase | undefined, error: unknown, variables: { id: string; updates: Partial<ValueCase> }) => {
      // Refetch to ensure server state
      queryClient.invalidateQueries({ queryKey: queryKeys.valueCase(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.valueCases });
    },
  });
}

/**
 * Hook for deleting a value case
 */
export function useDeleteValueCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await valueCaseService.deleteValueCase(id);
      return id;
    },
    onSuccess: (deletedId: string) => {
      // Remove from cases list cache
      queryClient.setQueryData(queryKeys.valueCases, (old: ValueCase[] | undefined) => {
        return old?.filter(c => c.id !== deletedId);
      });

      // Remove individual case cache
      queryClient.removeQueries({ queryKey: queryKeys.valueCase(deletedId) });
    },
    onError: (error) => {
      console.error('Failed to delete value case:', error);
    },
  });
}

/**
 * Hook for prefetching value cases
 */
export function usePrefetchValueCases() {
  const queryClient = useQueryClient();

  return React.useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.valueCases,
      queryFn: async () => {
        const cases = await valueCaseService.getValueCases();
        return cases.map(c => ({
          id: c.id,
          name: c.name,
          company: c.company,
          stage: c.stage,
          status: c.status,
          updatedAt: c.updated_at,
        }));
      },
      staleTime: 2 * 60 * 1000,
    });
  }, [queryClient]);
}
