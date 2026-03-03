/*
 * VALYNT Integrations Page
 * Connection cards grouped by type, status indicators
 */
import { useState, useMemo } from "react";
import {
  Plug, Cloud, Database, FileText, Brain,
  RefreshCw, Settings, Clock, AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Integration {
  id: string;
  name: string;
  provider: string;
  type: "crm" | "ground_truth" | "comms" | "llm";
  connected: boolean;
  status: "healthy" | "degraded" | "error" | "disconnected";
  lastSync?: string;
  errorCount: number;
}

const integrations: Integration[] = [
  { id: "i1", name: "Salesforce", provider: "Salesforce Inc.", type: "crm", connected: true, status: "healthy", lastSync: "5m ago", errorCount: 0 },
  { id: "i2", name: "HubSpot", provider: "HubSpot Inc.", type: "crm", connected: false, status: "disconnected", errorCount: 0 },
  { id: "i3", name: "EDGAR / SEC", provider: "SEC.gov", type: "ground_truth", connected: true, status: "healthy", lastSync: "1h ago", errorCount: 0 },
  { id: "i4", name: "Gartner Research", provider: "Gartner Inc.", type: "ground_truth", connected: true, status: "healthy", lastSync: "2h ago", errorCount: 0 },
  { id: "i5", name: "Bloomberg", provider: "Bloomberg LP", type: "ground_truth", connected: true, status: "degraded", lastSync: "6h ago", errorCount: 2 },
  { id: "i6", name: "Slack", provider: "Salesforce", type: "comms", connected: true, status: "healthy", lastSync: "2m ago", errorCount: 0 },
  { id: "i7", name: "Microsoft Teams", provider: "Microsoft", type: "comms", connected: false, status: "disconnected", errorCount: 0 },
  { id: "i8", name: "OpenAI GPT-4o", provider: "OpenAI", type: "llm", connected: true, status: "healthy", lastSync: "Just now", errorCount: 0 },
  { id: "i9", name: "Anthropic Claude", provider: "Anthropic", type: "llm", connected: true, status: "healthy", lastSync: "30s ago", errorCount: 0 },
];

const typeLabels: Record<string, string> = {
  crm: "CRM & Sales",
  comms: "Communication",
  ground_truth: "Ground Truth & Data",
  llm: "AI & LLM Providers",
};

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  crm: Cloud,
  ground_truth: Database,
  comms: FileText,
  llm: Brain,
};

export default function Integrations() {
  const [typeFilter, setTypeFilter] = useState("all");

  const types = useMemo(() => {
    const t = new Set(integrations.map((i) => i.type));
    return ["all", ...Array.from(t)];
  }, []);

  const filtered = useMemo(() => {
    if (typeFilter === "all") return integrations;
    return integrations.filter((i) => i.type === typeFilter);
  }, [typeFilter]);

  const grouped = useMemo(() => {
    const groups: Record<string, Integration[]> = {};
    filtered.forEach((i) => {
      if (!groups[i.type]) groups[i.type] = [];
      groups[i.type].push(i);
    });
    return groups;
  }, [filtered]);

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Integrations</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Connect your data sources, CRM, communication tools, and AI providers.
          </p>
        </div>
        <Button variant="outline" onClick={() => toast("Browse marketplace coming soon")} className="gap-2 h-9 text-[13px]">
          <Plug className="w-4 h-4" />
          Browse Marketplace
        </Button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5 w-fit">
        {types.map((t) => (
          <button
            key={t as string}
            onClick={() => setTypeFilter(t as string)}
            className={cn(
              "px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors whitespace-nowrap",
              typeFilter === t
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "all" ? "All" : typeLabels[t as string] || (t as string)}
          </button>
        ))}
      </div>

      {/* Grouped Cards */}
      {Object.entries(grouped).map(([type, items]) => (
        <div key={type}>
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            {typeLabels[type] || type}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((integration) => {
              const IconComp = typeIcons[integration.type] || Plug;
              return (
                <Card key={integration.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          integration.connected ? "bg-emerald-50" : "bg-muted"
                        )}>
                          <IconComp className={cn("w-5 h-5", integration.connected ? "text-emerald-600" : "text-muted-foreground")} />
                        </div>
                        <div>
                          <p className="text-[14px] font-semibold">{integration.name}</p>
                          <p className="text-[11px] text-muted-foreground">{integration.provider}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          integration.status === "healthy" ? "bg-emerald-500" :
                          integration.status === "degraded" ? "bg-amber-500" :
                          integration.status === "error" ? "bg-red-500" :
                          "bg-zinc-300"
                        )} />
                        <span className={cn(
                          "text-[11px] font-medium capitalize",
                          integration.status === "healthy" ? "text-emerald-600" :
                          integration.status === "degraded" ? "text-amber-600" :
                          integration.status === "error" ? "text-red-500" :
                          "text-muted-foreground"
                        )}>
                          {integration.status}
                        </span>
                      </div>
                    </div>

                    {integration.connected && (
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-3">
                        {integration.lastSync && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Synced {integration.lastSync}
                          </span>
                        )}
                        {integration.errorCount > 0 && (
                          <span className="flex items-center gap-1 text-amber-600">
                            <AlertTriangle className="w-3 h-3" />
                            {integration.errorCount} errors
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2">
                      {integration.connected ? (
                        <>
                          <Button variant="outline" size="sm" className="flex-1 text-[11px] h-8" onClick={() => toast("Sync triggered")}>
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Sync Now
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => toast("Settings coming soon")}>
                            <Settings className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" className="flex-1 text-[11px] h-8" onClick={() => toast("Connect dialog coming soon")}>
                          <Plug className="w-3 h-3 mr-1" />
                          Connect
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
