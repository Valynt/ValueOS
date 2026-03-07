/**
 * useValueTree
 *
 * Fetches and mutates value_tree_nodes for a value case.
 * Backed by GET/PATCH /api/v1/value-cases/:caseId/value-tree.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, string>;
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch all value tree nodes for a case.
 */
export function useValueTree(caseId: string | undefined) {
  return useQuery<ValueTreeNode[]>({
    queryKey: ["value-tree", caseId],
    queryFn: async () => {
      const result = await fetchJSON<{ data: ValueTreeNode[] }>(
        `/api/v1/value-cases/${caseId}/value-tree`,
      );
      return result.data ?? [];
    },
    enabled: !!caseId,
    staleTime: 30_000,
  });
}

/**
 * Upsert a single value tree node.
 * Optimistically updates the cache; rolls back on error.
 */
export function useUpsertValueTreeNode(caseId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["value-tree", caseId];

  return useMutation<ValueTreeNode, Error, ValueTreeNodeUpdate>({
    mutationFn: async (node) => {
      const result = await fetchJSON<{ data: ValueTreeNode }>(
        `/api/v1/value-cases/${caseId}/value-tree`,
        {
          method: "PATCH",
          body: JSON.stringify(node),
        },
      );
      return result.data;
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
 * Replace the full value tree for a case.
 */
export function useReplaceValueTree(caseId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<ValueTreeNode[], Error, Omit<ValueTreeNodeUpdate, "id">[]>({
    mutationFn: async (nodes) => {
      const result = await fetchJSON<{ data: ValueTreeNode[] }>(
        `/api/v1/value-cases/${caseId}/value-tree`,
        {
          method: "PATCH",
          body: JSON.stringify({ nodes }),
        },
      );
      return result.data ?? [];
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["value-tree", caseId], data);
    },
  });
}
