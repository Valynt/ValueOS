import {
  BookOpen, Building2, Copy, CreditCard, ExternalLink, Eye, EyeOff, Key, Loader2, Plus, Shield, Trash2, Users,
} from "lucide-react";
import { useEffect, useState } from "react";

import { apiClient } from "@/api/client/unified-api-client";
import { EmptyState } from "@/components/common/EmptyState";
import { useToast } from "@/components/common/Toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenant } from "@/contexts/TenantContext";
import { useTeam } from "@/features/team";
import { useBillingSummary } from "@/hooks/useBilling";
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
  const { currentTenant } = useTenant();
  const { showToast } = useToast();
  const [name, setName] = useState(currentTenant?.name ?? "");
  const [slug, setSlug] = useState(currentTenant?.slug ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiClient.patch("/api/v1/tenant", { name, slug });
      if (res.success) {
        showToast("Organization settings saved.", "success");
      } else {
        showToast(res.error?.message ?? "Failed to save settings.", "error");
      }
    } catch {
      showToast("Failed to save settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/70 block mb-2">
            Organization Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-border text-[13px] bg-background focus:border-ring outline-none"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/70 block mb-2">
            Slug
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-border text-[13px] bg-background font-mono focus:border-ring outline-none"
          />
        </div>
        {currentTenant?.role && (
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/70 block mb-2">
              Plan
            </label>
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-xl border border-border">
              <span className="px-3 py-1 bg-foreground text-background rounded-lg text-[12px] font-semibold capitalize">
                {currentTenant.role}
              </span>
            </div>
          </div>
        )}
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2.5 bg-foreground text-background rounded-xl text-[13px] font-medium hover:bg-foreground/80 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Save Changes
        </button>
      </form>
    </div>
  );
}

