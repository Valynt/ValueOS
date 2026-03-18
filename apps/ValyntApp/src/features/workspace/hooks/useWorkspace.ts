/**
 * Workspace hook — provides the current workspace for the active tenant.
 *
 * Fetches workspace metadata via GET /api/workspaces/current and exposes
 * an update mutation for workspace settings.
 */

import { useCallback, useEffect, useState } from "react";

import { apiClient } from "@/api/client/unified-api-client";
import { useTenant } from "@/contexts/TenantContext";

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export function useWorkspace() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspace = useCallback(async () => {
    if (!tenantId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<Workspace>(`/api/workspaces/current`);
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? "Failed to fetch workspace");
      }
      setWorkspace(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch workspace");
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  const updateWorkspace = async (updates: Partial<Pick<Workspace, "name" | "description">>) => {
    if (!workspace) return;

    try {
      const res = await apiClient.patch<Workspace>(
        `/api/workspaces/${workspace.id}`,
        updates,
      );
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? "Failed to update workspace");
      }
      setWorkspace(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update workspace");
    }
  };

  return {
    workspace,
    isLoading,
    error,
    updateWorkspace,
    refetch: fetchWorkspace,
  };
}
