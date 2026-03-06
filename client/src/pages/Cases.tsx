/*
 * VALYNT Cases Page — List of all value cases
 * Refactored to use shared components: PageHeader, SearchToolbar, DataTable, StatusBadge, EmptyState.
 */
import { useState } from "react";
import { Link } from "wouter";
import { Plus, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { valueCases, formatCurrency, type ValueCase } from "@/lib/data";
import { NewCaseWizard } from "@/components/NewCaseWizard";
import { useSearch } from "@/hooks/useSearch";
import {
  PageHeader,
  SearchToolbar,
  DataTable,
  StatusBadge,
  EmptyState,
  type Column,
} from "@/components/shared";

const columns: Column[] = [
  { key: "case", label: "Case" },
  { key: "status", label: "Status" },
  { key: "stage", label: "Stage" },
  { key: "confidence", label: "Confidence", align: "right" },
  { key: "value", label: "Value", align: "right" },
  { key: "updated", label: "Updated", align: "right" },
];

export default function Cases() {
  const [view, setView] = useState<"list" | "grid">("list");
  const [wizardOpen, setWizardOpen] = useState(false);
  const { query, setQuery, filtered } = useSearch<ValueCase>(valueCases, ["company", "title", "caseNumber"]);

  return (
    <div className="p-8">
      {/* Header */}
      <PageHeader
        title="Value Cases"
        description={`${valueCases.length} active cases across your organization`}
        action={
          <Button
            className="h-10 text-sm bg-foreground text-background hover:bg-foreground/90"
            onClick={() => setWizardOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Value Case
          </Button>
        }
        className="mb-8"
      />

      {/* Toolbar */}
      <SearchToolbar
        value={query}
        onChange={setQuery}
        placeholder="Search cases..."
        showViewToggle
        view={view}
        onViewChange={setView}
        className="mb-6"
      />

      {/* Empty States */}
      {filtered.length === 0 && query ? (
        <EmptyState
          icon={Search}
          title={`No cases match "${query}"`}
          description="Try adjusting your search or create a new value case."
          action={
            <Button
              className="h-10 text-sm"
              onClick={() => { setQuery(""); setWizardOpen(true); }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Case
            </Button>
          }
        />
      ) : valueCases.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No value cases yet"
          description="Create your first value case to start building business cases with AI-powered enrichment, financial modeling, and integrity validation."
          action={
            <Button
              className="h-10 text-sm bg-foreground text-background hover:bg-foreground/90"
              onClick={() => setWizardOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Case
            </Button>
          }
          dashed
        />
      ) : (
        /* Cases Table */
        <DataTable
          columns={columns}
          data={filtered}
          renderRow={(c) => (
            <DataTable.Row key={c.id}>
              <DataTable.Cell>
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
              </DataTable.Cell>
              <DataTable.Cell>
                <StatusBadge type="status" value={c.status} />
              </DataTable.Cell>
              <DataTable.Cell>
                <span className="text-sm text-muted-foreground capitalize">{c.currentStage}</span>
              </DataTable.Cell>
              <DataTable.Cell align="right">
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
              </DataTable.Cell>
              <DataTable.Cell align="right">
                <span className="text-sm font-semibold">{formatCurrency(c.totalValue)}</span>
              </DataTable.Cell>
              <DataTable.Cell align="right">
                <span className="text-xs text-muted-foreground">{c.lastUpdated}</span>
              </DataTable.Cell>
            </DataTable.Row>
          )}
        />
      )}

      {/* New Case Wizard Dialog */}
      <NewCaseWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}
