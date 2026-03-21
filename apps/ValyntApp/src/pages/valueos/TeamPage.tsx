/**
 * TeamPage - Team member management
 *
 * List members, roles, invite new members.
 * Data sourced from the tenant's team roster via useTeam().
 */

import {
  Mail,
  MoreHorizontal,
  Search,
  Shield,
  UserPlus,
} from "lucide-react";
import { useState } from "react";

import { useTeam } from "@/features/team/hooks/useTeam";
import type { TeamRole } from "@/features/team/types";
import { useTenant } from "@/contexts/TenantContext";

import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";

const roleColors: Record<TeamRole, string> = {
  owner: "bg-red-50 text-red-700 border-red-200",
  admin: "bg-red-50 text-red-700 border-red-200",
  member: "bg-blue-50 text-blue-700 border-blue-200",
  viewer: "bg-slate-100 text-slate-600 border-slate-200",
};

const roleOptions = [
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
];

export function TeamPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("member");

  const { currentTenant } = useTenant();
  const { members, invites, isLoading, inviteMember, isInviting } = useTeam();

  const allEntries = [
    ...members.map((m) => ({
      id: m.id,
      name: m.fullName || m.email,
      email: m.email,
      role: m.role,
      status: m.status as "active" | "invited",
      lastActive: m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : "—",
    })),
    ...invites.map((inv) => ({
      id: inv.id,
      name: inv.email,
      email: inv.email,
      role: inv.role,
      status: "invited" as const,
      lastActive: undefined,
    })),
  ];

  const filteredMembers = allEntries.filter(
    (member) =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleInvite = () => {
    inviteMember({ email: inviteEmail, role: inviteRole });
    setInviteModalOpen(false);
    setInviteEmail("");
    setInviteRole("member");
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Manage Team</h1>
          <p className="text-muted-foreground mt-1">
            Manage access and permissions for {currentTenant?.name ?? "your workspace"}.
          </p>
        </div>
        <Button onClick={() => setInviteModalOpen(true)} className="gap-2">
          <UserPlus size={16} aria-hidden="true" />
          Invite Member
        </Button>
      </div>

      {/* Search and Filter */}
      <Card className="mb-6 p-4 border border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search members..."
              aria-label="Search team members"
              className="w-full pl-9 pr-4 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>
          <Button variant="outline" size="sm">
            Filter
          </Button>
        </div>
      </Card>

      {/* Members Table */}
      <Card className="bg-card border border-border overflow-hidden">
        {/* Table Header */}
        <div
          className="grid grid-cols-12 gap-4 px-6 py-3 bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider"
          role="row"
          aria-label="Table header"
        >
          <div className="col-span-5">Name</div>
          <div className="col-span-2">Role</div>
          <div className="col-span-3">Last Active</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {/* Table Body */}
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground" role="status" aria-live="polite">
            Loading team members…
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No team members found.
          </div>
        ) : (
          <div className="divide-y divide-border" role="list" aria-label="Team members">
            {filteredMembers.map((member) => (
              <div
                key={member.id}
                className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-muted/30 transition-colors"
                role="listitem"
              >
                {/* Name & Email */}
                <div className="col-span-5 flex items-center gap-3">
                  <UserAvatar
                    name={member.name}
                    size="md"
                    className={member.role === "admin" || member.role === "owner" ? "ring-2 ring-primary" : ""}
                  />
                  <div>
                    <div className="font-medium text-foreground">{member.name}</div>
                    <div className="text-sm text-muted-foreground">{member.email}</div>
                  </div>
                </div>

                {/* Role */}
                <div className="col-span-2">
                  <Badge className={`capitalize ${roleColors[member.role]}`}>
                    {(member.role === "admin" || member.role === "owner") && (
                      <Shield size={10} className="mr-1" aria-hidden="true" />
                    )}
                    {member.role}
                  </Badge>
                </div>

                {/* Last Active */}
                <div className="col-span-3">
                  {member.status === "invited" ? (
                    <span className="flex items-center gap-1 text-sm text-amber-600">
                      <Mail size={14} aria-hidden="true" />
                      Invite Sent
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">{member.lastActive}</span>
                  )}
                </div>

                {/* Actions */}
                <div className="col-span-2 text-right">
                  <button
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
                    aria-label={`More actions for ${member.name}`}
                  >
                    <MoreHorizontal size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Invite Modal */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join your team on ValueOS.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="invite-email">
                Email address
              </label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                aria-required="true"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="invite-role">
                Role
              </label>
              <SimpleSelect
                value={inviteRole}
                onValueChange={(v) => setInviteRole(v as TeamRole)}
                options={roleOptions}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Invites will be sent from noreply@valueos.io
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={!inviteEmail || isInviting}>
              {isInviting ? "Sending…" : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TeamPage;
