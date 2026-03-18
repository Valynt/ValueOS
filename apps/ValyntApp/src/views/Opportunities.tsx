import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  Layers,
  LayoutGrid,
  List,
  Pause,
  Play,
  Search,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useCasesList, useCreateCase } from "@/hooks/useCases";
import { useDomainPacks } from "@/hooks/useDomainPacks";
import { cn } from "@/lib/utils";
import type { ValueCaseWithRelations } from "@/lib/supabase/types";

// -- Derive display fields from real DB rows --
function deriveStage(c: ValueCaseWithRelations): string {
  const s = c.stage?.toLowerCase() ?? "";
  if (s.includes("discovery")) return "Discovery";
  if (s.includes("target")) return "Target";
  if (s.includes("realiz")) return "Realization";
  if (s.includes("expan")) return "Expansion";
  if (s.includes("narrat")) return "Narrative";
  return "Discovery";
}

type CaseStatus = "running" | "needs-input" | "paused" | "review" | "complete";

function deriveStatus(c: ValueCaseWithRelations): CaseStatus {
  if (c.status === "review") return "review";
  if (c.status === "published") return "complete";
  if (c.status === "draft") return "paused";
  const meta = c.metadata as Record<string, unknown> | null;
  const s = meta?.agent_status as string | undefined;
  if (s === "running") return "running";
  if (s === "needs-input") return "needs-input";
  if (s === "paused") return "paused";
  return "paused";
}

function deriveNextAction(c: ValueCaseWithRelations): string {
  const meta = c.metadata as Record<string, unknown> | null;
  if (typeof meta?.next_action === "string") return meta.next_action;
  const status = deriveStatus(c);
  if (status === "needs-input") return "Review flagged assumptions";
  if (status === "review") return "Output ready for your review";
  if (status === "paused") return "Resume case";
  if (status === "complete") return "Value case finalized";
  return "Agent working — check back shortly";
}

function deriveValue(c: ValueCaseWithRelations): string {
  const meta = c.metadata as Record<string, unknown> | null;
  if (typeof meta?.projected_value === "number") {
    return `$${(meta.projected_value / 1_000_000).toFixed(1)}M`;
  }
  return "—";
}

function deriveConfidence(c: ValueCaseWithRelations): number {
  return typeof c.quality_score === "number" ? Math.round(c.quality_score * 100) : 0;
}

function deriveLastActivity(c: ValueCaseWithRelations): string {
  const updated = new Date(c.updated_at);
  const diffMs = Date.now() - updated.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

function deriveTags(c: ValueCaseWithRelations): string[] {
  const tags: string[] = [];
  if (c.domain_packs?.industry) tags.push(c.domain_packs.industry);
  const meta = c.metadata as Record<string, unknown> | null;
  if (Array.isArray(meta?.tags)) {
    tags.push(...(meta.tags as string[]).slice(0, 2));
  }
  return tags.slice(0, 3);
}

// -- Status config --
const statusConfig: Record<CaseStatus, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  running: { icon: Play, color: "text-emerald-700", bg: "bg-emerald-50", label: "Running" },
  "needs-input": { icon: AlertTriangle, color: "text-amber-700", bg: "bg-amber-50", label: "Needs Input" },
  paused: { icon: Pause, color: "text-zinc-500", bg: "bg-zinc-100", label: "Paused" },
  review: { icon: Shield, color: "text-blue-700", bg: "bg-blue-50", label: "In Review" },
  complete: { icon: CheckCircle2, color: "text-emerald-700", bg: "bg-emerald-50", label: "Complete" },
};

const stageDot: Record<string, string> = {
  Discovery: "bg-blue-500",
  Target: "bg-violet-500",
  Realization: "bg-amber-500",
  Expansion: "bg-emerald-500",
  Narrative: "bg-pink-500",
};

