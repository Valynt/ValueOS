import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  Wrench,
  XCircle,
} from "lucide-react";

import { api } from "@/api/client/unified-api-client";
import { cn } from "@/lib/utils";

type HealthState = "connected" | "degraded" | "disconnected" | "error";
type IntegrationProvider = "hubspot" | "salesforce" | "servicenow" | "sharepoint" | "slack";
type CapabilityKey = "oauth" | "webhookSupport" | "deltaSync" | "manualSync" | "fieldMapping" | "backfill";
type IntegrationCapabilities = Record<CapabilityKey, boolean>;

interface IntegrationIncident {
  id: string;
  kind: "incident" | "recovery";
  timestamp: string;
  summary: string;
}

interface IntegrationCard {
  provider: IntegrationProvider;
  name: string;
  category: string;
  description: string;
  status: HealthState;
  healthBadge: "healthy" | "degraded" | "critical" | "disconnected";
  lastSync?: string;
  errorCount?: number;
  icon: string;
  remediationHints?: string[];
  timeline?: IntegrationIncident[];
}

interface CapabilityRegistryEntry {
  provider: IntegrationProvider;
  displayName: string;
  capabilities: IntegrationCapabilities;
}

const integrations: IntegrationCard[] = [
  {
    provider: "salesforce",
    name: "Salesforce",
    category: "CRM",
    description: "Bi-directional opportunity and account sync",
    status: "connected",
    healthBadge: "healthy",
    lastSync: "5m ago",
    icon: "SF",
    timeline: [
      { id: "sf-r-1", kind: "recovery", timestamp: "2h ago", summary: "Recovered from webhook timeout incident" },
      { id: "sf-i-1", kind: "incident", timestamp: "3h ago", summary: "Spike in consecutive webhook failures" },
    ],
    remediationHints: ["No action required. Continue monitoring webhook latency."],
  },
  {
    provider: "hubspot",
    name: "HubSpot",
    category: "CRM",
    description: "Contact and deal pipeline sync",
    status: "degraded",
    healthBadge: "degraded",
    lastSync: "38m ago",
    errorCount: 4,
    icon: "HS",
    timeline: [
      { id: "hs-i-2", kind: "incident", timestamp: "12m ago", summary: "OAuth token expiring soon" },
      { id: "hs-i-1", kind: "incident", timestamp: "42m ago", summary: "Failed webhook processing retries" },
    ],
    remediationHints: [
      "Reconnect OAuth credentials to refresh the expiring token.",
      "Validate HubSpot webhook signature secret in integration settings.",
    ],
  },
  {
    provider: "slack",
    name: "Slack",
    category: "Communications",
    description: "Agent notifications and checkpoint alerts",
    status: "connected",
    healthBadge: "healthy",
    lastSync: "1m ago",
    icon: "SL",
  },
  {
    provider: "servicenow",
    name: "ServiceNow",
    category: "Communications",
    description: "Ticket creation and status tracking",
    status: "disconnected",
    healthBadge: "disconnected",
    icon: "SN",
  },
  {
    provider: "sharepoint",
    name: "SharePoint",
    category: "Communications",
    description: "Document storage and artifact sharing",
    status: "error",
    healthBadge: "critical",
    errorCount: 3,
    lastSync: "2h ago",
    icon: "SP",
    timeline: [{ id: "sp-i-1", kind: "incident", timestamp: "2h ago", summary: "Connector API rate limit exceeded" }],
    remediationHints: [
      "Reduce polling frequency to remain within Microsoft API quotas.",
      "Retry the connection after the current quota window resets.",
    ],
  },
];

const fallbackCapabilityRegistry: CapabilityRegistryEntry[] = [
  {
    provider: "hubspot",
    displayName: "HubSpot",
    capabilities: { oauth: true, webhookSupport: true, deltaSync: true, manualSync: true, fieldMapping: true, backfill: true },
  },
  {
    provider: "salesforce",
    displayName: "Salesforce",
    capabilities: { oauth: true, webhookSupport: true, deltaSync: true, manualSync: true, fieldMapping: true, backfill: true },
  },
  {
    provider: "servicenow",
    displayName: "ServiceNow",
    capabilities: { oauth: true, webhookSupport: true, deltaSync: true, manualSync: true, fieldMapping: true, backfill: false },
  },
  {
    provider: "sharepoint",
    displayName: "SharePoint",
    capabilities: { oauth: true, webhookSupport: false, deltaSync: true, manualSync: true, fieldMapping: false, backfill: false },
  },
  {
    provider: "slack",
    displayName: "Slack",
    capabilities: { oauth: true, webhookSupport: true, deltaSync: false, manualSync: true, fieldMapping: false, backfill: false },
  },
];

const statusConfig = {
  connected: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", label: "Connected" },
  degraded: { icon: Clock3, color: "text-amber-600", bg: "bg-amber-50", label: "Degraded" },
  disconnected: { icon: XCircle, color: "text-zinc-400", bg: "bg-zinc-100", label: "Not Connected" },
  error: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", label: "Error" },
} as const;

const healthBadgeConfig = {
  healthy: "bg-emerald-100 text-emerald-700 border-emerald-200",
  degraded: "bg-amber-100 text-amber-700 border-amber-200",
  critical: "bg-red-100 text-red-700 border-red-200",
  disconnected: "bg-zinc-100 text-zinc-500 border-zinc-200",
} as const;

const categories = ["CRM", "Communications"];

const actionLabels: Record<CapabilityKey, string> = {
  oauth: "Connect",
  webhookSupport: "Configure webhooks",
  deltaSync: "Delta sync",
  manualSync: "Sync now",
  fieldMapping: "Field mapping",
  backfill: "Run backfill",
};

