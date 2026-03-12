/**
 * useValueTree
 *
 * Fetches and mutates value_tree_nodes for a value case.
 * Backed by GET/PATCH /api/v1/value-cases/:caseId/value-tree.
 *
 * Also exports useRunTargetAgent for invoking the TargetAgent.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/api/client/unified-api-client";
import { useTenant } from "@/contexts/TenantContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValueTreeNode {
  id: string;
  case_id: string;
  organization_id: string;
  parent_id: string | null;
  label: string;
  value: number | null;
  unit: string | null;
  node_type: "root" | "driver" | "assumption" | "kpi";
  metadata: Record<string, unknown>;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ValueTreeNodeUpdate {
  id?: string;
  parent_id?: string | null;
  label?: string;
  value?: number | null;
  unit?: string | null;
  node_type?: "root" | "driver" | "assumption" | "kpi";
  metadata?: Record<string, unknown>;
  sort_order?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// fetchJSON removed — use apiClient (Phase 8 / ADR-0014)

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch all value tree nodes for a case.
 */
export function useValueTree(caseId: string | undefined) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery<ValueTreeNode[]>({
    queryKey: ["value-tree", caseId, tenantId],
    queryFn: async () => {
      const result = await apiClient.get<{ data: ValueTreeNode[] }>(
        `/api/v1/value-cases/${caseId}/value-tree`,
      );
      if (!result.success) throw new Error(result.error?.message ?? "Request failed");
      return result.data?.data ?? [];
    },
    enabled: !!caseId && !!tenantId,
    staleTime: 30_000,
  });
}

/**
 * Upsert a single value tree node.
 * Optimistically updates the cache; rolls back on error.
 */
export function useUpsertValueTreeNode(caseId: string | undefined) {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const queryKey = ["value-tree", caseId, tenantId];

  return useMutation<ValueTreeNode, Error, ValueTreeNodeUpdate>({
    mutationFn: async (node) => {
      const result = await apiClient.patch<{ data: ValueTreeNode }>(
        `/api/v1/value-cases/${caseId}/value-tree`,
        node,
      );
      if (!result.success) throw new Error(result.error?.message ?? "Request failed");
      if (!result.data?.data) throw new Error("Empty response from value-tree patch");
      return result.data.data;
    },
    onMutate: async (update) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ValueTreeNode[]>(queryKey);

      // Optimistic update
      queryClient.setQueryData<ValueTreeNode[]>(queryKey, (old) => {
        if (!old) return old;
        if (update.id) {
          return old.map((n) =>
            n.id === update.id ? { ...n, ...update, updated_at: new Date().toISOString() } : n,
          );
        }
        return old;
      });

      return { previous };
    },
    onError: (_err, _update, context) => {
      const ctx = context as { previous?: ValueTreeNode[] } | undefined;
      if (ctx?.previous) {
        queryClient.setQueryData(queryKey, ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

/**
 * Invoke the TargetAgent for a case.
 * On success, invalidates the value-tree query so ModelStage reloads.
 */
export function useRunTargetAgent(caseId: string | undefined) {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useMutation<{ jobId: string }, Error, { query?: string }>({
    mutationFn: async (input) => {
      const res = await apiClient.post<{ data?: { jobId?: string } }>("/api/agents/target/invoke", {
        query: input.query ?? "Generate KPI targets for this value case",
        context: { value_case_id: caseId },
      });
      if (!res.success) throw new Error(res.error?.message ?? "Request failed");
      return { jobId: res.data?.data?.jobId ?? "" };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["value-tree", caseId, tenantId] });
    },
  });
}

/**
 * Replace the full value tree for a case.
 */
export function useReplaceValueTree(caseId: string | undefined) {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useMutation<ValueTreeNode[], Error, Omit<ValueTreeNodeUpdate, "id">[]>({
    mutationFn: async (nodes) => {
      const result = await apiClient.patch<{ data: ValueTreeNode[] }>(
        `/api/v1/value-cases/${caseId}/value-tree`,
        { nodes },
      );
      if (!result.success) throw new Error(result.error?.message ?? "Request failed");
      return result.data?.data ?? [];
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["value-tree", caseId, tenantId], data);
    },
  });
}