// -- Quick start --
function InlineQuickStart() {
  const [company, setCompany] = useState("");
  const [selectedPackId, setSelectedPackId] = useState("");
  const navigate = useNavigate();
  const { data: packs, isLoading: packsLoading } = useDomainPacks();
  const createCase = useCreateCase();

  const handleStart = async () => {
    const name = company.trim();
    if (!name) return;
    try {
      const newCase = await createCase.mutateAsync({
        name: `${name} — Value Case`,
        status: "draft",
        stage: "discovery",
        domain_pack_id: selectedPackId || undefined,
        metadata: { company_name: name },
      });
      navigate(`/workspace/${newCase.id}`);
    } catch {
      // Error is surfaced via createCase.isError / createCase.error below.
    }
  };

  return (
    <div className="bg-white border border-dashed border-zinc-300 rounded-2xl p-5 hover:border-zinc-400 transition-colors">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 bg-zinc-950 rounded-lg flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-[13px] font-semibold text-zinc-900">Start a new Value Case</h3>
          <p className="text-[11px] text-zinc-400">Enter a company — the agent handles discovery, modeling, and narrative</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleStart()}
          placeholder="e.g. Acme Corp, Snowflake, Stripe…"
          className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 text-[13px] bg-zinc-50 placeholder:text-zinc-400 placeholder:italic outline-none focus:border-zinc-400 focus:bg-white transition-colors"
          disabled={createCase.isPending}
        />
        <div className="relative">
          <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
          <select
            value={selectedPackId}
            onChange={(e) => setSelectedPackId(e.target.value)}
            className="appearance-none pl-8 pr-6 py-2.5 rounded-xl border border-zinc-200 text-[13px] bg-zinc-50 text-zinc-700 outline-none focus:border-zinc-400 focus:bg-white transition-colors cursor-pointer"
          >
            <option value="">No Domain Pack</option>
            {packsLoading && <option disabled>Loading…</option>}
            {packs?.map((pack) => (
              <option key={pack.id} value={pack.id}>{pack.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleStart}
          disabled={!company.trim() || createCase.isPending}
          className="px-4 py-2.5 bg-zinc-950 text-white rounded-xl text-[13px] font-medium hover:bg-zinc-800 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play className="w-3.5 h-3.5" />
          {createCase.isPending ? "Creating…" : "Start"}
        </button>
      </div>
      {createCase.isError && (
        <p className="mt-2 text-[12px] text-red-500">Failed to create case. Please try again.</p>
      )}
    </div>
  );
}

// -- Stats bar --
function StatBar({ cases }: { cases: ValueCaseWithRelations[] }) {
  const needsInput = cases.filter((c) => deriveStatus(c) === "needs-input").length;
  const running = cases.filter((c) => deriveStatus(c) === "running").length;

  const stats = [
    { label: "Active", value: cases.length, icon: Target },
    { label: "Running", value: running, icon: Play },
    { label: "Needs Input", value: needsInput, icon: AlertTriangle, highlight: needsInput > 0 },
    { label: "Avg Confidence", value: cases.length > 0 ? `${Math.round(cases.reduce((s, c) => s + deriveConfidence(c), 0) / cases.length)}%` : "—", icon: Shield },
  ];

  return (
    <div className="flex items-center gap-1 p-1 bg-white border border-zinc-200 rounded-2xl">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.label}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl flex-1 justify-center",
              s.highlight ? "bg-amber-50" : "hover:bg-zinc-50"
            )}
          >
            <Icon className={cn("w-3.5 h-3.5", s.highlight ? "text-amber-500" : "text-zinc-400")} />
            <div className="text-center">
              <p className={cn("text-[14px] font-black tracking-tight", s.highlight ? "text-amber-700" : "text-zinc-900")}>
                {s.value}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">{s.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// -- Grid card --
function DealCard({ c }: { c: ValueCaseWithRelations }) {
  const stage = deriveStage(c);
  const status = deriveStatus(c);
  const confidence = deriveConfidence(c);
  const value = deriveValue(c);
  const nextAction = deriveNextAction(c);
  const lastActivity = deriveLastActivity(c);
  const tags = deriveTags(c);
  const displayName = c.company_profiles?.company_name ?? c.name;
  const st = statusConfig[status];
  const StIcon = st.icon;

  return (
    <Link
      to={`/workspace/${c.id}`}
      className="bg-white border border-zinc-200 rounded-2xl p-5 hover:border-zinc-300 hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-zinc-100 rounded-lg flex items-center justify-center">
            <Building2 className="w-4 h-4 text-zinc-500" />
          </div>
          <div>
            <h3 className="text-[14px] font-black text-zinc-950 tracking-tight group-hover:text-zinc-700 transition-colors line-clamp-1">
              {displayName}
            </h3>
            <p className="text-[12px] text-zinc-400 line-clamp-1">{c.name}</p>
          </div>
        </div>
        <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ml-2", st.color, st.bg)}>
          <StIcon className="w-3 h-3" />
          <span>{st.label}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-1.5">
          <div className={cn("w-2 h-2 rounded-full", stageDot[stage] ?? "bg-zinc-300")} />
          <span className="text-[11px] font-semibold text-zinc-600">{stage}</span>
        </div>
        {confidence > 0 && (
          <>
            <span className="text-zinc-200">|</span>
            <div className="flex items-center gap-1.5">
              <div className="w-12 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full", confidence >= 80 ? "bg-emerald-500" : confidence >= 60 ? "bg-amber-500" : "bg-red-400")}
                  style={{ width: `${confidence}%` }}
                />
              </div>
              <span className="text-[11px] font-medium text-zinc-500">{confidence}%</span>
            </div>
          </>
        )}
        {value !== "—" && (
          <>
            <span className="text-zinc-200">|</span>
            <span className="text-[12px] font-bold text-zinc-800">{value}</span>
          </>
        )}
      </div>

      {tags.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3">
          {tags.map((tag) => (
            <span key={tag} className="px-2 py-0.5 bg-zinc-50 border border-zinc-100 rounded-md text-[10px] text-zinc-500 font-medium">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-50 border border-zinc-100">
        <Zap className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
        <span className="text-[12px] text-zinc-700 flex-1 truncate">{nextAction}</span>
        <ChevronRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-zinc-500 transition-colors" />
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100">
        <span className="text-[11px] text-zinc-400">{lastActivity}</span>
        <span className="text-[11px] font-mono text-zinc-300">{c.id.slice(0, 8)}</span>
      </div>
    </Link>
  );
}

// -- List row --
function DealRow({ c }: { c: ValueCaseWithRelations }) {
  const stage = deriveStage(c);
  const status = deriveStatus(c);
  const confidence = deriveConfidence(c);
  const value = deriveValue(c);
  const nextAction = deriveNextAction(c);
  const displayName = c.company_profiles?.company_name ?? c.name;
  const st = statusConfig[status];
  const StIcon = st.icon;

  return (
    <Link
      to={`/workspace/${c.id}`}
      className="grid grid-cols-[minmax(0,1fr)_auto_auto_minmax(0,1fr)_auto] gap-3 px-5 py-3.5 border-b border-zinc-50 hover:bg-zinc-50 transition-colors items-center"
    >
      {/* Name */}
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-zinc-900 truncate">{displayName}</p>
        <p className="text-[11px] text-zinc-400 truncate">{c.name}</p>
      </div>

      {/* Stage + Status — always visible */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <div className={cn("w-2 h-2 rounded-full flex-shrink-0", stageDot[stage] ?? "bg-zinc-300")} />
          <span className="text-[12px] text-zinc-600 hidden sm:inline">{stage}</span>
        </div>
        <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold", st.color, st.bg)}>
          <StIcon className="w-3 h-3" />
          <span className="hidden sm:inline">{st.label}</span>
        </div>
      </div>

      {/* Confidence — hidden on narrow */}
      <div className="hidden md:flex items-center gap-1.5 flex-shrink-0 w-20">
        {confidence > 0 ? (
          <>
            <div className="w-10 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full", confidence >= 80 ? "bg-emerald-500" : confidence >= 60 ? "bg-amber-500" : "bg-red-400")}
                style={{ width: `${confidence}%` }}
              />
            </div>
            <span className="text-[11px] text-zinc-500">{confidence}%</span>
          </>
        ) : (
          <span className="text-[11px] text-zinc-300">—</span>
        )}
      </div>

      {/* Next action — hidden on narrow */}
      <p className="hidden lg:block text-[12px] text-zinc-600 truncate min-w-0">{nextAction}</p>

      {/* Value — always visible */}
      <p className="text-[13px] font-bold text-zinc-900 text-right flex-shrink-0">{value}</p>
    </Link>
  );
}

// -- Skeleton --
function CardSkeleton() {
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-zinc-100 rounded-lg" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-32 bg-zinc-200 rounded" />
            <div className="h-3 w-20 bg-zinc-100 rounded" />
          </div>
        </div>
        <div className="h-5 w-20 bg-zinc-100 rounded-full" />
      </div>
      <div className="h-3 w-40 bg-zinc-100 rounded mb-3" />
      <div className="h-9 bg-zinc-50 rounded-xl border border-zinc-100" />
    </div>
  );
}

type FilterTab = "all" | CaseStatus;

const filterTabs: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "needs-input", label: "Needs Input" },
  { key: "running", label: "Running" },
  { key: "review", label: "In Review" },
  { key: "paused", label: "Paused" },
  { key: "complete", label: "Complete" },
];

