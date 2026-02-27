import { useState } from "react";
import {
  Building2, Copy, CreditCard, ExternalLink, Eye, EyeOff, Key, Plus, Shield, Trash2, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { key: "org", label: "Organization", icon: Building2 },
  { key: "users", label: "Users & Roles", icon: Users },
  { key: "api-keys", label: "API Keys", icon: Key },
  { key: "billing", label: "Billing", icon: CreditCard },
  { key: "security", label: "Security", icon: Shield },
];

// -- Organization Tab --
function OrgTab() {
  return (
    <div className="max-w-lg space-y-6">
      <div>
        <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400 block mb-2">Organization Name</label>
        <input type="text" defaultValue="Acme Corp" className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-[13px] bg-white focus:border-zinc-400 outline-none" />
      </div>
      <div>
        <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400 block mb-2">Slug</label>
        <input type="text" defaultValue="acme-corp" className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-[13px] bg-white font-mono focus:border-zinc-400 outline-none" />
      </div>
      <div>
        <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400 block mb-2">Plan</label>
        <div className="flex items-center gap-3 p-4 bg-zinc-50 rounded-xl border border-zinc-200">
          <span className="px-3 py-1 bg-zinc-950 text-white rounded-lg text-[12px] font-semibold">Enterprise</span>
          <span className="text-[13px] text-zinc-600">Unlimited agents, 50 users, priority support</span>
        </div>
      </div>
      <button className="px-4 py-2.5 bg-zinc-950 text-white rounded-xl text-[13px] font-medium hover:bg-zinc-800 transition-colors">
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
    member: "bg-zinc-100 text-zinc-600",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-zinc-500">{users.length} users</span>
        <button className="flex items-center gap-2 px-3 py-2 bg-zinc-950 text-white rounded-xl text-[12px] font-medium hover:bg-zinc-800">
          <Plus className="w-3.5 h-3.5" />
          Invite User
        </button>
      </div>
      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.email} className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center">
              <span className="text-[13px] font-semibold text-zinc-600">
                {u.name.split(" ").map(n => n[0]).join("")}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-zinc-900">{u.name}</p>
              <p className="text-[12px] text-zinc-400">{u.email}</p>
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
        <span className="text-[13px] text-zinc-500">{keys.length} API keys</span>
        <button className="flex items-center gap-2 px-3 py-2 bg-zinc-950 text-white rounded-xl text-[12px] font-medium hover:bg-zinc-800">
          <Plus className="w-3.5 h-3.5" />
          Create Key
        </button>
      </div>
      <div className="space-y-2">
        {keys.map((k) => (
          <div key={k.id} className="bg-white border border-zinc-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <Key className="w-4 h-4 text-zinc-400" />
                <span className="text-[13px] font-medium text-zinc-900">{k.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowKey(showKey === k.id ? null : k.id)} className="p-1.5 rounded-lg hover:bg-zinc-100">
                  {showKey === k.id ? <EyeOff className="w-3.5 h-3.5 text-zinc-400" /> : <Eye className="w-3.5 h-3.5 text-zinc-400" />}
                </button>
                <button className="p-1.5 rounded-lg hover:bg-zinc-100">
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                </button>
                <button className="p-1.5 rounded-lg hover:bg-red-50">
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <code className="text-[12px] font-mono text-zinc-500 bg-zinc-50 px-2 py-1 rounded">
                {showKey === k.id ? `${k.prefix}sk_live_abc123def456` : `${k.prefix}sk_live_••••••••`}
              </code>
              <div className="flex gap-1">
                {k.scopes.map((s) => (
                  <span key={s} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 text-zinc-500">{s}</span>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-zinc-400 mt-2">Created {k.created} &middot; Last used {k.lastUsed}</p>
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
      <div className="bg-white border border-zinc-200 rounded-2xl p-5">
        <h3 className="text-[13px] font-semibold text-zinc-900 mb-3">Current Plan</h3>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xl font-black text-zinc-950">Enterprise</p>
            <p className="text-[12px] text-zinc-400">$2,400/mo &middot; Billed annually</p>
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
              <span className="text-zinc-500">{u.label}</span>
              <span className="text-zinc-700 font-medium">{u.used} / {u.limit}</span>
            </div>
          ))}
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 border border-zinc-200 rounded-xl text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 w-full justify-center">
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
      <div className="bg-white border border-zinc-200 rounded-2xl p-5">
        <h3 className="text-[13px] font-semibold text-zinc-900 mb-4">Authentication</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] text-zinc-700">Multi-Factor Authentication</p>
              <p className="text-[11px] text-zinc-400">Require MFA for all users</p>
            </div>
            <button className="w-11 h-6 bg-emerald-500 rounded-full relative">
              <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm" />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] text-zinc-700">WebAuthn / Passkeys</p>
              <p className="text-[11px] text-zinc-400">Allow passwordless authentication</p>
            </div>
            <button className="w-11 h-6 bg-zinc-200 rounded-full relative">
              <div className="w-5 h-5 bg-white rounded-full absolute left-0.5 top-0.5 shadow-sm" />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] text-zinc-700">Session Timeout</p>
              <p className="text-[11px] text-zinc-400">Auto-logout after inactivity</p>
            </div>
            <span className="text-[13px] font-medium text-zinc-700">30 minutes</span>
          </div>
        </div>
      </div>
      <div className="bg-white border border-zinc-200 rounded-2xl p-5">
        <h3 className="text-[13px] font-semibold text-zinc-900 mb-3">Audit Log Access</h3>
        <p className="text-[12px] text-zinc-500 mb-3">Download audit logs for compliance review</p>
        <button className="px-4 py-2 border border-zinc-200 rounded-xl text-[12px] font-medium text-zinc-700 hover:bg-zinc-50">
          Export Audit Logs
        </button>
      </div>
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
                  ? "bg-zinc-950 text-white"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
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
