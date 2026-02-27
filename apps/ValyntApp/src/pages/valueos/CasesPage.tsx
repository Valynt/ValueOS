/**
 * CasesPage - Cases list view
 *
 * List all cases with filtering, sorting, and search.
 * Fetches real data from Supabase via useCasesList hook.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowUpDown,
  Grid,
  List,
  MoreHorizontal,
  Plus,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCasesList, usePortfolioValue } from "@/hooks/useCases";
import type { ValueCaseWithRelations } from "@/services/supabase/types";

type CaseStatus = "draft" | "in-progress" | "committed" | "closed" | "review" | "published";
type ViewMode = "grid" | "list";

interface CaseView {
  id: string;
  name: string;
  company: string;
  initials: string;
  value: string | null;
  status: CaseStatus;
  owner: string;
  updatedAt: string;
  createdAt: string;
}

/** Map a DB row to the UI shape. */
function toCaseView(row: ValueCaseWithRelations): CaseView {
  const company = row.company_profiles?.company_name ?? "Unknown";
  const initials = company
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const projectedValue = row.metadata?.projected_value as number | undefined;
  let value: string | null = null;
  if (projectedValue != null) {
    if (projectedValue >= 1_000_000) {
      value = `$${(projectedValue / 1_000_000).toFixed(1)}M`;
    } else if (projectedValue >= 1_000) {
      value = `$${(projectedValue / 1_000).toFixed(0)}K`;
    } else {
      value = `$${projectedValue.toFixed(0)}`;
    }
  }

  const statusMap: Record<string, CaseStatus> = {
    draft: "draft",
    review: "in-progress",
    published: "committed",
  };
  const status: CaseStatus = statusMap[row.status] ?? "draft";

  const updatedAt = row.updated_at
    ? formatRelativeTime(new Date(row.updated_at))
    : "Unknown";
  const createdAt = row.created_at
    ? new Date(row.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Unknown";

  return {
    id: row.id,
    name: row.name,
    company,
    initials,
    value,
    status,
    owner: (row.metadata?.owner_name as string) ?? "—",
    updatedAt,
    createdAt,
  };
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? "s" : ""} ago`;
}

function parseValue(value: string | null): number {
  if (!value) return 0;
  const num = parseFloat(value.replace(/[$MK,]/g, ""));
  const multiplier = value.includes("M")
    ? 1_000_000
    : value.includes("K")
      ? 1_000
      : 1;
  return num * multiplier;
}

const STATUS_CONFIG: Record<CaseStatus, { label: string; className: string }> = {
  draft: {
    label: "Draft",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
  "in-progress": {
    label: "In Progress",
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
  committed: {
    label: "Committed",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  closed: {
    label: "Closed",
    className: "bg-purple-100 text-purple-700 border-purple-200",
  },
  review: {
    label: "In Review",
    className: "bg-amber-100 text-amber-700 border-amber-200",
  },
  published: {
    label: "Published",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
};

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "in-progress", label: "In Progress" },
  { value: "committed", label: "Committed" },
  { value: "closed", label: "Closed" },
];

const SORT_OPTIONS = [
  { value: "updated", label: "Last Updated" },
  { value: "created", label: "Date Created" },
  { value: "name", label: "Name" },
  { value: "value", label: "Value" },
];

function CaseListSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="p-4">
          <div className="flex items-start justify-between mb-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-5 w-3/4 mb-1" />
          <Skeleton className="h-4 w-1/2 mb-3" />
          <Skeleton className="h-4 w-1/3 mb-3" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-12" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="text-center py-12">
      <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
      <h3 className="text-lg font-medium text-slate-900 mb-1">Failed to load cases</h3>
      <p className="text-sm text-slate-500 mb-4 max-w-md mx-auto">{error.message}</p>
      <Button variant="outline" onClick={onRetry}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Retry
      </Button>
    </div>
  );
}

export function CasesPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updated");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const { data: rawCases, isLoading, error, refetch } = useCasesList();
  const { data: portfolio } = usePortfolioValue();

  const cases = (rawCases ?? []).map(toCaseView);

  const filteredCases = cases.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.company.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const sortedCases = [...filteredCases].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.name.localeCompare(b.name);
      case "value":
        return parseValue(b.value) - parseValue(a.value);
      default:
        return 0;
    }
  });

  const stats = {
    total: cases.length,
    inProgress: cases.filter((c) => c.status === "in-progress" || c.status === "review").length,
    committed: cases.filter((c) => c.status === "committed" || c.status === "published").length,
    totalValue: portfolio?.totalValue ?? 0,
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cases</h1>
          <p className="text-slate-500 mt-1">
            {stats.total} cases • {stats.inProgress} in progress
            {stats.totalValue > 0 &&
              ` • $${(stats.totalValue / 1_000_000).toFixed(1)}M total value`}
          </p>
        </div>
        <Button onClick={() => navigate("/app/cases/new")}>
          <Plus className="h-4 w-4 mr-2" />
          New Case
        </Button>
      </div>

      {/* Filters Bar */}
      <Card className="mb-6 p-4">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="flex-1 max-w-sm">
            <SearchInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery("")}
              placeholder="Search cases..."
            />
          </div>

          {/* Status Filter */}
          <SimpleSelect
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={STATUS_OPTIONS}
          />

          {/* Sort */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <SimpleSelect
              value={sortBy}
              onValueChange={setSortBy}
              options={SORT_OPTIONS}
            />
          </div>

          {/* View Toggle */}
          <div className="flex items-center border rounded-md" role="group" aria-label="View mode">
            <button
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
              aria-pressed={viewMode === "grid"}
              className={cn(
                "p-2 transition-colors",
                viewMode === "grid"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Grid className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              aria-label="List view"
              aria-pressed={viewMode === "list"}
              className={cn(
                "p-2 transition-colors",
                viewMode === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <List className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </Card>

      {/* Loading State */}
      {isLoading && <CaseListSkeleton />}

      {/* Error State */}
      {error && !isLoading && (
        <ErrorState error={error as Error} onRetry={() => refetch()} />
      )}

      {/* Cases Grid/List */}
      {!isLoading && !error && (
        <>
          {viewMode === "grid" ? (
            <div className="grid grid-cols-3 gap-4">
              {sortedCases.map((caseItem) => (
                <CaseCard
                  key={caseItem.id}
                  caseData={caseItem}
                  onClick={() => navigate(`/app/cases/${caseItem.id}`)}
                />
              ))}
            </div>
          ) : (
            <Card className="overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-muted/50 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <div className="col-span-4">Case</div>
                <div className="col-span-2">Value</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Owner</div>
                <div className="col-span-2">Updated</div>
              </div>

              {/* Table Body */}
              <div className="divide-y">
                {sortedCases.map((caseItem) => (
                  <CaseRow
                    key={caseItem.id}
                    caseData={caseItem}
                    onClick={() => navigate(`/app/cases/${caseItem.id}`)}
                  />
                ))}
              </div>
            </Card>
          )}

          {/* Empty State */}
          {sortedCases.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No cases found</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface CaseCardProps {
  caseData: CaseView;
  onClick: () => void;
}

function CaseCard({ caseData, onClick }: CaseCardProps) {
  const statusConfig = STATUS_CONFIG[caseData.status] ?? STATUS_CONFIG.draft;

  return (
    <Card
      className="p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-medium text-slate-600 border border-slate-200">
          {caseData.initials}
        </div>
        <Badge className={cn("text-[10px] font-semibold uppercase", statusConfig.className)}>
          {statusConfig.label}
        </Badge>
      </div>

      <h2 className="font-semibold text-slate-900 mb-1">{caseData.name}</h2>
      <p className="text-sm text-muted-foreground mb-3">{caseData.company}</p>

      <div className="flex items-center gap-1 text-sm text-slate-500 mb-3">
        <TrendingUp size={14} />
        <span>{caseData.value ?? "—"}</span>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{caseData.updatedAt}</span>
        <span className="text-primary hover:underline">Open →</span>
      </div>
    </Card>
  );
}

interface CaseRowProps {
  caseData: CaseView;
  onClick: () => void;
}

function CaseRow({ caseData, onClick }: CaseRowProps) {
  const statusConfig = STATUS_CONFIG[caseData.status] ?? STATUS_CONFIG.draft;

  return (
    <div
      className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={onClick}
    >
      {/* Case Name & Company */}
      <div className="col-span-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-600 border border-slate-200">
          {caseData.initials}
        </div>
        <div>
          <p className="font-medium text-slate-900">{caseData.name}</p>
          <p className="text-sm text-muted-foreground">{caseData.company}</p>
        </div>
      </div>

      {/* Value */}
      <div className="col-span-2">
        <span className="font-medium">{caseData.value ?? "—"}</span>
      </div>

      {/* Status */}
      <div className="col-span-2">
        <Badge className={cn("text-[10px] font-semibold uppercase", statusConfig.className)}>
          {statusConfig.label}
        </Badge>
      </div>

      {/* Owner */}
      <div className="col-span-2 text-sm text-muted-foreground">
        {caseData.owner}
      </div>

      {/* Updated */}
      <div className="col-span-2 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{caseData.updatedAt}</span>
        <button
          className="p-1 text-muted-foreground hover:text-foreground rounded"
          onClick={(e) => e.stopPropagation()}
          aria-label={`More options for ${caseData.name}`}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default CasesPage;