// -- Users Tab --
function UsersTab() {
  const { members, invites, isLoading, error, inviteMember, isInviting } = useTeam();
  const { showToast } = useToast();
  const [inviteEmail, setInviteEmail] = useState("");
  const [showInvite, setShowInvite] = useState(false);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    inviteMember(
      { email: inviteEmail.trim(), role: "member" },
      {
        onSuccess: () => {
          showToast(`Invite sent to ${inviteEmail}.`, "success");
          setInviteEmail("");
          setShowInvite(false);
        },
        onError: (err: Error) => showToast(err.message ?? "Failed to send invite.", "error"),
      },
    );
  };

  const roleColors: Record<string, string> = {
    owner: "bg-destructive/10 text-destructive",
    admin: "bg-destructive/10 text-destructive",
    member: "bg-muted text-muted-foreground",
    viewer: "bg-muted text-muted-foreground",
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-[13px] text-destructive">{error.message}</p>;
  }

  const allEntries = [
    ...members.map((m) => ({ id: m.id, name: m.fullName, email: m.email, role: m.role, status: m.status })),
    ...invites.map((i) => ({ id: i.id, name: i.email, email: i.email, role: i.role, status: "invited" as const })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-muted-foreground">{allEntries.length} users</span>
        <button
          onClick={() => setShowInvite((v) => !v)}
          className="flex items-center gap-2 px-3 py-2 bg-foreground text-background rounded-xl text-[12px] font-medium hover:bg-foreground/80"
        >
          <Plus className="w-3.5 h-3.5" />
          Invite User
        </button>
      </div>

      {showInvite && (
        <form onSubmit={handleInvite} className="flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@company.com"
            className="flex-1 px-4 py-2 rounded-xl border border-border text-[13px] bg-background focus:border-ring outline-none"
          />
          <button
            type="submit"
            disabled={isInviting}
            className="px-4 py-2 bg-foreground text-background rounded-xl text-[12px] font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {isInviting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Send
          </button>
        </form>
      )}

      {allEntries.length === 0 ? (
        <EmptyState
          title="No team members yet"
          description="Invite colleagues to collaborate on value cases."
        />
      ) : (
        <div className="space-y-2">
          {allEntries.map((u) => (
            <div key={u.id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                <span className="text-[13px] font-semibold text-muted-foreground">
                  {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-foreground">{u.name}</p>
                <p className="text-[12px] text-muted-foreground/70">{u.email}</p>
              </div>
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize", roleColors[u.role] ?? "bg-muted text-muted-foreground")}>
                {u.role}
              </span>
              {u.status === "invited" && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-warning/10 text-warning">
                  Pending
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -- API Keys Tab --
interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt?: string;
  scopes: string[];
}

function ApiKeysTab() {
  const { showToast } = useToast();
  const [showKey, setShowKey] = useState<string | null>(null);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<ApiKey[]>("/api/v1/tenant/api-keys")
      .then((res) => { if (!cancelled) setKeys(res.success ? (res.data ?? []) : []); })
      .catch(() => { if (!cancelled) setKeys([]); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const res = await apiClient.post<ApiKey>("/api/v1/tenant/api-keys", { name: newKeyName.trim() });
      if (res.success && res.data) {
        setKeys((prev) => [...prev, res.data!]);
        showToast("API key created.", "success");
        setNewKeyName("");
        setShowCreate(false);
      } else {
        showToast(res.error?.message ?? "Failed to create key.", "error");
      }
    } catch {
      showToast("Failed to create key.", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (keyId: string) => {
    try {
      const res = await apiClient.delete(`/api/v1/tenant/api-keys/${keyId}`);
      if (res.success) {
        setKeys((prev) => prev.filter((k) => k.id !== keyId));
        showToast("API key deleted.", "success");
      } else {
        showToast(res.error?.message ?? "Failed to delete key.", "error");
      }
    } catch {
      showToast("Failed to delete key.", "error");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-muted-foreground">{keys.length} API keys</span>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-2 px-3 py-2 bg-foreground text-background rounded-xl text-[12px] font-medium hover:bg-foreground/80"
        >
          <Plus className="w-3.5 h-3.5" />
          Create Key
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g. Production API)"
            className="flex-1 px-4 py-2 rounded-xl border border-border text-[13px] bg-background focus:border-ring outline-none"
          />
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 bg-foreground text-background rounded-xl text-[12px] font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Create
          </button>
        </form>
      )}

      {keys.length === 0 ? (
        <EmptyState title="No API keys" description="Create a key to access the ValueOS API." />
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div key={k.id} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Key className="w-4 h-4 text-muted-foreground/70" />
                  <span className="text-[13px] font-medium text-foreground">{k.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowKey(showKey === k.id ? null : k.id)}
                    className="p-1.5 rounded-lg hover:bg-muted"
                    aria-label={showKey === k.id ? "Hide key" : "Show key"}
                  >
                    {showKey === k.id
                      ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground/70" />
                      : <Eye className="w-3.5 h-3.5 text-muted-foreground/70" />}
                  </button>
                  <button
                    onClick={() => void navigator.clipboard.writeText(k.prefix)}
                    className="p-1.5 rounded-lg hover:bg-muted"
                    aria-label="Copy key prefix"
                  >
                    <Copy className="w-3.5 h-3.5 text-muted-foreground/70" />
                  </button>
                  <button
                    onClick={() => void handleDelete(k.id)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10"
                    aria-label="Delete key"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <code className="text-[12px] font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                  {showKey === k.id ? k.prefix : `${k.prefix}••••••••`}
                </code>
                <div className="flex gap-1">
                  {k.scopes.map((s) => (
                    <span key={s} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground">{s}</span>
                  ))}
                </div>
              </div>
              {k.lastUsedAt && (
                <p className="text-[11px] text-muted-foreground/70 mt-2">
                  Last used {new Date(k.lastUsedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -- Billing Tab --
function BillingTab() {
  const { data: billing, isLoading, error } = useBillingSummary();

  if (isLoading) {
    return (
      <div className="max-w-lg">
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !billing) {
    return <p className="text-[13px] text-destructive">{error?.message ?? "Failed to load billing."}</p>;
  }

  const { subscription, usage } = billing;

  return (
    <div className="max-w-lg space-y-6">
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="text-[13px] font-semibold text-foreground mb-3">Current Plan</h3>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xl font-black text-foreground">{subscription.currentPlan}</p>
            <p className="text-[12px] text-muted-foreground/70">
              ${(subscription.mrr / 100).toLocaleString()}/mo &middot; Renews {new Date(subscription.renewalDate).toLocaleDateString()}
            </p>
          </div>
          <span className={cn(
            "px-3 py-1 rounded-lg text-[12px] font-semibold",
            subscription.status === "active" ? "bg-success/10 text-success" : "bg-warning/10 text-warning",
          )}>
            {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
          </span>
        </div>
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-muted-foreground">AI Tokens</span>
            <span className="text-foreground/80 font-medium">
              {usage.aiTokens.used.toLocaleString()} / {usage.aiTokens.cap.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-muted-foreground">API Calls</span>
            <span className="text-foreground/80 font-medium">
              {usage.apiCalls.used.toLocaleString()} / {usage.apiCalls.cap.toLocaleString()}
            </span>
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-[13px] font-medium text-foreground/70 hover:bg-muted/50 w-full justify-center">
          <ExternalLink className="w-4 h-4" />
          Manage in Stripe
        </button>
      </div>
    </div>
  );
}

// -- Security Tab --
function SecurityTab() {
  const { showToast } = useToast();
  const [mfaRequired, setMfaRequired] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleToggleMfa = async () => {
    setSaving(true);
    const next = !mfaRequired;
    try {
      const res = await apiClient.patch("/api/v1/tenant/security", { mfaRequired: next });
      if (res.success) {
        setMfaRequired(next);
        showToast(`MFA ${next ? "enabled" : "disabled"} for all users.`, "success");
      } else {
        showToast(res.error?.message ?? "Failed to update security settings.", "error");
      }
    } catch {
      showToast("Failed to update security settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="text-[13px] font-semibold text-foreground mb-4">Authentication</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] text-foreground/70">Multi-Factor Authentication</p>
              <p className="text-[11px] text-muted-foreground/70">Require MFA for all users</p>
            </div>
            <button
              onClick={() => void handleToggleMfa()}
              disabled={saving}
              aria-pressed={mfaRequired}
              aria-label="Toggle MFA requirement"
              className={cn(
                "w-11 h-6 rounded-full relative transition-colors disabled:opacity-50",
                mfaRequired ? "bg-success" : "bg-muted",
              )}
            >
              <div className={cn(
                "w-5 h-5 bg-background rounded-full absolute top-0.5 shadow-sm transition-transform",
                mfaRequired ? "translate-x-5" : "translate-x-0.5",
              )} />
            </button>
          </div>
        </div>
      </div>
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="text-[13px] font-semibold text-foreground mb-3">Audit Log Access</h3>
        <p className="text-[12px] text-muted-foreground mb-3">Download audit logs for compliance review</p>
        <button className="px-4 py-2 border border-border rounded-xl text-[12px] font-medium text-foreground/70 hover:bg-muted/50">
          Export Audit Logs
        </button>
      </div>
    </div>
  );
}

// -- Company Context Tab --
function CompanyContextTab() {
  const [form, setForm] = useState({ products: "", icps: "", competitors: "", personas: "", websiteUrl: "" });
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await apiClient.post("/api/v1/tenant/context", {
        products: form.products.split(",").map((s) => s.trim()).filter(Boolean),
        icps: form.icps.split(",").map((s) => s.trim()).filter(Boolean),
        competitors: form.competitors.split(",").map((s) => s.trim()).filter(Boolean),
        personas: form.personas.split(",").map((s) => s.trim()).filter(Boolean),
        websiteUrl: form.websiteUrl || undefined,
      });
      if (response.success) {
        showToast("Company context saved.", "success");
      } else {
        showToast(response.error?.message ?? "Failed to save.", "error");
      }
    } catch {
      showToast("Failed to save.", "error");
    } finally {
      setSaving(false);
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
            <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/70 block mb-2">{label}</label>
            <input
              name={name}
              type={type ?? "text"}
              value={form[name]}
              onChange={handleChange}
              placeholder={placeholder}
              className="w-full px-4 py-2.5 rounded-xl border border-border text-[13px] bg-background focus:border-ring outline-none"
            />
          </div>
        ))}
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2.5 bg-foreground text-background rounded-xl text-[13px] font-medium hover:bg-foreground/80 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Save Changes
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
      <h1 className="text-2xl font-black text-foreground tracking-[-0.05em] mb-6">Settings</h1>

      <div className="flex gap-8">
        {/* Left nav */}
        <nav className="w-48 flex-shrink-0 space-y-1" aria-label="Settings navigation">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              aria-current={activeTab === tab.key ? "page" : undefined}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors text-left",
                activeTab === tab.key
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground/70",
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
