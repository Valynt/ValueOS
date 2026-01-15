import { useState, useEffect, useCallback } from "react";
import type { TeamMember, TeamInvite, TeamRole } from "../types";
import { api } from "@/services/api/client";

export function useTeam(teamId?: string) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeam = useCallback(async () => {
    if (!teamId) return;

    setIsLoading(true);
    try {
      // TODO: Replace with actual API calls
      // const data = await api.get(`/teams/${teamId}/members`);
      // setMembers(data.members);
      // setInvites(data.invites);

      // Mock data
      setMembers([
        {
          id: "1",
          userId: "u1",
          email: "owner@example.com",
          fullName: "Team Owner",
          role: "owner",
          status: "active",
          joinedAt: new Date().toISOString(),
        },
      ]);
      setInvites([]);
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
    try {
      // await api.post(`/teams/${teamId}/invites`, { email, role });
      await fetchTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite member");
      throw err;
    }
  };

  const updateMemberRole = async (memberId: string, role: TeamRole) => {
    try {
      // await api.patch(`/teams/${teamId}/members/${memberId}`, { role });
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role } : m))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
      throw err;
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      // await api.delete(`/teams/${teamId}/members/${memberId}`);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
      throw err;
    }
  };

  const cancelInvite = async (inviteId: string) => {
    try {
      // await api.delete(`/teams/${teamId}/invites/${inviteId}`);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel invite");
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
