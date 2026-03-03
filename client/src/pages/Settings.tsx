/*
 * VALYNT Settings Page
 * Tabs: General, Users, Audit Log, Billing
 */
import { useState } from "react";
import {
  Settings as SettingsIcon, Users as UsersIcon, Shield, CreditCard,
  Building, Globe, Bell, Lock, User, Mail, Clock, ChevronRight,
  Plus, MoreHorizontal, CheckCircle2, AlertTriangle, FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { currentOrg, users, auditLog } from "@/lib/data";
import { toast } from "sonner";

export default function Settings() {
  return (
    <div className="p-6 space-y-6 max-w-[1000px]">
      <div>
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Manage your organization, users, and platform configuration.
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="bg-muted">
          <TabsTrigger value="general" className="gap-1.5">
            <Building className="w-3.5 h-3.5" />
            General
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5">
            <UsersIcon className="w-3.5 h-3.5" />
            Users
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            Audit Log
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-1.5">
            <CreditCard className="w-3.5 h-3.5" />
            Billing
          </TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-[15px]">Organization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Organization Name</label>
                  <Input defaultValue={currentOrg.name} className="h-10" />
                </div>
                <div>
                  <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Slug</label>
                  <Input defaultValue="value-org" className="h-10" />
                </div>
              </div>
              <div>
                <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Plan</label>
                <div className="flex items-center gap-2">
                  <Badge className="capitalize">{currentOrg.plan}</Badge>
                  <Button variant="link" size="sm" className="text-[12px] h-auto p-0" onClick={() => toast("Upgrade dialog coming soon")}>
                    Upgrade Plan
                  </Button>
                </div>
              </div>
              <Separator />
              <Button onClick={() => toast("Settings saved")} className="text-[13px]">Save Changes</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[15px]">Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "Agent Checkpoint Approvals", desc: "Notify when human review is required", default: true },
                { label: "Integrity Vetoes", desc: "Alert on evidence validation failures", default: true },
                { label: "Agent Run Failures", desc: "Notify when agent runs fail", default: true },
                { label: "Value Case Completions", desc: "Notify when a value case is finalized", default: false },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-medium">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch defaultChecked={item.default} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-muted-foreground">{users.length} members</p>
            <Button size="sm" className="gap-1.5 text-[12px]" onClick={() => toast("Invite user dialog coming soon")}>
              <Plus className="w-3.5 h-3.5" />
              Invite User
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">User</th>
                      <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Role</th>
                      <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Status</th>
                      <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Last Active</th>
                      <th className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="text-[11px] font-semibold bg-muted text-foreground">
                                {user.name.split(" ").map((n) => n[0]).join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-[13px] font-medium">{user.name}</p>
                              <p className="text-[11px] text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="text-[10px] capitalize">{user.role}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              user.status === "active" ? "bg-emerald-500" :
                              user.status === "invited" ? "bg-amber-500" :
                              "bg-red-500"
                            )} />
                            <span className="text-[12px] capitalize">{user.status}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[12px] text-muted-foreground">
                          {user.lastActive || "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => toast("User actions coming soon")}>
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">User</th>
                      <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Action</th>
                      <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Target</th>
                      <th className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLog.map((entry) => (
                      <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-[13px] text-muted-foreground">{entry.user}</td>
                        <td className="px-4 py-3 text-[13px] font-medium">{entry.action}</td>
                        <td className="px-4 py-3 text-[13px]">{entry.target}</td>
                        <td className="px-4 py-3 text-right text-[12px] text-muted-foreground">{entry.timestamp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-[15px]">Current Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <div>
                  <p className="text-lg font-bold text-foreground">Standard</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">Up to 10 tenants, 50 active cases</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold font-mono">$499</p>
                  <p className="text-[11px] text-muted-foreground">/month</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[15px]">Usage This Month</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "Agent Runs", used: 563, limit: 5000 },
                { label: "LLM Tokens", used: 2100000, limit: 10000000, format: (v: number) => `${(v / 1000000).toFixed(1)}M` },
                { label: "Active Value Cases", used: 5, limit: 50 },
                { label: "Connected Integrations", used: 3, limit: 10 },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-medium">{item.label}</span>
                    <span className="text-[12px] font-mono text-muted-foreground">
                      {item.format ? item.format(item.used) : item.used} / {item.format ? item.format(item.limit) : item.limit}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-foreground rounded-full transition-all"
                      style={{ width: `${Math.min((item.used / item.limit) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
