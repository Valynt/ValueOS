/*
 * Design: Atelier — Refined Workspace Craft
 * Integrations: Connection cards grouped by type, status indicators
 */
import { useState, useMemo } from "react";
import {
  Plug, Cloud, CircleDot, Hash, Wrench, Folder, FileText,
  TrendingUp, Cpu, CheckCircle2, AlertTriangle, XCircle,
  RefreshCw, Settings, ExternalLink, Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { integrations, timeAgo } from "@/lib/data";
import { toast } from "sonner";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  cloud: Cloud,
  "circle-dot": CircleDot,
  hash: Hash,
  wrench: Wrench,
  folder: Folder,
  "file-text": FileText,
  "trending-up": TrendingUp,
  cpu: Cpu,
};

const typeLabels: Record<string, string> = {
  crm: "CRM & Sales",
  comms: "Communication & Collaboration",
  ground_truth: "Ground Truth & Data",
  llm: "AI & LLM Providers",
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
    const groups: Record<string, typeof integrations> = {};
    filtered.forEach((i) => {
      if (!groups[i.type]) groups[i.type] = [];
      groups[i.type].push(i);
    });
    return groups;
  }, [filtered]);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Connect your data sources, CRM, communication tools, and AI providers.
          </p>
        </div>
        <Button variant="outline" onClick={() => toast("Browse marketplace coming soon")} className="gap-2">
          <Plug className="w-4 h-4" />
          Browse Marketplace
        </Button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5 w-fit">
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={cn(
              "px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors whitespace-nowrap",
              typeFilter === t
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "all" ? "All" : typeLabels[t] || t}
          </button>
        ))}
      </div>

      {/* Grouped Cards */}
      {Object.entries(grouped).map(([type, items]) => (
        <div key={type}>
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            {typeLabels[type] || type}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((integration) => {
              const IconComp = iconMap[integration.icon] || Plug;
              return (
                <Card key={integration.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          integration.connected ? "bg-primary/10" : "bg-muted"
                        )}>
                          <IconComp className={cn("w-5 h-5", integration.connected ? "text-primary" : "text-muted-foreground")} />
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
                            Synced {timeAgo(integration.lastSync)}
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
