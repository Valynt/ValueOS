import {
  AlertTriangle,
  Bot,
  ChevronRight,
  Pause,
  Play,
  Plus,
  Shield,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useCasesList, useCreateCase } from "@/hooks/useCases";
import { cn } from "@/lib/utils";
import type { ValueCaseWithRelations } from "@/lib/supabase/types";

// -- Derive display fields from a real ValueCaseRow --
function deriveStage(c: ValueCaseWithRelations): string {
  const s = c.stage?.toLowerCase() ?? "";
  if (s.includes("discovery")) return "Discovery";
  if (s.includes("target")) return "Target";
  if (s.includes("realiz")) return "Realization";
  if (s.includes("expan")) return "Expansion";
  if (s.includes("narrat")) return "Narrative";
  return "Discovery";
}

function deriveStatus(c: ValueCaseWithRelations): string {
  if (c.status === "review") return "review";
  if (c.status === "draft") return "paused";
  const meta = c.metadata as Record<string, unknown> | null;
  if (meta?.agent_status === "running") return "running";
  if (meta?.agent_status === "needs-input") return "needs-input";
  if (meta?.agent_status === "paused") return "paused";
  return "paused";
}

function deriveNextAction(c: ValueCaseWithRelations): string {
  const meta = c.metadata as Record<string, unknown> | null;
  if (typeof meta?.next_action === "string") return meta.next_action;
  const status = deriveStatus(c);
  if (status === "needs-input") return "Review flagged assumptions";
  if (status === "review") return "Output ready for your review";
  if (status === "paused") return "Resume case";
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
  if (diffMin < 60) return `Updated ${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Updated ${diffH}h ago`;
  return `Updated ${Math.floor(diffH / 24)}d ago`;
}

// -- Active case card --
function CaseCard({ c }: { c: ValueCaseWithRelations }) {
  const stage = deriveStage(c);
  const status = deriveStatus(c);
  const confidence = deriveConfidence(c);
  const value = deriveValue(c);
  const nextAction = deriveNextAction(c);
  const lastActivity = deriveLastActivity(c);
  const displayName = c.company_profiles?.company_name ?? c.name;

  const stageColors: Record<string, string> = {
    Discovery: "bg-blue-500",
    Target: "bg-violet-500",
    Realization: "bg-amber-500",
    Expansion: "bg-emerald-500",
    Narrative: "bg-pink-500",
  };
  const statusIcons: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
    running: { icon: Play, color: "text-emerald-700", bg: "bg-emerald-50" },
    "needs-input": { icon: AlertTriangle, color: "text-amber-700", bg: "bg-amber-50" },
    paused: { icon: Pause, color: "text-zinc-500", bg: "bg-zinc-100" },
    review: { icon: Shield, color: "text-blue-700", bg: "bg-blue-50" },
  };
  const st = statusIcons[status] ?? statusIcons.running;
  const StIcon = st!.icon;

  return (
    <Link
      to={`/workspace/${c.id}`}
      className="bg-white border border-zinc-200 rounded-2xl p-5 hover:border-zinc-300 hover:shadow-md transition-all group"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn("w-2.5 h-2.5 rounded-full", stageColors[stage])} />
          <span className="text-[12px] font-semibold text-zinc-700">{stage}</span>
          <span className="text-zinc-300">&middot;</span>
          <span className="text-[11px] text-zinc-400 font-mono">{c.id.slice(0, 8)}</span>
        </div>
        <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold", st!.color, st!.bg)}>
          <StIcon className="w-3 h-3" />
          <span className="capitalize">{status.replace("-", " ")}</span>
        </div>
      </div>

      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-[15px] font-black text-zinc-950 tracking-tight group-hover:text-zinc-800 line-clamp-1">{displayName}</h3>
          <p className="text-[12px] text-zinc-400 mt-0.5">{lastActivity}</p>
        </div>
        <div className="text-right flex-shrink-0 ml-3">
          <p className="text-[15px] font-black text-zinc-950 tracking-tight">{value}</p>
          {confidence > 0 && (
            <div className="flex items-center gap-1.5 justify-end mt-1">
              <div className="w-14 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    confidence >= 80 ? "bg-emerald-500" : confidence >= 60 ? "bg-amber-500" : "bg-red-400"
                  )}
                  style={{ width: `${confidence}%` }}
                />
              </div>
              <span className="text-[11px] font-medium text-zinc-500">{confidence}%</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-50 border border-zinc-100">
        <Zap className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
        <span className="text-[12px] text-zinc-700 flex-1 line-clamp-1">{nextAction}</span>
        <ChevronRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-zinc-500" />
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="col-span-2 flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center mb-4">
        <Sparkles className="w-6 h-6 text-zinc-400" />
      </div>
      <p className="text-[14px] font-medium text-zinc-700 mb-1">No active cases yet</p>
      <p className="text-[13px] text-zinc-400">Enter a company name above to start your first value case.</p>
    </div>
  );
}

