import { useState, useEffect, useCallback } from "react";
import type { TeamMember, TeamInvite, TeamRole } from "../types";
import { api } from "@/services/api/client";

export function useTeam(teamId?: string) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeam = useCallback(async () => {
    if (!teamId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const data = await api.get<{ members: TeamMember[]; invites: TeamInvite[] }>(
        `/api/teams/${teamId}/members`
      );
      setMembers(data.members);
      setInvites(data.invites);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch team");
    } finally {
      setIsLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const inviteMember = async (email: string, role: TeamRole) => {
    if (!teamId) return;
    try {
      await api.post(`/api/teams/${teamId}/invites`, { email, role });
      await fetchTeam();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to invite member";
      setError(message);
      throw err;
    }
  };

  const updateMemberRole = async (memberId: string, role: TeamRole) => {
    if (!teamId) return;
    try {
      await api.patch(`/api/teams/${teamId}/members/${memberId}`, { role });
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role } : m))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update role";
      setError(message);
      throw err;
    }
  };

  const removeMember = async (memberId: string) => {
    if (!teamId) return;
    try {
      await api.delete(`/api/teams/${teamId}/members/${memberId}`);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove member";
      setError(message);
      throw err;
    }
  };

  const cancelInvite = async (inviteId: string) => {
    if (!teamId) return;
    try {
      await api.delete(`/api/teams/${teamId}/invites/${inviteId}`);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to cancel invite";
      setError(message);
      throw err;
    }
  };

  return {
    members,
    invites,
    isLoading,
    error,
    inviteMember,
    updateMemberRole,
    removeMember,
    cancelInvite,
    refetch: fetchTeam,
  };
}
