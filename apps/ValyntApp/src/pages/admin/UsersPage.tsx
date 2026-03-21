import { Mail, MoreHorizontal, Plus, Search, Shield } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTeam } from "@/features/team/hooks/useTeam";
import type { TeamRole, MemberStatus } from "@/features/team/types";

const roleColors: Record<TeamRole, string> = {
  owner: "bg-purple-100 text-purple-700",
  admin: "bg-purple-100 text-purple-700",
  member: "bg-blue-100 text-blue-700",
  viewer: "bg-gray-100 text-gray-700",
};

const statusColors: Record<MemberStatus, string> = {
  active: "bg-green-100 text-green-700",
  invited: "bg-yellow-100 text-yellow-700",
  suspended: "bg-red-100 text-red-700",
};

export function UsersPage() {
  const [search, setSearch] = useState("");
  const { members, invites, isLoading, inviteMember } = useTeam();

  // Combine active members and pending invites into a unified list
  const allUsers = [
    ...members.map((m) => ({
      id: m.id,
      email: m.email,
      fullName: m.fullName,
      role: m.role,
      status: m.status,
      lastActive: m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : "—",
    })),
    ...invites.map((inv) => ({
      id: inv.id,
      email: inv.email,
      fullName: inv.email,
      role: inv.role,
      status: "invited" as MemberStatus,
      lastActive: "Pending",
    })),
  ];

  const filteredUsers = allUsers.filter(
    (u) =>
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted-foreground">Manage user accounts and permissions</p>
        </div>
        <Button
          onClick={() => {
            const email = window.prompt("Enter email address to invite:");
            if (email) inviteMember({ email, role: "member" });
          }}
        >
          <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
          Invite User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                aria-label="Search users"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground" role="status" aria-live="polite">
              Loading users…
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No users found.
            </div>
          ) : (
            <div className="divide-y" role="list" aria-label="Users">
              {filteredUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between py-4" role="listitem">
                  <div className="flex items-center gap-4">
                    <div
                      className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center"
                      aria-hidden="true"
                    >
                      <span className="text-sm font-medium text-primary">
                        {user.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{user.fullName}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" aria-hidden="true" />
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge className={roleColors[user.role]}>
                      <Shield className="h-3 w-3 mr-1" aria-hidden="true" />
                      {user.role}
                    </Badge>
                    <Badge className={statusColors[user.status]}>{user.status}</Badge>
                    <span className="text-sm text-muted-foreground w-24">{user.lastActive}</span>
                    <Button variant="ghost" size="icon" aria-label={`More actions for ${user.fullName}`}>
                      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default UsersPage;
