import { useState } from "react";
import { Search, Plus, MoreHorizontal, Mail, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface User {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "member" | "viewer";
  status: "active" | "invited" | "suspended";
  lastActive: string;
}

const mockUsers: User[] = [
  { id: "1", email: "admin@example.com", fullName: "Admin User", role: "admin", status: "active", lastActive: "Just now" },
  { id: "2", email: "john@example.com", fullName: "John Doe", role: "member", status: "active", lastActive: "2 hours ago" },
  { id: "3", email: "jane@example.com", fullName: "Jane Smith", role: "member", status: "active", lastActive: "1 day ago" },
  { id: "4", email: "viewer@example.com", fullName: "View Only", role: "viewer", status: "active", lastActive: "3 days ago" },
  { id: "5", email: "pending@example.com", fullName: "Pending User", role: "member", status: "invited", lastActive: "Never" },
];

const roleColors = {
  admin: "bg-purple-100 text-purple-700",
  member: "bg-blue-100 text-blue-700",
  viewer: "bg-gray-100 text-gray-700",
};

const statusColors = {
  active: "bg-green-100 text-green-700",
  invited: "bg-yellow-100 text-yellow-700",
  suspended: "bg-red-100 text-red-700",
};

export function UsersPage() {
  const [search, setSearch] = useState("");
  const [users] = useState<User[]>(mockUsers);

  const filteredUsers = users.filter(
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
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Invite User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
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
          <div className="divide-y">
            {filteredUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {user.fullName.split(" ").map((n) => n[0]).join("")}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{user.fullName}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {user.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge className={roleColors[user.role]}>
                    <Shield className="h-3 w-3 mr-1" />
                    {user.role}
                  </Badge>
                  <Badge className={statusColors[user.status]}>{user.status}</Badge>
                  <span className="text-sm text-muted-foreground w-24">{user.lastActive}</span>
                  <Button variant="ghost" size="icon" aria-label="More actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default UsersPage;
