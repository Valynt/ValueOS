/**
 * CasesPage - Cases list view
 * 
 * List all cases with filtering, sorting, and search.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Grid,
  List,
  TrendingUp,
  MoreHorizontal,
  ArrowUpDown,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type CaseStatus = "draft" | "in-progress" | "committed" | "closed";
type ViewMode = "grid" | "list";

interface Case {
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

const MOCK_CASES: Case[] = [
  {
    id: "1",
    name: "Enterprise Expansion",
    company: "Acme Corp",
    initials: "AC",
    value: "$2.4M",
    status: "committed",
    owner: "Sarah K.",
    updatedAt: "2 hours ago",
    createdAt: "Jan 5, 2026",
  },
  {
    id: "2",
    name: "Cloud Migration ROI",
    company: "Beta Inc",
    initials: "BI",
    value: "$1.8M",
    status: "in-progress",
    owner: "John D.",
    updatedAt: "1 day ago",
    createdAt: "Jan 8, 2026",
  },
  {
    id: "3",
    name: "Cost Reduction Analysis",
    company: "Gamma Ltd",
    initials: "GL",
    value: "$890K",
    status: "in-progress",
    owner: "Sarah K.",
    updatedAt: "2 days ago",
    createdAt: "Jan 10, 2026",
  },
  {
    id: "4",
    name: "Digital Transformation",
    company: "Delta Corp",
    initials: "DC",
    value: null,
    status: "draft",
    owner: "Alex M.",
    updatedAt: "3 days ago",
    createdAt: "Jan 12, 2026",
  },
  {
    id: "5",
    name: "Security Compliance",
    company: "Epsilon Inc",
    initials: "EI",
    value: "$3.2M",
    status: "closed",
    owner: "Sarah K.",
    updatedAt: "1 week ago",
    createdAt: "Dec 15, 2025",
  },
  {
    id: "6",
    name: "Productivity Suite",
    company: "Zeta Systems",
    initials: "ZS",
    value: "$1.1M",
    status: "committed",
    owner: "John D.",
    updatedAt: "1 week ago",
    createdAt: "Dec 20, 2025",
  },
];

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

export function CasesPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updated");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const filteredCases = MOCK_CASES.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.company.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Summary stats
  const stats = {
    total: MOCK_CASES.length,
    inProgress: MOCK_CASES.filter((c) => c.status === "in-progress").length,
    committed: MOCK_CASES.filter((c) => c.status === "committed").length,
    totalValue: MOCK_CASES.reduce((sum, c) => {
      if (!c.value) return sum;
      const num = parseFloat(c.value.replace(/[$MK,]/g, ""));
      const multiplier = c.value.includes("M") ? 1000000 : c.value.includes("K") ? 1000 : 1;
      return sum + num * multiplier;
    }, 0),
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cases</h1>
          <p className="text-slate-500 mt-1">
            {stats.total} cases • {stats.inProgress} in progress • $
            {(stats.totalValue / 1000000).toFixed(1)}M total value
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

      {/* Cases Grid/List */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-3 gap-4">
          {filteredCases.map((caseItem) => (
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
            {filteredCases.map((caseItem) => (
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
      {filteredCases.length === 0 && (
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
    </div>
  );
}

interface CaseCardProps {
  caseData: Case;
  onClick: () => void;
}

function CaseCard({ caseData, onClick }: CaseCardProps) {
  const statusConfig = STATUS_CONFIG[caseData.status];

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
  caseData: Case;
  onClick: () => void;
}

function CaseRow({ caseData, onClick }: CaseRowProps) {
  const statusConfig = STATUS_CONFIG[caseData.status];

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
