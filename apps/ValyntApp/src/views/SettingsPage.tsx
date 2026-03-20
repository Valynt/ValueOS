import {
  BookOpen, Building2, Copy, CreditCard, ExternalLink, Eye, EyeOff, Key, Plus, Shield, Trash2, Users,
} from "lucide-react";
import { useState } from "react";

import { apiClient } from "@/api/client/unified-api-client";
import { cn } from "@/lib/utils";

const tabs = [
  { key: "org", label: "Organization", icon: Building2 },
  { key: "users", label: "Users & Roles", icon: Users },
  { key: "api-keys", label: "API Keys", icon: Key },
  { key: "billing", label: "Billing", icon: CreditCard },
  { key: "security", label: "Security", icon: Shield },
  { key: "company-context", label: "Company Context", icon: BookOpen },
];

// -- Organization Tab --
function OrgTab() {
  return (
    <div className="max-w-lg space-y-6">
      <div>
        <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground block mb-2">Organization Name</label>
        <input type="text" defaultValue="Acme Corp" className="w-full px-4 py-2.5 rounded-xl border border-border text-[13px] bg-card focus:border-zinc-400 outline-none" />
      </div>
      <div>
        <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground block mb-2">Slug</label>
        <input type="text" defaultValue="acme-corp" className="w-full px-4 py-2.5 rounded-xl border border-border text-[13px] bg-card font-mono focus:border-zinc-400 outline-none" />
      </div>
      <div>
        <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground block mb-2">Plan</label>
        <div className="flex items-center gap-3 p-4 bg-surface rounded-xl border border-border">
          <span className="px-3 py-1 bg-background text-white rounded-lg text-[12px] font-semibold">Enterprise</span>
          <span className="text-[13px] text-muted-foreground">Unlimited agents, 50 users, priority support</span>
        </div>
      </div>
      <button className="px-4 py-2.5 bg-background text-white rounded-xl text-[13px] font-medium hover:bg-surface-elevated transition-colors">
        Save Changes
      </button>
    </div>
  );
}

