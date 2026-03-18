/**
 * Team hook — fetches team members and invites for the current tenant.
 *
 * Backend: GET  /api/teams/:tenantId/members
 *          POST /api/teams/:tenantId/invites
 *          PATCH /api/teams/:tenantId/members/:userId
 *          DELETE /api/teams/:tenantId/members/:userId
 *          DELETE /api/teams/:tenantId/invites/:userId
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { TeamInvite, TeamMember, TeamRole } from "../types";

import { apiClient } from "@/api/client/unified-api-client";
import { useTenant } from "@/contexts/TenantContext";

interface TeamResponse {
  members: TeamMember[];
  invites: TeamInvite[];
}

export const teamKeys = {
  all: ["team"] as const,
  members: (tenantId: string) => ["team", tenantId] as const,
};

export function useTeam() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const query = useQuery<TeamResponse, Error>({
    queryKey: teamKeys.members(tenantId ?? ""),
    enabled: !!tenantId,
    queryFn: async () => {
      const res = await apiClient.get<TeamResponse>(
        `/api/teams/${tenantId}/members`,
      );
      if (!res.success) throw new Error(res.error?.message ?? "Failed to fetch team");
      return res.data ?? { members: [], invites: [] };
    },
    staleTime: 30_000,
  });

  const inviteMember = useMutation<TeamInvite, Error, { email: string; role: TeamRole }>({
    mutationFn: async (input) => {
      const res = await apiClient.post<TeamInvite>(
        `/api/teams/${tenantId}/invites`,
        input,
      );
      if (!res.success) throw new Error(res.error?.message ?? "Failed to invite member");
      if (!res.data) throw new Error("No data in response");
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: teamKeys.members(tenantId ?? "") });
    },
  });

  const updateRole = useMutation<void, Error, { userId: string; role: TeamRole }>({
    mutationFn: async ({ userId, role }) => {
      const res = await apiClient.patch(
        `/api/teams/${tenantId}/members/${userId}`,
        { role },
      );
      if (!res.success) throw new Error(res.error?.message ?? "Failed to update role");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: teamKeys.members(tenantId ?? "") });
    },
  });

  const removeMember = useMutation<void, Error, string>({
    mutationFn: async (userId) => {
      const res = await apiClient.delete(
        `/api/teams/${tenantId}/members/${userId}`,
      );
      if (!res.success) throw new Error(res.error?.message ?? "Failed to remove member");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: teamKeys.members(tenantId ?? "") });
    },
  });

  const cancelInvite = useMutation<void, Error, string>({
    mutationFn: async (userId) => {
      const res = await apiClient.delete(
        `/api/teams/${tenantId}/invites/${userId}`,
      );
      if (!res.success) throw new Error(res.error?.message ?? "Failed to cancel invite");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: teamKeys.members(tenantId ?? "") });
    },
  });

  return {
    team: currentTenant ? { id: currentTenant.id, name: currentTenant.name ?? "" } : null,
    members: query.data?.members ?? [],
    invites: query.data?.invites ?? [],
    isLoading: query.isLoading,
    error: query.error,
    inviteMember: inviteMember.mutate,
    isInviting: inviteMember.isPending,
    updateRole: updateRole.mutate,
    removeMember: removeMember.mutate,
    cancelInvite: cancelInvite.mutate,
  };
}
