import { useState, useEffect, useCallback } from "react";
import type { Workspace, WorkspaceMember } from "../types";
import { api } from "../../../services/api/client";

export function useWorkspace(workspaceId?: string) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspace = useCallback(async () => {
    if (!workspaceId) return;

    setIsLoading(true);
    try {
      const data = await api.get<{ workspace: Workspace; members: WorkspaceMember[] }>(
        `/workspaces/${workspaceId}`
      );
      setWorkspace(data.workspace);
      setMembers(data.members);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch workspace");
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  const updateWorkspace = async (updates: Partial<Workspace>) => {
    if (!workspace) return;

    try {
      const updated = await api.patch<Workspace>(`/workspaces/${workspace.id}`, updates);
      setWorkspace(updated);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update workspace");
    }
  };

  const inviteMember = async (email: string, role: WorkspaceMember["role"]) => {
    if (!workspaceId) return;

    try {
      await api.post(`/workspaces/${workspaceId}/members`, { email, role });
      await fetchWorkspace();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite member");
    }
  };

  const removeMember = async (memberId: string) => {
    if (!workspaceId) return;

    try {
      await api.delete(`/workspaces/${workspaceId}/members/${memberId}`);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  return {
    workspace,
    members,
    isLoading,
    error,
    updateWorkspace,
    inviteMember,
    removeMember,
    refetch: fetchWorkspace,
  };
}
