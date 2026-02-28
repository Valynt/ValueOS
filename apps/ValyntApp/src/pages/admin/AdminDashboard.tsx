import { Eye, Key, Settings, Shield, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";

const adminSections = [
  {
    title: "Users",
    description: "Manage user accounts and permissions",
    icon: Users,
    path: "/admin/users",
    stats: "24 active users",
  },
  {
    title: "Roles & Permissions",
    description: "Configure role-based access control",
    icon: Shield,
    path: "/admin/roles",
    stats: "3 roles defined",
  },
  {
    title: "API Keys",
    description: "Manage API keys and integrations",
    icon: Key,
    path: "/admin/api-keys",
    stats: "5 active keys",
  },
  {
    title: "System Settings",
    description: "Configure system-wide settings",
    icon: Settings,
    path: "/admin/settings",
    stats: "",
  },
  {
    title: "Security Monitoring",
    description: "Monitor security events and threats",
    icon: Eye,
    path: "/admin/security",
    stats: "Real-time monitoring",
  },
];

export function AdminDashboard() {
  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Manage users, permissions, and system settings</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {adminSections.map((section) => (
          <Link key={section.path} to={section.path}>
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <section.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </div>
              </CardHeader>
              {section.stats && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">{section.stats}</p>
                </CardContent>
              )}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default AdminDashboard;