function CaseCardSkeleton() {
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-200" />
          <div className="h-3 w-16 bg-zinc-200 rounded" />
        </div>
        <div className="h-5 w-20 bg-zinc-100 rounded-full" />
      </div>
      <div className="flex items-start justify-between mb-3">
        <div className="space-y-1.5">
          <div className="h-4 w-40 bg-zinc-200 rounded" />
          <div className="h-3 w-24 bg-zinc-100 rounded" />
        </div>
        <div className="h-4 w-12 bg-zinc-200 rounded" />
      </div>
      <div className="h-9 bg-zinc-50 rounded-xl border border-zinc-100" />
    </div>
  );
}

function QuickStart() {
  const [companyName, setCompanyName] = useState("");
  const navigate = useNavigate();
  const createCase = useCreateCase();

  const handleGo = async () => {
    const name = companyName.trim();
    if (!name) return;
    try {
      const newCase = await createCase.mutateAsync({
        name: `${name} — Value Case`,
        status: "draft",
        stage: "discovery",
        metadata: { company_name: name },
      });
      navigate(`/workspace/${newCase.id}`);
    } catch {
      // Error is surfaced via createCase.isError / createCase.error below.
    }
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-zinc-950 rounded-xl flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-zinc-900">Start a Value Case</h3>
          <p className="text-[12px] text-zinc-400">Enter a company name — the agent handles the rest</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleGo()}
          placeholder="e.g. Acme Corp, Snowflake, Stripe…"
          className="flex-1 px-4 py-3 rounded-xl border border-zinc-200 text-[13px] bg-zinc-50 placeholder:text-zinc-400 placeholder:italic placeholder:font-light outline-none focus:border-zinc-400 focus:bg-white transition-colors"
          disabled={createCase.isPending}
        />
        <button
          onClick={handleGo}
          disabled={!companyName.trim() || createCase.isPending}
          className="px-5 py-3 bg-zinc-950 text-white rounded-xl text-[13px] font-medium hover:bg-zinc-800 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play className="w-4 h-4" />
          {createCase.isPending ? "Creating…" : "Go"}
        </button>
      </div>
      {createCase.isError && (
        <p className="mt-2 text-[12px] text-red-500">Failed to create case. Please try again.</p>
      )}
    </div>
  );
}

function AgentStrip({ cases }: { cases: ValueCaseWithRelations[] }) {
  const runningCount = cases.filter((c) => deriveStatus(c) === "running").length;
  const needsInputCount = cases.filter((c) => deriveStatus(c) === "needs-input").length;
  const agentNames = ["Opportunity", "Financial Modeling", "Integrity", "Narrative"];

  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-zinc-200 rounded-2xl">
      <Bot className="w-4 h-4 text-zinc-400 flex-shrink-0" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400">Agents</span>
      <div className="flex items-center gap-4 flex-1 overflow-x-auto">
        {agentNames.map((name, i) => {
          const isRunning = i === 1 && runningCount > 0;
          return (
            <div key={name} className="flex items-center gap-1.5 flex-shrink-0">
              <div className={cn("w-2 h-2 rounded-full", isRunning ? "bg-emerald-500 animate-pulse" : "bg-zinc-300")} />
              <span className="text-[12px] text-zinc-600">{name}</span>
            </div>
          );
        })}
      </div>
      {needsInputCount > 0 && (
        <span className="text-[11px] text-amber-600 font-medium flex-shrink-0">{needsInputCount} need input</span>
      )}
      <Link to="/agents" className="text-[11px] text-zinc-400 hover:text-zinc-700 flex-shrink-0">Manage</Link>
    </div>
  );
}