// -- Users Tab --
function UsersTab() {
  const users = [
    { name: "Sarah Chen", email: "sarah@acme.com", role: "admin", status: "active" },
    { name: "James Park", email: "james@acme.com", role: "manager", status: "active" },
    { name: "Maria Santos", email: "maria@acme.com", role: "member", status: "active" },
    { name: "David Kim", email: "david@acme.com", role: "member", status: "invited" },
  ];

  const roleColors: Record<string, string> = {
    admin: "bg-red-50 text-red-700",
    manager: "bg-blue-50 text-blue-700",
    member: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-muted-foreground">{users.length} users</span>
        <button className="flex items-center gap-2 px-3 py-2 bg-background text-white rounded-xl text-[12px] font-medium hover:bg-surface-elevated">
          <Plus className="w-3.5 h-3.5" />
          Invite User
        </button>
      </div>
      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.email} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
              <span className="text-[13px] font-semibold text-muted-foreground">
                {u.name.split(" ").map(n => n[0]).join("")}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-foreground">{u.name}</p>
              <p className="text-[12px] text-muted-foreground">{u.email}</p>
            </div>
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize", roleColors[u.role])}>
              {u.role}
            </span>
            {u.status === "invited" && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700">Pending</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// -- API Keys Tab --
function ApiKeysTab() {
  const [showKey, setShowKey] = useState<string | null>(null);
  const keys = [
    { id: "key_1", name: "Production API", prefix: "vos_prod_", created: "Jan 10, 2026", lastUsed: "2h ago", scopes: ["read", "write"] },
    { id: "key_2", name: "CI/CD Pipeline", prefix: "vos_ci_", created: "Feb 1, 2026", lastUsed: "1d ago", scopes: ["read"] },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-muted-foreground">{keys.length} API keys</span>
        <button className="flex items-center gap-2 px-3 py-2 bg-background text-white rounded-xl text-[12px] font-medium hover:bg-surface-elevated">
          <Plus className="w-3.5 h-3.5" />
          Create Key
        </button>
      </div>
      <div className="space-y-2">
        {keys.map((k) => (
          <div key={k.id} className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <Key className="w-4 h-4 text-muted-foreground" />
                <span className="text-[13px] font-medium text-foreground">{k.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowKey(showKey === k.id ? null : k.id)} className="p-1.5 rounded-lg hover:bg-muted">
                  {showKey === k.id ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
                <button className="p-1.5 rounded-lg hover:bg-muted">
                  <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <button className="p-1.5 rounded-lg hover:bg-red-50">
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <code className="text-[12px] font-mono text-muted-foreground bg-surface px-2 py-1 rounded">
                {showKey === k.id ? `${k.prefix}sk_live_abc123def456` : `${k.prefix}sk_live_••••••••`}
              </code>
              <div className="flex gap-1">
                {k.scopes.map((s) => (
                  <span key={s} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground">{s}</span>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">Created {k.created} &middot; Last used {k.lastUsed}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// -- Billing Tab --
function BillingTab() {
  return (
    <div className="max-w-lg space-y-6">
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="text-[13px] font-semibold text-foreground mb-3">Current Plan</h3>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xl font-black text-zinc-950">Enterprise</p>
            <p className="text-[12px] text-muted-foreground">$2,400/mo &middot; Billed annually</p>
          </div>
          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[12px] font-semibold">Active</span>
        </div>
        <div className="space-y-2 mb-4">
          {[
            { label: "Agent runs", used: 142, limit: "Unlimited" },
            { label: "Users", used: 4, limit: "50" },
            { label: "API calls", used: "12.4K", limit: "100K" },
          ].map((u) => (
            <div key={u.label} className="flex items-center justify-between text-[12px]">
              <span className="text-muted-foreground">{u.label}</span>
              <span className="text-muted-foreground font-medium">{u.used} / {u.limit}</span>
            </div>
          ))}
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-[13px] font-medium text-muted-foreground hover:bg-surface w-full justify-center">
          <ExternalLink className="w-4 h-4" />
          Manage in Stripe
        </button>
      </div>
    </div>
  );
}

// -- Security Tab --
function SecurityTab() {
  return (
    <div className="max-w-lg space-y-6">
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="text-[13px] font-semibold text-foreground mb-4">Authentication</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] text-muted-foreground">Multi-Factor Authentication</p>
              <p className="text-[11px] text-muted-foreground">Require MFA for all users</p>
            </div>
            <button className="w-11 h-6 bg-emerald-500 rounded-full relative">
              <div className="w-5 h-5 bg-card rounded-full absolute right-0.5 top-0.5 shadow-sm" />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] text-muted-foreground">WebAuthn / Passkeys</p>
              <p className="text-[11px] text-muted-foreground">Allow passwordless authentication</p>
            </div>
            <button className="w-11 h-6 bg-muted/70 rounded-full relative">
              <div className="w-5 h-5 bg-card rounded-full absolute left-0.5 top-0.5 shadow-sm" />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] text-muted-foreground">Session Timeout</p>
              <p className="text-[11px] text-muted-foreground">Auto-logout after inactivity</p>
            </div>
            <span className="text-[13px] font-medium text-muted-foreground">30 minutes</span>
          </div>
        </div>
      </div>
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="text-[13px] font-semibold text-foreground mb-3">Audit Log Access</h3>
        <p className="text-[12px] text-muted-foreground mb-3">Download audit logs for compliance review</p>
        <button className="px-4 py-2 border border-border rounded-xl text-[12px] font-medium text-muted-foreground hover:bg-surface">
          Export Audit Logs
        </button>
      </div>
    </div>
  );
}

// -- Company Context Tab --
function CompanyContextTab() {
  const [form, setForm] = useState({ products: "", icps: "", competitors: "", personas: "", websiteUrl: "" });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("saving");

    try {
      const response = await apiClient.post("/api/v1/tenant/context", {
        products: form.products.split(",").map(s => s.trim()).filter(Boolean),
        icps: form.icps.split(",").map(s => s.trim()).filter(Boolean),
        competitors: form.competitors.split(",").map(s => s.trim()).filter(Boolean),
        personas: form.personas.split(",").map(s => s.trim()).filter(Boolean),
        websiteUrl: form.websiteUrl || undefined,
      });
      setStatus(response.success ? "saved" : "error");
    } catch {
      setStatus("error");
    }
  };

  const fields: { name: keyof typeof form; label: string; placeholder: string; type?: string }[] = [
    { name: "products", label: "Products / Services", placeholder: "e.g. CRM Software, Analytics Platform" },
    { name: "icps", label: "Ideal Customer Profiles", placeholder: "e.g. Mid-market SaaS, Enterprise Finance" },
    { name: "competitors", label: "Competitors", placeholder: "e.g. Salesforce, HubSpot" },
    { name: "personas", label: "Buyer Personas", placeholder: "e.g. VP Sales, CFO, IT Director" },
    { name: "websiteUrl", label: "Website URL", placeholder: "https://example.com", type: "url" },
  ];

  return (
    <div className="max-w-lg space-y-5">
      <p className="text-[13px] text-muted-foreground">
        Configure company context to help AI agents generate more relevant insights. Separate multiple values with commas.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map(({ name, label, placeholder, type }) => (
          <div key={name}>
            <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground block mb-2">{label}</label>
            <input
              name={name}
              type={type ?? "text"}
              value={form[name]}
              onChange={handleChange}
              placeholder={placeholder}
              className="w-full px-4 py-2.5 rounded-xl border border-border text-[13px] bg-card focus:border-zinc-400 outline-none"
            />
          </div>
        ))}
        {status === "saved" && <p className="text-[12px] text-green-600">Saved.</p>}
        {status === "error" && <p className="text-[12px] text-red-600">Failed to save. Please try again.</p>}
        <button
          type="submit"
          disabled={status === "saving"}
          className="px-4 py-2.5 bg-background text-white rounded-xl text-[13px] font-medium hover:bg-surface-elevated transition-colors disabled:opacity-50"
        >
          {status === "saving" ? "Saving…" : "Save Changes"}
        </button>
      </form>
    </div>
  );
}

// -- Settings Page --
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("org");

  const tabContent: Record<string, React.ReactNode> = {
    org: <OrgTab />,
    users: <UsersTab />,
    "api-keys": <ApiKeysTab />,
    billing: <BillingTab />,
    security: <SecurityTab />,
    "company-context": <CompanyContextTab />,
  };

  return (
    <div className="p-6 lg:p-10 max-w-[1200px] mx-auto">
      <h1 className="text-2xl font-black text-zinc-950 tracking-[-0.05em] mb-6">Settings</h1>

      <div className="flex gap-8">
        {/* Left nav */}
        <nav className="w-48 flex-shrink-0 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors text-left",
                activeTab === tab.key
                  ? "bg-background text-white"
                  : "text-muted-foreground hover:bg-muted hover:text-muted-foreground"
              )}
            >
              <tab.icon className="w-[18px] h-[18px]" />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {tabContent[activeTab]}
        </div>
      </div>
    </div>
  );
}