export default function Opportunities() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: cases, isLoading } = useCasesList();
  const allCases = (cases ?? []).filter((c) => c.status !== "archived");

  const filtered = allCases.filter((c) => {
    const status = deriveStatus(c);
    const matchesFilter = activeFilter === "all" || status === activeFilter;
    const displayName = (c.company_profiles?.company_name ?? c.name).toLowerCase();
    const matchesSearch =
      !search ||
      displayName.includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="p-6 lg:p-10 max-w-[1200px] mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 tracking-[-0.05em]">Value Cases</h1>
          <p className="text-[13px] text-zinc-400 mt-0.5">
            {isLoading ? (
              <span className="inline-block h-3 w-32 bg-zinc-200 rounded animate-pulse" />
            ) : (
              <>
                {allCases.length} {allCases.length === 1 ? "case" : "cases"}
                {allCases.filter((c) => deriveStatus(c) === "needs-input").length > 0 && (
                  <> &middot; <span className="text-amber-600 font-medium">{allCases.filter((c) => deriveStatus(c) === "needs-input").length} need your input</span></>
                )}
              </>
            )}
          </p>
        </div>
      </div>

      <InlineQuickStart />

      {!isLoading && allCases.length > 0 && <StatBar cases={allCases} />}

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cases, companies…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 text-[13px] bg-white placeholder:text-zinc-400 outline-none focus:border-zinc-400 transition-colors"
          />
        </div>

        <div className="flex items-center gap-0.5 p-0.5 bg-zinc-100 rounded-xl">
          {filterTabs.map((tab) => {
            const count = tab.key === "all"
              ? allCases.length
              : allCases.filter((c) => deriveStatus(c) === tab.key).length;
            if (count === 0 && tab.key !== "all") return null;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors flex items-center gap-1.5",
                  activeFilter === tab.key ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                )}
              >
                {tab.label}
                <span className={cn(
                  "text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full",
                  activeFilter === tab.key ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-500"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-0.5 p-0.5 bg-zinc-100 rounded-lg ml-auto">
          <button
            onClick={() => setViewMode("grid")}
            className={cn("p-1.5 rounded-md transition-colors", viewMode === "grid" ? "bg-white shadow-sm text-zinc-900" : "text-zinc-400 hover:text-zinc-600")}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={cn("p-1.5 rounded-md transition-colors", viewMode === "list" ? "bg-white shadow-sm text-zinc-900" : "text-zinc-400 hover:text-zinc-600")}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Search className="w-5 h-5 text-zinc-400" />
          </div>
          <p className="text-[14px] font-medium text-zinc-600">
            {allCases.length === 0 ? "No cases yet" : "No cases match your filters"}
          </p>
          <p className="text-[12px] text-zinc-400 mt-1">
            {allCases.length === 0 ? "Start your first value case above." : "Try adjusting your search or filter."}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((c) => <DealCard key={c.id} c={c} />)}
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_minmax(0,1fr)_auto] gap-3 px-5 py-2.5 border-b border-zinc-100 bg-zinc-50">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">Deal</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">Stage / Status</span>
            <span className="hidden md:block text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400 w-20">Conf.</span>
            <span className="hidden lg:block text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">Next Action</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400 text-right">Value</span>
          </div>
          {filtered.map((c) => <DealRow key={c.id} c={c} />)}
        </div>
      )}
    </div>
  );
}
