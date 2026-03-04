/*
 * VALYNT Cases Page — List of all value cases
 * Shows case cards with company, title, status, confidence, value, last updated
 * Matches reference: "RECENT CASES" with status badges
 */
import { useState } from "react";
import { Link } from "wouter";
import { Plus, Search, Filter, ArrowUpDown, LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { valueCases, formatCurrency } from "@/lib/data";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  running: "bg-emerald-100 text-emerald-700",
  committed: "bg-blue-100 text-blue-700",
  completed: "bg-purple-100 text-purple-700",
  draft: "bg-muted text-muted-foreground",
  paused: "bg-amber-100 text-amber-700",
};

export default function Cases() {
  const [view, setView] = useState<"grid" | "list">("list");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = valueCases.filter(
    (c) =>
      c.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.caseNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Value Cases</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">{valueCases.length} active cases across your organization</p>
        </div>
        <Button className="h-9 text-[13px] bg-foreground text-background hover:bg-foreground/90" onClick={() => { toast("New case wizard coming soon"); }}>
          <Plus className="w-4 h-4 mr-1.5" />
          New Case
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search cases..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-4 rounded-lg border border-input bg-background text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>
        <Button variant="outline" size="sm" className="h-9 text-[12px]">
          <Filter className="w-3.5 h-3.5 mr-1.5" />
          Filter
        </Button>
        <Button variant="outline" size="sm" className="h-9 text-[12px]">
          <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />
          Sort
        </Button>
        <div className="flex items-center border border-border rounded-lg overflow-hidden ml-auto">
          <button
            onClick={() => setView("list")}
            className={cn("w-9 h-9 flex items-center justify-center transition-colors", view === "list" ? "bg-accent" : "hover:bg-accent/50")}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView("grid")}
            className={cn("w-9 h-9 flex items-center justify-center transition-colors", view === "grid" ? "bg-accent" : "hover:bg-accent/50")}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Cases table */}
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Case</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Stage</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Confidence</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Value</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Updated</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                <td className="px-4 py-3.5">
                  <Link href={`/cases/${c.id}`}>
                    <div className="cursor-pointer">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground flex-shrink-0">
                          {c.company.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-foreground">{c.company}</p>
                          <p className="text-[11px] text-muted-foreground">{c.title}</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3.5">
                  <Badge className={cn("text-[10px] font-semibold capitalize", statusColors[c.status] || "bg-muted text-muted-foreground")}>
                    {c.status}
                  </Badge>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-[12px] text-muted-foreground capitalize">{c.currentStage}</span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          c.confidence >= 80 ? "bg-emerald-500" :
                          c.confidence >= 60 ? "bg-blue-500" : "bg-amber-500"
                        )}
                        style={{ width: `${c.confidence}%` }}
                      />
                    </div>
                    <span className="text-[12px] font-mono">{c.confidence}%</span>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <span className="text-[13px] font-semibold">{formatCurrency(c.totalValue)}</span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <span className="text-[12px] text-muted-foreground">{c.lastUpdated}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


