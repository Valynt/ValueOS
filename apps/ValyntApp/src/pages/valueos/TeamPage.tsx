/**
 * TeamPage - Team member management
 * 
 * List members, roles, invite new members.
 */

import React, { useState } from "react";
import {
  Search,
  UserPlus,
  MoreHorizontal,
  Mail,
  Shield,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";

// Types
interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member" | "viewer";
  status: "active" | "invited";
  lastActive?: string;
}

// Mock data
const TEAM_MEMBERS: TeamMember[] = [
  {
    id: "1",
    name: "Sarah K.",
    email: "sarah@acme.com",
    role: "admin",
    status: "active",
    lastActive: "Now",
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
    name: "Alex M.",
    email: "alex@acme.com",
    role: "viewer",
    status: "invited",
  },
];

const roleColors = {
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
  const [inviteRole, setInviteRole] = useState("member");

  const filteredMembers = TEAM_MEMBERS.filter(
    (member) =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleInvite = () => {
    console.log("Inviting:", inviteEmail, "as", inviteRole);
    setInviteModalOpen(false);
    setInviteEmail("");
    setInviteRole("member");
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manage Team</h1>
          <p className="text-slate-500 mt-1">Manage access and permissions for Acme Corp.</p>
        </div>
        <Button onClick={() => setInviteModalOpen(true)} className="gap-2">
          <UserPlus size={16} />
          Invite Member
        </Button>
      </div>

      {/* Search and Filter */}
      <Card className="mb-6 p-4 bg-white border border-slate-200">
        <div className="flex items-center justify-between">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search members..."
              className="w-full pl-9 pr-4 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <Button variant="outline" size="sm">
            Filter
          </Button>
        </div>
      </Card>

      {/* Members Table */}
      <Card className="bg-white border border-slate-200 overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <div className="col-span-5">Name</div>
          <div className="col-span-2">Role</div>
          <div className="col-span-3">Last Active</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-slate-100">
          {filteredMembers.map((member) => (
            <div
              key={member.id}
              className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors"
            >
              {/* Name & Email */}
              <div className="col-span-5 flex items-center gap-3">
                <UserAvatar
                  name={member.name}
                  size="md"
                  className={member.role === "admin" ? "ring-2 ring-primary" : ""}
                />
                <div>
                  <div className="font-medium text-slate-900">{member.name}</div>
                  <div className="text-sm text-slate-500">{member.email}</div>
                </div>
              </div>

              {/* Role */}
              <div className="col-span-2">
                <Badge className={`capitalize ${roleColors[member.role]}`}>
                  {member.role === "admin" && <Shield size={10} className="mr-1" />}
                  {member.role}
                </Badge>
              </div>

              {/* Last Active */}
              <div className="col-span-3">
                {member.status === "invited" ? (
                  <span className="flex items-center gap-1 text-sm text-amber-600">
                    <Mail size={14} />
                    Invite Sent
                  </span>
                ) : (
                  <span className="text-sm text-slate-500">{member.lastActive}</span>
                )}
              </div>

              {/* Actions */}
              <div className="col-span-2 text-right">
                <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                  <MoreHorizontal size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
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
              <label className="text-sm font-medium text-slate-700">Email address</label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Role</label>
              <SimpleSelect
                value={inviteRole}
                onValueChange={setInviteRole}
                options={roleOptions}
              />
            </div>

            <p className="text-xs text-slate-500">
              Invites will be sent from noreply@valueos.io
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={!inviteEmail}>
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TeamPage;