function NeedsInputQueue({ cases }: { cases: ValueCaseWithRelations[] }) {
  const flagged = cases.filter((c) => deriveStatus(c) === "needs-input").slice(0, 5);

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-zinc-600" />
          <h3 className="text-[13px] font-semibold text-zinc-900">Needs Input</h3>
          {flagged.length > 0 && (
            <span className="w-5 h-5 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {flagged.length}
            </span>
          )}
        </div>
        <span className="text-[11px] text-zinc-400">Cases awaiting you</span>
      </div>
      {flagged.length === 0 ? (
        <p className="text-[12px] text-zinc-400 text-center py-6">All clear — no cases need input</p>
      ) : (
        <div className="space-y-2">
          {flagged.map((c) => (
            <Link
              key={c.id}
              to={`/workspace/${c.id}`}
              className="flex items-start gap-3 p-3 rounded-xl hover:bg-zinc-50 transition-colors border-l-2 border-amber-400"
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-zinc-900 font-medium truncate">
                  {c.company_profiles?.company_name ?? c.name}
                </p>
                <p className="text-[11px] text-zinc-400">{deriveStage(c)} &middot; {deriveNextAction(c)}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-300 flex-shrink-0 mt-0.5" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function RecentActivity({ cases }: { cases: ValueCaseWithRelations[] }) {
  const recent = [...cases]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5);

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13px] font-semibold text-zinc-900">Recent Work</h3>
        <span className="text-[11px] text-zinc-400">Latest updates</span>
      </div>
      {recent.length === 0 ? (
        <p className="text-[12px] text-zinc-400 text-center py-6">No activity yet</p>
      ) : (
        <div className="space-y-1">
          {recent.map((c) => (
            <Link
              key={c.id}
              to={`/workspace/${c.id}`}
              className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-zinc-50 transition-colors"
            >
              <TrendingUp className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-500" />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-zinc-700 leading-relaxed truncate">
                  {c.company_profiles?.company_name ?? c.name}
                </p>
                <p className="text-[11px] text-zinc-400">{deriveStage(c)} &middot; {deriveLastActivity(c)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function useGreeting() {
  const { user } = useAuth();
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
    user?.email?.split("@")[0] ??
    null;
  return firstName ? `${timeOfDay}, ${firstName}` : timeOfDay;
}

export default function Dashboard() {
  const greeting = useGreeting();
  const { data: cases, isLoading } = useCasesList();

  const activeCases = (cases ?? []).filter((c) => c.status !== "archived");
  const needsInputCount = activeCases.filter((c) => deriveStatus(c) === "needs-input").length;

  return (
    <div className="p-6 lg:p-10 max-w-[1200px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 tracking-[-0.05em]">{greeting}</h1>
          <p className="text-[13px] text-zinc-400 mt-0.5">
            {isLoading ? (
              <span className="inline-block h-3 w-40 bg-zinc-200 rounded animate-pulse" />
            ) : (
              <>
                {activeCases.length} active {activeCases.length === 1 ? "case" : "cases"}
                {needsInputCount > 0 && (
                  <> &middot; <span className="text-amber-600 font-medium">{needsInputCount} need your input</span></>
                )}
              </>
            )}
          </p>
        </div>
        <Link
          to="/opportunities"
          className="flex items-center gap-2 px-4 py-2.5 bg-zinc-950 text-white rounded-xl text-[13px] font-medium hover:bg-zinc-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Case
        </Link>
      </div>

      <QuickStart />
      <AgentStrip cases={activeCases} />

      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 mb-3">Active Cases</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {isLoading ? (
            <><CaseCardSkeleton /><CaseCardSkeleton /><CaseCardSkeleton /><CaseCardSkeleton /></>
          ) : activeCases.length === 0 ? (
            <EmptyState />
          ) : (
            activeCases.map((c) => <CaseCard key={c.id} c={c} />)
          )}
        </div>
      </div>

      {!isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <NeedsInputQueue cases={activeCases} />
          <RecentActivity cases={activeCases} />
        </div>
      )}
    </div>
  );
}
