import { useState, useEffect, useCallback } from "react";
import type { Workspace, WorkspaceMember } from "../types";

export function useWorkspace(workspaceId?: string) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspace = useCallback(async () => {
    if (!workspaceId) return;

    setIsLoading(true);
    try {
      // TODO: Implement actual API call
      // const res = await fetch(`/api/workspaces/${workspaceId}`);
      // const data = await res.json();
      // setWorkspace(data.workspace);
      // setMembers(data.members);

      // Mock data for now
      setWorkspace({
        id: workspaceId,
        name: "My Workspace",
        slug: "my-workspace",
        ownerId: "user_1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setMembers([]);
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
      // TODO: Implement actual API call
      setWorkspace({ ...workspace, ...updates, updatedAt: new Date().toISOString() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update workspace");
    }
  };

  const inviteMember = async (email: string, role: WorkspaceMember["role"]) => {
    try {
      // TODO: Implement actual API call
      console.log("Invite member:", email, role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite member");
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      // TODO: Implement actual API call
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
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
