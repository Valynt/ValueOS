/*
 * VALYNT Cases Page — List of all value cases
 * Includes empty state with CTA, standardized typography (12px+), hover states on rows
 */
import { useState } from "react";
import { Link } from "wouter";
import { Plus, Search, Filter, ArrowUpDown, LayoutGrid, List, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { valueCases, formatCurrency } from "@/lib/data";
import { NewCaseWizard } from "@/components/NewCaseWizard";

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
  const [wizardOpen, setWizardOpen] = useState(false);

  const filtered = valueCases.filter(
    (c) =>
      c.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.caseNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-foreground">Value Cases</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {valueCases.length} active cases across your organization
          </p>
        </div>
        <Button
          className="h-10 text-sm bg-foreground text-background hover:bg-foreground/90"
          onClick={() => setWizardOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Value Case
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search cases..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>
        <Button variant="outline" size="sm" className="h-10 text-sm">
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </Button>
        <Button variant="outline" size="sm" className="h-10 text-sm">
          <ArrowUpDown className="w-4 h-4 mr-2" />
          Sort
        </Button>
        <div className="flex items-center border border-border rounded-lg overflow-hidden ml-auto">
          <button
            onClick={() => setView("list")}
            className={cn("w-10 h-10 flex items-center justify-center transition-colors", view === "list" ? "bg-accent" : "hover:bg-accent/50")}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView("grid")}
            className={cn("w-10 h-10 flex items-center justify-center transition-colors", view === "grid" ? "bg-accent" : "hover:bg-accent/50")}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Empty State */}
      {filtered.length === 0 && searchQuery ? (
        <div className="border border-border rounded-xl p-12 bg-card text-center">
          <Search className="w-10 h-10 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-foreground">No cases match "{searchQuery}"</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Try adjusting your search or create a new value case.
          </p>
          <Button
            className="mt-6 h-10 text-sm"
            onClick={() => { setSearchQuery(""); setWizardOpen(true); }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New Case
          </Button>
        </div>
      ) : valueCases.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-16 bg-card text-center">
          <div className="w-16 h-16 rounded-2xl bg-foreground/5 flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-8 h-8 text-foreground/30" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">No value cases yet</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Create your first value case to start building business cases with AI-powered enrichment, financial modeling, and integrity validation.
          </p>
          <Button
            className="mt-8 h-10 text-sm bg-foreground text-background hover:bg-foreground/90"
            onClick={() => setWizardOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Case
          </Button>
        </div>
      ) : (
        /* Cases table */
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Case</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stage</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Confidence</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Value</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                  <td className="px-5 py-4">
                    <Link href={`/cases/${c.id}`}>
                      <div className="cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground flex-shrink-0">
                            {c.company.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{c.company}</p>
                            <p className="text-xs text-muted-foreground">{c.title}</p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    <Badge className={cn("text-xs font-semibold capitalize", statusColors[c.status] || "bg-muted text-muted-foreground")}>
                      {c.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-muted-foreground capitalize">{c.currentStage}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
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
                      <span className="text-xs font-mono">{c.confidence}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="text-sm font-semibold">{formatCurrency(c.totalValue)}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="text-xs text-muted-foreground">{c.lastUpdated}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Case Wizard Dialog */}
      <NewCaseWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}
