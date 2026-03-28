import { Building2, CreditCard, Key, Plus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { apiClient } from "@/api/client/unified-api-client";
import { useToast } from "@/components/common/Toast";
import { useTenant } from "@/contexts/TenantContext";
import { useTeam } from "@/features/team";
import { useBillingSummary } from "@/hooks";
import { cn } from "@/lib/utils";

const tabs = [
  { key: "org", label: "Organization", icon: Building2 },
  { key: "users", label: "Users & Roles", icon: Users },
  { key: "api-keys", label: "API Keys", icon: Key },
  { key: "billing", label: "Billing", icon: CreditCard },
] as const;

type TabKey = (typeof tabs)[number]["key"];

function SkeletonRows({ count = 3 }: { count?: number }) {
  return <div className="space-y-2">{Array.from({ length: count }).map((_, i) => <div key={i} className="h-12 bg-muted animate-pulse rounded-xl" />)}</div>;
}

function OrgTab() {
  const { currentTenant } = useTenant();
  const { success, error } = useToast();
  const [name, setName] = useState(currentTenant?.name ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => setName(currentTenant?.name ?? ""), [currentTenant?.name]);

  const onSave = async () => {
    if (!currentTenant) return;
    setSaving(true);
    try {
      const res = await apiClient.patch(`/api/tenants/${currentTenant.id}`, { name });
      if (!res.success) throw new Error(res.error?.message ?? "Failed to save");
      success("Organization settings saved.");
    } catch {
      error("Failed to save organization settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg space-y-4">
      <label className="text-xs text-muted-foreground">Organization Name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground" />
      <button type="button" onClick={() => void onSave()} disabled={saving} className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
    </div>
  );
}

function UsersTab() {
  const { members, invites, isLoading, inviteMember, isInviting } = useTeam();
  const { success, error } = useToast();

  const onInvite = () => {
    const email = window.prompt("Invite email");
    if (!email) return;
    inviteMember(
      { email, role: "member" },
      {
        onSuccess: () => success("Invitation sent."),
        onError: () => error("Failed to invite teammate."),
      },
    );
  };

  if (isLoading) return <SkeletonRows />;
  if (members.length === 0 && invites.length === 0) {
    return <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">No team members yet.</div>;
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={onInvite} disabled={isInviting} className="inline-flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-medium"><Plus className="w-3.5 h-3.5" />Invite User</button>
      <div className="space-y-2">
        {members.map((u) => (
          <div key={u.id} className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{u.name || u.email}</p>
              <p className="text-xs text-muted-foreground">{u.email}</p>
            </div>
            <span className="text-xs text-muted-foreground capitalize">{u.role}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ApiKeyRow { id: string; name: string; prefix: string; lastUsedAt?: string }
function ApiKeysTab() {
  const { error, success } = useToast();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const res = await apiClient.get<{ keys: ApiKeyRow[] }>("/api/settings/api-keys");
        if (!cancelled) setKeys(res.data?.keys ?? []);
      } catch {
        if (!cancelled) {
          setKeys([]);
          error("Could not load API keys.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => { cancelled = true; };
  }, [error]);

  const onCreate = async () => {
    try {
      const res = await apiClient.post<ApiKeyRow>("/api/settings/api-keys", { name: "New Key" });
      if (!res.success || !res.data) throw new Error();
      setKeys((prev) => [res.data as ApiKeyRow, ...prev]);
      success("API key created.");
    } catch {
      error("Failed to create API key.");
    }
  };

  if (loading) return <SkeletonRows />;
  return (
    <div className="space-y-4">
      <button type="button" onClick={() => void onCreate()} className="inline-flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-medium"><Plus className="w-3.5 h-3.5" />Create Key</button>
      {keys.length === 0 ? <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">No API keys created.</div> : (
        <div className="space-y-2">{keys.map((k) => <div key={k.id} className="bg-card border border-border rounded-2xl p-4"><p className="text-sm font-medium text-foreground">{k.name}</p><p className="text-xs text-muted-foreground font-mono">{k.prefix}********</p></div>)}</div>
      )}
    </div>
  );
}

function BillingTab() {
  const { data, isLoading } = useBillingSummary();
  if (isLoading) return <SkeletonRows count={2} />;
  if (!data) return <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">No billing summary available.</div>;
  return (
    <div className="max-w-lg rounded-2xl border border-border bg-card p-5 space-y-2">
      <p className="text-sm font-semibold text-foreground">{data.currentPlan?.name ?? "Current plan"}</p>
      <p className="text-xs text-muted-foreground">Status: {data.status}</p>
      <p className="text-xs text-muted-foreground">Monthly spend: ${data.monthlySpend?.toLocaleString?.() ?? 0}</p>
    </div>
  );
}

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("org");
  const tabContent = useMemo<Record<TabKey, React.ReactNode>>(() => ({ org: <OrgTab />, users: <UsersTab />, "api-keys": <ApiKeysTab />, billing: <BillingTab /> }), []);

  return (
    <div className="p-6 lg:p-10 max-w-[1200px] mx-auto">
      <h1 className="text-2xl font-black text-foreground tracking-[-0.05em] mb-6">Settings</h1>
      <div className="flex gap-8">
        <nav className="w-48 flex-shrink-0 space-y-1" aria-label="Settings navigation">
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} type="button" className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors text-left", activeTab === tab.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              <tab.icon className="w-[18px] h-[18px]" aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="flex-1 min-w-0">{tabContent[activeTab]}</div>
      </div>
    </div>
  );
}
