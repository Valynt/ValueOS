/*
 * Design: Atelier — Refined Workspace Craft
 * Value Models: Card grid with category filters, model detail drawer
 */
import { useState, useMemo } from "react";
import { Plus, Search, Boxes, FileText, BarChart3, Tag, Clock, Users, Archive, CheckCircle2, Edit } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { valueModels, kpis, formatDate, getStatusColor } from "@/lib/data";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export default function Models() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const cats = new Set(valueModels.map((m) => m.category));
    return ["all", ...Array.from(cats)];
  }, []);

  const filtered = useMemo(() => {
    return valueModels.filter((m) => {
      if (categoryFilter !== "all" && m.category !== categoryFilter) return false;
      if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [categoryFilter, search]);

  const selectedModel = valueModels.find((m) => m.id === selectedModelId);
  const modelKpis = kpis.filter((k) => k.modelId === selectedModelId);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Value Models</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Reusable financial models and KPI templates for value engineering.
          </p>
        </div>
        <Button onClick={() => toast("Create Model dialog coming soon")} className="gap-2">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Model</span>
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 h-9 rounded-lg border bg-card flex-1 max-w-xs">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                "px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors whitespace-nowrap",
                categoryFilter === cat
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {cat === "all" ? "All" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Model Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((model) => (
          <Card
            key={model.id}
            className="hover:shadow-md transition-all cursor-pointer group"
            onClick={() => setSelectedModelId(model.id)}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Boxes className="w-5 h-5 text-primary" />
                </div>
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-[10px] font-semibold capitalize",
                    model.status === "active" ? "bg-emerald-50 text-emerald-700" :
                    model.status === "draft" ? "bg-amber-50 text-amber-700" :
                    "bg-zinc-100 text-zinc-500"
                  )}
                >
                  {model.status}
                </Badge>
              </div>

              <h3 className="text-[15px] font-semibold group-hover:text-primary transition-colors">{model.name}</h3>
              <p className="text-[12px] text-muted-foreground mt-1 line-clamp-2">{model.description}</p>

              <Separator className="my-3" />

              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" />
                    {model.kpiCount} KPIs
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {model.usedByCount} cases
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  v{model.version}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Boxes className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-[14px] font-medium text-muted-foreground">No models found</p>
          <p className="text-[12px] text-muted-foreground mt-1">Try adjusting your search or filters.</p>
        </div>
      )}

      {/* Model Detail Sheet */}
      <Sheet open={!!selectedModelId} onOpenChange={(open) => !open && setSelectedModelId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0 gap-0">
          {selectedModel && (
            <>
              <SheetHeader className="px-6 py-5 border-b">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Boxes className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <SheetTitle className="text-[16px]">{selectedModel.name}</SheetTitle>
                    <SheetDescription className="text-[12px]">
                      v{selectedModel.version} · {selectedModel.category}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                <p className="text-[13px] text-muted-foreground leading-relaxed">{selectedModel.description}</p>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-xl font-bold">{selectedModel.kpiCount}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">KPIs</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-xl font-bold">{selectedModel.usedByCount}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">Cases</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-xl font-bold">v{selectedModel.version}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">Version</p>
                  </div>
                </div>

                <Separator />

                {/* KPIs */}
                <div>
                  <h4 className="text-[13px] font-semibold mb-3">Key Performance Indicators</h4>
                  {modelKpis.length > 0 ? (
                    <div className="space-y-2">
                      {modelKpis.map((kpi) => (
                        <div key={kpi.id} className="p-3 rounded-lg border">
                          <div className="flex items-center justify-between">
                            <p className="text-[13px] font-medium">{kpi.name}</p>
                            <Badge variant="secondary" className="text-[9px]">{kpi.category}</Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground font-mono mt-1">{kpi.formula}</p>
                          <div className="flex items-center gap-4 mt-2 text-[11px]">
                            <span className="text-muted-foreground">Baseline: <span className="font-mono font-medium text-foreground">{kpi.baseline.toLocaleString()} {kpi.unit}</span></span>
                            <span className="text-muted-foreground">Target: <span className="font-mono font-medium text-emerald-600">{kpi.target.toLocaleString()} {kpi.unit}</span></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-muted-foreground">No KPIs defined for this model yet.</p>
                  )}
                </div>

                <Separator />

                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  Last updated {formatDate(selectedModel.lastUpdated)}
                </div>
              </div>

              <div className="px-6 py-4 border-t flex gap-2">
                <Button className="flex-1 gap-2" onClick={() => toast("Edit model coming soon")}>
                  <Edit className="w-4 h-4" />
                  Edit Model
                </Button>
                <Button variant="outline" onClick={() => toast("Clone model coming soon")}>Clone</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
