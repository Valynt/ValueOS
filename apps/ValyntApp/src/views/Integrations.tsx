import { AlertTriangle, CheckCircle2, RefreshCw, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

interface Integration {
  name: string;
  category: string;
  description: string;
  status: "connected" | "disconnected" | "error";
  lastSync?: string;
  errorCount?: number;
  icon: string;
}

const integrations: Integration[] = [
  { name: "Salesforce", category: "CRM", description: "Bi-directional opportunity and account sync", status: "connected", lastSync: "5m ago", icon: "SF" },
  { name: "HubSpot", category: "CRM", description: "Contact and deal pipeline sync", status: "disconnected", icon: "HS" },
  { name: "Slack", category: "Communications", description: "Agent notifications and checkpoint alerts", status: "connected", lastSync: "1m ago", icon: "SL" },
  { name: "ServiceNow", category: "Communications", description: "Ticket creation and status tracking", status: "disconnected", icon: "SN" },
  { name: "SharePoint", category: "Communications", description: "Document storage and artifact sharing", status: "error", errorCount: 3, lastSync: "2h ago", icon: "SP" },
  { name: "EDGAR / XBRL", category: "Ground Truth", description: "SEC filings and financial data (always-on)", status: "connected", lastSync: "Real-time", icon: "ED" },
  { name: "Market Data", category: "Ground Truth", description: "Industry benchmarks and market intelligence", status: "connected", lastSync: "15m ago", icon: "MD" },
  { name: "Together.ai", category: "LLM Gateway", description: "Primary LLM inference provider", status: "connected", lastSync: "Active", icon: "TG" },
  { name: "Stripe", category: "Billing", description: "Subscription management and usage metering", status: "connected", lastSync: "Real-time", icon: "ST" },
];

const statusConfig = {
  connected: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", label: "Connected" },
  disconnected: { icon: XCircle, color: "text-muted-foreground", bg: "bg-muted", label: "Not Connected" },
  error: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", label: "Error" },
};

const categories = ["CRM", "Communications", "Ground Truth", "LLM Gateway", "Billing"];

export default function Integrations() {
  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-black text-zinc-950 tracking-[-0.05em]">Integrations</h1>
        <p className="text-[13px] text-muted-foreground mt-1">Connect external systems and monitor sync health</p>
      </div>

      {categories.map((cat) => {
        const items = integrations.filter((i) => i.category === cat);
        if (items.length === 0) return null;
        return (
          <div key={cat}>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">{cat}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((integration) => {
                const st = statusConfig[integration.status];
                const StIcon = st.icon;
                return (
                  <div
                    key={integration.name}
                    className="bg-card border border-border rounded-3xl p-6 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] hover:border-border transition-all"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center text-[12px] font-black",
                          integration.status === "connected" ? "bg-background text-white" : "bg-muted text-muted-foreground"
                        )}>
                          {integration.icon}
                        </div>
                        <div>
                          <h3 className="text-[14px] font-semibold text-foreground">{integration.name}</h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <StIcon className={cn("w-3 h-3", st.color)} />
                            <span className={cn("text-[11px] font-medium", st.color)}>{st.label}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="text-[12px] text-muted-foreground mb-4 leading-relaxed">{integration.description}</p>

                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <div>
                        {integration.lastSync && (
                          <span className="text-[11px] text-muted-foreground">
                            Last sync: {integration.lastSync}
                          </span>
                        )}
                        {integration.errorCount && (
                          <span className="text-[11px] text-red-500 ml-2">
                            {integration.errorCount} errors
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        {integration.status === "connected" && (
                          <button className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        )}
                        <button
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors",
                            integration.status === "disconnected"
                              ? "bg-background text-white hover:bg-surface-elevated"
                              : "border border-border text-muted-foreground hover:bg-surface"
                          )}
                        >
                          {integration.status === "disconnected" ? "Connect" : "Configure"}
                        </button>
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