const capabilityDisabledReason: Record<CapabilityKey, string> = {
  oauth: "This provider does not support OAuth in ValueOS yet.",
  webhookSupport: "Webhook subscriptions are not available for this provider.",
  deltaSync: "Delta sync is not available for this provider.",
  manualSync: "Manual sync is not available for this provider.",
  fieldMapping: "Field mapping is not supported for this provider.",
  backfill: "Backfill is not supported for this provider.",
};

function actionBlockedByStatus(action: CapabilityKey, status: HealthState): string | null {
  if (action === "oauth" && status !== "disconnected") {
    return "Already connected. Use Configure actions instead.";
  }
  if (action !== "oauth" && status === "disconnected") {
    return "Connect this integration first to enable this action.";
  }
  return null;
}

export function Integrations() {
  const [capabilityRegistry, setCapabilityRegistry] = useState<CapabilityRegistryEntry[]>(fallbackCapabilityRegistry);

  useEffect(() => {
    const loadCapabilities = async () => {
      try {
        const response = await api.getIntegrationCapabilities() as { providers?: CapabilityRegistryEntry[] };
        if (Array.isArray(response.providers) && response.providers.length > 0) {
          setCapabilityRegistry(response.providers);
        }
      } catch {
        // Fall back to static registry when the API endpoint is unavailable.
      }
    };

    void loadCapabilities();
  }, []);

  const capabilitiesByProvider = useMemo(
    () => new Map(capabilityRegistry.map((entry) => [entry.provider, entry.capabilities])),
    [capabilityRegistry]
  );

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-black text-zinc-950 tracking-[-0.05em]">Integrations</h1>
        <p className="text-[13px] text-zinc-400 mt-1">Connect external systems and monitor sync health</p>
      </div>

      {categories.map((cat) => {
        const items = integrations.filter((integration) => integration.category === cat);
        if (items.length === 0) return null;
        return (
          <div key={cat}>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 mb-4">{cat}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((integration) => {
                const st = statusConfig[integration.status];
                const StIcon = st.icon;
                const providerCapabilities = capabilitiesByProvider.get(integration.provider);
                const supportedActions = (Object.keys(actionLabels) as CapabilityKey[])
                  .filter((action) => providerCapabilities?.[action]);
                const unsupportedActions = (Object.keys(actionLabels) as CapabilityKey[])
                  .filter((action) => !providerCapabilities?.[action]);

                return (
                  <div
                    key={integration.name}
                    className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] hover:border-zinc-300 transition-all"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center text-[12px] font-black",
                            integration.status === "connected" ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-400"
                          )}
                        >
                          {integration.icon}
                        </div>
                        <div>
                          <h3 className="text-[14px] font-semibold text-zinc-900">{integration.name}</h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <StIcon className={cn("w-3 h-3", st.color)} />
                            <span className={cn("text-[11px] font-medium", st.color)}>{st.label}</span>
                          </div>
                        </div>
                      </div>
                      <span className={cn("text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full border", healthBadgeConfig[integration.healthBadge])}>
                        {integration.healthBadge}
                      </span>
                    </div>

                    <p className="text-[12px] text-zinc-500 mb-3 leading-relaxed">{integration.description}</p>

                    {integration.timeline && integration.timeline.length > 0 && (
                      <div className="mb-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500 mb-2">Recent health timeline</div>
                        <ul className="space-y-1.5">
                          {integration.timeline.slice(0, 3).map((event) => (
                            <li key={event.id} className="text-[11px] text-zinc-600 flex items-start gap-1.5">
                              {event.kind === "incident" ? (
                                <ShieldAlert className="w-3 h-3 text-red-500 mt-[2px]" />
                              ) : (
                                <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-[2px]" />
                              )}
                              <span>
                                <span className="font-medium">{event.timestamp}:</span> {event.summary}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {integration.remediationHints && integration.remediationHints.length > 0 && (
                      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-700 mb-2 flex items-center gap-1">
                          <Wrench className="w-3 h-3" />
                          Remediation hints
                        </div>
                        <ul className="space-y-1">
                          {integration.remediationHints.slice(0, 2).map((hint) => (
                            <li key={hint} className="text-[11px] text-amber-800 leading-relaxed">• {hint}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500 mb-2 flex items-center gap-1">
                        <SlidersHorizontal className="w-3 h-3" />
                        Actions by capability
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {supportedActions.map((action) => {
                          const statusDisabledReason = actionBlockedByStatus(action, integration.status);
                          const isDisabled = statusDisabledReason !== null;
                          return (
                            <button
                              key={`${integration.provider}-${action}`}
                              disabled={isDisabled}
                              className={cn(
                                "px-2.5 py-1.5 rounded-lg text-[11px] border transition-colors",
                                isDisabled
                                  ? "border-zinc-200 text-zinc-400 bg-zinc-100 cursor-not-allowed"
                                  : "border-zinc-200 text-zinc-700 bg-white hover:bg-zinc-100"
                              )}
                              title={statusDisabledReason ?? undefined}
                            >
                              {action === "manualSync" && <RefreshCw className="w-3 h-3 inline mr-1" />}
                              {actionLabels[action]}
                            </button>
                          );
                        })}
                      </div>
                      {unsupportedActions.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {unsupportedActions.map((action) => (
                            <li key={`${integration.provider}-${action}-unsupported`} className="text-[10px] text-zinc-400">
                              {actionLabels[action]}: {capabilityDisabledReason[action]}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
                      <div>
                        {integration.lastSync && <span className="text-[11px] text-zinc-400">Last sync: {integration.lastSync}</span>}
                        {integration.errorCount && <span className="text-[11px] text-red-500 ml-2">{integration.errorCount} errors</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
