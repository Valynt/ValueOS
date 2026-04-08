import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import type { Graph, ValueNode } from '@/features/living-value-graph/types/graph.types';

interface UpdateNodeParams {
  caseId: string;
  nodeId: string;
  updates: Partial<ValueNode>;
}

/**
 * Update a node with optimistic updates and rollback on error
 *
 * @returns Mutation result with update function
 */
export function useUpdateNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpdateNodeParams) => {
      const response = await apiClient.put(
        `/cases/${params.caseId}/nodes/${params.nodeId}`,
        params.updates
      );
      return response.data;
    },

    // Optimistic update: Update cache immediately
    onMutate: async (params) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['graph', params.caseId] });

      // Snapshot previous value
      const previousGraph = queryClient.getQueryData<Graph>(['graph', params.caseId]);

      // Optimistically update to new value
      const existingNode = previousGraph?.nodes[params.nodeId];
      if (existingNode) {
        // Type assertion needed because Partial<ValueNode> makes required fields optional
        // but we know existingNode has all required fields
        const updatedNode = {
          ...existingNode,
          ...params.updates,
          id: existingNode.id,
          type: params.updates.type ?? existingNode.type,
          label: params.updates.label ?? existingNode.label,
        } as ValueNode;

        queryClient.setQueryData<Graph>(['graph', params.caseId], {
          ...previousGraph,
          nodes: {
            ...previousGraph!.nodes,
            [params.nodeId]: updatedNode,
          },
        });
      }

      // Return context with snapshot
      return { previousGraph };
    },

    // Rollback on error
    onError: (error, params, context) => {
      if (context?.previousGraph) {
        queryClient.setQueryData(['graph', params.caseId], context.previousGraph);
      }

      // Error is already handled by apiClient interceptor
      // but we could add additional UI feedback here
    },

    // Refetch after success or error to ensure sync
    onSettled: (data, error, params) => {
      queryClient.invalidateQueries({ queryKey: ['graph', params.caseId] });
      queryClient.invalidateQueries({ queryKey: ['case', params.caseId] });
    },
  });
}

/**
 * Delete a node from the graph
 */
export function useDeleteNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { caseId: string; nodeId: string }) => {
      const response = await apiClient.delete(
        `/cases/${params.caseId}/nodes/${params.nodeId}`
      );
      return response.data;
    },

    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: ['graph', params.caseId] });
      const previousGraph = queryClient.getQueryData<Graph>(['graph', params.caseId]);

      if (previousGraph) {
        const { [params.nodeId]: _, ...remainingNodes } = previousGraph.nodes;
        queryClient.setQueryData<Graph>(['graph', params.caseId], {
          ...previousGraph,
          nodes: remainingNodes,
        });
      }

      return { previousGraph };
    },

    onError: (error, params, context) => {
      if (context?.previousGraph) {
        queryClient.setQueryData(['graph', params.caseId], context.previousGraph);
      }
    },

    onSettled: (data, error, params) => {
      queryClient.invalidateQueries({ queryKey: ['graph', params.caseId] });
    },
  });
}
