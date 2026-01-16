/**
 * TeamSettings - Team member management within settings
 * 
 * Member table with search, role assignment, and invite functionality.
 */

import { useState } from "react";
import {
  Search,
  UserPlus,
  Shield,
  Users,
  Eye,
  ChevronRight,
  RotateCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/avatar";
import { SearchInput } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { InviteModal } from "@/components/settings/InviteModal";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member" | "viewer";
  status: "active" | "invited";
  lastActive?: string;
}

const TEAM_MEMBERS: TeamMember[] = [
  {
    id: "1",
    name: "Sarah K.",
    email: "sarah@acme.com",
    role: "admin",
    status: "active",
    lastActive: "2 hours ago",
  },
  {
    id: "2",
    name: "John D.",
    email: "john@acme.com",
    role: "member",
    status: "active",
    lastActive: "1 day ago",
  },
  {
    id: "3",
    name: "Pending",
    email: "alex@acme.com",
    role: "member",
    status: "invited",
  },
];

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
];

const ROLE_DESCRIPTIONS = [
  {
    role: "Admin",
    icon: Shield,
    description: "Manage team, billing, and integrations",
  },
  {
    role: "Member",
    icon: Users,
    description: "Create and edit value cases",
  },
  {
    role: "Viewer",
    icon: Eye,
    description: "View cases (read-only)",
  },
];

export function TeamSettings() {
  const [searchQuery, setSearchQuery] = useState("");
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [members, setMembers] = useState(TEAM_MEMBERS);

  const filteredMembers = members.filter(
    (member) =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRoleChange = (memberId: string, newRole: string) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId ? { ...m, role: newRole as TeamMember["role"] } : m
      )
    );
  };

  const handleResendInvite = (memberId: string) => {
    console.log("Resending invite to:", memberId);
  };

  const handleInvite = (emails: string[], role: string, message: string) => {
    console.log("Inviting:", { emails, role, message });
    setInviteModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Team Members</h2>
        <Button onClick={() => setInviteModalOpen(true)} size="sm">
          <UserPlus className="h-4 w-4 mr-2" />
          Invite
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <SearchInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery("")}
            placeholder="Search members..."
            className="max-w-sm"
          />
        </CardContent>
      </Card>

      {/* Member Table */}
      <Card>
        <div className="overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-muted/50 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div className="col-span-4">Name</div>
            <div className="col-span-3">Email</div>
            <div className="col-span-2">Role</div>
            <div className="col-span-3">Last active</div>
          </div>

          {/* Table Body */}
          <div className="divide-y">
            {filteredMembers.map((member) => (
              <div
                key={member.id}
                className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-muted/30 transition-colors cursor-pointer"
              >
                {/* Name with Avatar */}
                <div className="col-span-4 flex items-center gap-3">
                  <UserAvatar
                    name={member.status === "invited" ? "?" : member.name}
                    size="sm"
                  />
                  <span className="font-medium">
                    {member.status === "invited" ? "Pending" : member.name}
                  </span>
                </div>

                {/* Email */}
                <div className="col-span-3 text-sm text-muted-foreground truncate">
                  {member.email}
                </div>

                {/* Role Dropdown */}
                <div className="col-span-2">
                  {member.status === "invited" ? (
                    <Badge variant="secondary">{member.role}</Badge>
                  ) : (
                    <SimpleSelect
                      value={member.role}
                      onValueChange={(value) => handleRoleChange(member.id, value)}
                      options={ROLE_OPTIONS}
                    />
                  )}
                </div>

                {/* Last Active / Resend */}
                <div className="col-span-3 flex items-center justify-between">
                  {member.status === "invited" ? (
                    <>
                      <span className="text-sm text-muted-foreground">Invited</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResendInvite(member.id);
                        }}
                      >
                        <RotateCw className="h-3 w-3 mr-1" />
                        Resend
                      </Button>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {member.lastActive}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Roles Explanation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Roles Explanation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ROLE_DESCRIPTIONS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.role} className="flex items-start gap-3">
                <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <span className="font-medium">{item.role}</span>
                  <span className="text-muted-foreground ml-2">
                    • {item.description}
                  </span>
                </div>
              </div>
            );
          })}

          <div className="pt-3 flex justify-end">
            <Button variant="link" size="sm" className="text-muted-foreground">
              Manage custom roles
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Invite Modal */}
      <InviteModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        onInvite={handleInvite}
      />
    </div>
  );
}

export default TeamSettings;
