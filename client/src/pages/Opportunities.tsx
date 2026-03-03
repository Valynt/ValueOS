/*
 * Design: Atelier — Refined Workspace Craft
 * Opportunities: Master-detail split view with filter bar
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Plus, Search, Filter, ArrowRight, Briefcase, Clock, User, ChevronRight, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { opportunities, valueCases, formatCurrency, formatDate, getStageColor, getStatusColor } from "@/lib/data";
import { toast } from "sonner";

export default function Opportunities() {
  const [selectedId, setSelectedId] = useState<string | null>(opportunities[0]?.id || null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return opportunities.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (search && !o.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [statusFilter, search]);

  const selected = opportunities.find((o) => o.id === selectedId);
  const selectedCases = valueCases.filter((vc) => vc.opportunityId === selectedId);

  const statuses = ["all", "open", "qualified", "in_progress", "won", "lost"];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 lg:px-8 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Opportunities</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage value opportunities across your workspace.</p>
        </div>
        <Button onClick={() => toast("Create Opportunity dialog coming soon")} className="gap-2">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Opportunity</span>
        </Button>
      </div>

      {/* Filter bar */}
      <div className="px-6 lg:px-8 pb-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 h-9 rounded-lg border bg-card flex-1 max-w-xs">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter opportunities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-md text-[12px] font-medium capitalize transition-colors",
                statusFilter === s
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s === "all" ? "All" : s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Master-Detail Split */}
      <div className="flex-1 flex overflow-hidden border-t">
        {/* Master list */}
        <div className="w-full lg:w-[420px] border-r overflow-y-auto bg-card">
          {filtered.map((opp) => (
            <button
              key={opp.id}
              onClick={() => setSelectedId(opp.id)}
              className={cn(
                "w-full text-left px-5 py-4 border-b transition-colors",
                selectedId === opp.id ? "bg-accent/50" : "hover:bg-muted/30"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-foreground truncate">{opp.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={cn("w-1.5 h-1.5 rounded-full", getStatusColor(opp.status))} />
                    <span className="text-[11px] text-muted-foreground capitalize">{opp.status.replace("_", " ")}</span>
                    <span className="text-[11px] text-muted-foreground">·</span>
                    <span className="text-[11px] text-muted-foreground">{opp.owner}</span>
                  </div>
                </div>
                <span className="text-[14px] font-semibold font-mono text-foreground whitespace-nowrap">
                  {formatCurrency(opp.valuePotential)}
                </span>
              </div>
              {opp.activeCaseStage && (
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className={cn("text-[9px] font-semibold uppercase", getStageColor(opp.activeCaseStage))}>
                    {opp.activeCaseStage}
                  </Badge>
                  {opp.activeCaseConfidence && (
                    <span className="text-[11px] font-mono text-muted-foreground">{opp.activeCaseConfidence}% confidence</span>
                  )}
                </div>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No opportunities match your filters.
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="hidden lg:flex flex-1 overflow-y-auto bg-background">
          {selected ? (
            <div className="flex-1 p-6 space-y-6 max-w-3xl">
              {/* Opportunity header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold tracking-tight">{selected.name}</h2>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-1.5">
                      <div className={cn("w-2 h-2 rounded-full", getStatusColor(selected.status))} />
                      <span className="text-[13px] capitalize text-muted-foreground">{selected.status.replace("_", " ")}</span>
                    </div>
                    <Separator orientation="vertical" className="h-4" />
                    <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                      <User className="w-3.5 h-3.5" />
                      {selected.owner}
                    </div>
                    <Separator orientation="vertical" className="h-4" />
                    <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDate(selected.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Value Potential</p>
                  <p className="text-2xl font-bold font-mono tracking-tight">{formatCurrency(selected.valuePotential)}</p>
                </div>
              </div>

              {selected.description && (
                <p className="text-[14px] text-muted-foreground leading-relaxed">{selected.description}</p>
              )}

              <Separator />

              {/* Value Cases */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[15px] font-semibold">Value Cases</h3>
                  <Button variant="outline" size="sm" onClick={() => toast("Start Value Case dialog coming soon")} className="gap-1.5 text-[12px]">
                    <Plus className="w-3.5 h-3.5" />
                    Start Value Case
                  </Button>
                </div>
                {selectedCases.length > 0 ? (
                  <div className="space-y-3">
                    {selectedCases.map((vc) => (
                      <Card key={vc.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={cn("w-2 h-2 rounded-full", getStatusColor(vc.status))} />
                              <div>
                                <p className="text-[14px] font-medium">{vc.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Badge variant="secondary" className={cn("text-[9px] font-semibold uppercase", getStageColor(vc.stage))}>
                                    {vc.stage}
                                  </Badge>
                                  <span className="text-[11px] text-muted-foreground capitalize">{vc.status}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <div className="flex items-center gap-2">
                                  <Progress value={vc.confidence} className="h-1.5 w-16" />
                                  <span className="text-[12px] font-mono text-muted-foreground">{vc.confidence}%</span>
                                </div>
                                <p className="text-[13px] font-semibold font-mono mt-0.5">{formatCurrency(vc.totalValue)}</p>
                              </div>
                              <Link href={`/opportunities/${selected.id}/cases/${vc.id}`}>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <ChevronRight className="w-4 h-4" />
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="p-8 text-center">
                      <Briefcase className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                      <p className="text-[14px] font-medium text-muted-foreground">No value cases yet</p>
                      <p className="text-[12px] text-muted-foreground mt-1">Start a value case to begin the lifecycle analysis.</p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => toast("Attach Model dialog coming soon")} className="text-[12px]">Attach Model</Button>
                <Button variant="outline" size="sm" onClick={() => toast("Run Agent dialog coming soon")} className="text-[12px]">Run Agent</Button>
                <Button variant="outline" size="sm" onClick={() => toast("Export feature coming soon")} className="text-[12px]">Export</Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <p className="text-sm">Select an opportunity to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
