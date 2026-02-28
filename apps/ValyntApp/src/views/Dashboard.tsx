import {
  AlertTriangle,
  Bot,
  ChevronRight,
  FileText,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Shield,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

// -- Active case card (the primary object) --
function CaseCard({
  id, opp, stage, status, confidence, nextAction, lastActivity, value,
}: {
  id: string; opp: string; stage: string; status: string;
  confidence: number; nextAction: string; lastActivity: string; value: string;
}) {
  const stageColors: Record<string, string> = {
    Discovery: "bg-blue-500", Target: "bg-violet-500",
    Realization: "bg-amber-500", Expansion: "bg-emerald-500", Narrative: "bg-pink-500",
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
      to={`/opportunities/1/cases/${id}`}
      className="bg-white border border-zinc-200 rounded-2xl p-5 hover:border-zinc-300 hover:shadow-md transition-all group"
    >
      {/* Top row: stage + status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn("w-2.5 h-2.5 rounded-full", stageColors[stage])} />
          <span className="text-[12px] font-semibold text-zinc-700">{stage}</span>
          <span className="text-zinc-300">&middot;</span>
          <span className="text-[11px] text-zinc-400">{id}</span>
        </div>
        <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold", st!.color, st!.bg)}>
          <StIcon className="w-3 h-3" />
          <span className="capitalize">{status.replace("-", " ")}</span>
        </div>
      </div>

      {/* Company + value */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-[15px] font-black text-zinc-950 tracking-tight group-hover:text-zinc-800">{opp}</h3>
          <p className="text-[12px] text-zinc-400 mt-0.5">{lastActivity}</p>
        </div>
        <div className="text-right">
          <p className="text-[15px] font-black text-zinc-950 tracking-tight">{value}</p>
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
        </div>
      </div>

      {/* Next action — the most important line */}
      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-50 border border-zinc-100">
        <Zap className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
        <span className="text-[12px] text-zinc-700 flex-1">{nextAction}</span>
        <ChevronRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-zinc-500" />
      </div>
    </Link>
  );
}

// -- Quick start card --
function QuickStart() {
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
          placeholder="e.g. Acme Corp, Snowflake, Stripe..."
          className="flex-1 px-4 py-3 rounded-xl border border-zinc-200 text-[13px] bg-zinc-50 placeholder:text-zinc-400 placeholder:italic placeholder:font-light outline-none focus:border-zinc-400 focus:bg-white transition-colors"
        />
        <button className="px-5 py-3 bg-zinc-950 text-white rounded-xl text-[13px] font-medium hover:bg-zinc-800 transition-colors flex items-center gap-2">
          <Play className="w-4 h-4" />
          Go
        </button>
      </div>
    </div>
  );
}

// -- Integrity queue --
function IntegrityQueue() {
  const items = [
    { claim: "Revenue growth 45% YoY", case: "Acme Corp", tier: "Needs EDGAR verification", severity: "high" },
    { claim: "Cost reduction estimate $1.8M", case: "TechStart", tier: "Market data confidence low", severity: "medium" },
    { claim: "Server consolidation 4:1 ratio", case: "Global Logistics", tier: "Self-reported, unverified", severity: "low" },
  ];

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-zinc-600" />
          <h3 className="text-[13px] font-semibold text-zinc-900">Integrity Queue</h3>
          <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {items.length}
          </span>
        </div>
        <span className="text-[11px] text-zinc-400">Claims needing your review</span>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div
            key={i}
            className={cn(
              "flex items-start gap-3 p-3 rounded-xl cursor-pointer hover:bg-zinc-50 transition-colors",
              item.severity === "high" && "border-l-2 border-red-400",
              item.severity === "medium" && "border-l-2 border-amber-400",
              item.severity === "low" && "border-l-2 border-zinc-300",
            )}
          >
            <AlertTriangle className={cn(
              "w-4 h-4 mt-0.5 flex-shrink-0",
              item.severity === "high" ? "text-red-500" : item.severity === "medium" ? "text-amber-500" : "text-zinc-400"
            )} />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-zinc-900 font-medium">{item.claim}</p>
              <p className="text-[11px] text-zinc-400">{item.case} &middot; {item.tier}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-300 flex-shrink-0 mt-0.5" />
          </div>
        ))}
      </div>
    </div>
  );
}

// -- Recent iterations (what changed) --
function RecentIterations() {
  const iterations = [
    { action: "Revised ROI from 180% to 240% after server consolidation data", case: "Acme Corp", time: "25m ago", type: "revision" },
    { action: "Integrity veto resolved: swapped to Gartner benchmark", case: "TechStart", time: "1h ago", type: "integrity" },
    { action: "Executive summary generated for board presentation", case: "Global Logistics", time: "2h ago", type: "narrative" },
    { action: "Added 3 new KPIs from customer interview data", case: "FinServ Partners", time: "3h ago", type: "model" },
    { action: "Scenario comparison: conservative vs aggressive", case: "Acme Corp", time: "4h ago", type: "model" },
  ];

  const typeIcons: Record<string, { icon: React.ElementType; color: string }> = {
    revision: { icon: RotateCcw, color: "text-violet-500" },
    integrity: { icon: Shield, color: "text-blue-500" },
    narrative: { icon: FileText, color: "text-pink-500" },
    model: { icon: TrendingUp, color: "text-emerald-500" },
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13px] font-semibold text-zinc-900">Recent Work</h3>
        <span className="text-[11px] text-zinc-400">Your iteration history</span>
      </div>
      <div className="space-y-1">
        {iterations.map((it, i) => {
          const ti = typeIcons[it.type]!;
          const TIcon = ti.icon;
          return (
            <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-zinc-50 transition-colors cursor-pointer">
              <TIcon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", ti.color)} />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-zinc-700 leading-relaxed">{it.action}</p>
                <p className="text-[11px] text-zinc-400">{it.case} &middot; {it.time}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// -- Agent status strip --
function AgentStrip() {
  const agents = [
    { name: "Opportunity", status: "idle", lastRun: "2m ago" },
    { name: "Financial Modeling", status: "running", lastRun: "now" },
    { name: "Integrity", status: "idle", lastRun: "15m ago" },
    { name: "Narrative", status: "idle", lastRun: "2h ago" },
  ];

  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-zinc-200 rounded-2xl">
      <Bot className="w-4 h-4 text-zinc-400 flex-shrink-0" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400">Agents</span>
      <div className="flex items-center gap-4 flex-1 overflow-x-auto">
        {agents.map((a) => (
          <div key={a.name} className="flex items-center gap-1.5 flex-shrink-0">
            <div className={cn(
              "w-2 h-2 rounded-full",
              a.status === "running" ? "bg-emerald-500 animate-pulse" : "bg-zinc-300"
            )} />
            <span className="text-[12px] text-zinc-600">{a.name}</span>
            <span className="text-[10px] text-zinc-400">{a.lastRun}</span>
          </div>
        ))}
      </div>
      <Link to="/agents" className="text-[11px] text-zinc-400 hover:text-zinc-700 flex-shrink-0">
        Manage
      </Link>
    </div>
  );
}

// -- Dashboard Page --
export default function Dashboard() {
  const activeCases = [
    { id: "VC-1024", opp: "Acme Corp — Platform Migration", stage: "Target", status: "needs-input", confidence: 87, nextAction: "Review 3 assumptions flagged by Integrity Agent", lastActivity: "Model updated 25m ago", value: "$4.2M" },
    { id: "VC-1019", opp: "TechStart — Cloud Modernization", stage: "Discovery", status: "running", confidence: 62, nextAction: "Agent researching competitive landscape — ETA 2m", lastActivity: "Discovery started 8m ago", value: "$1.5M" },
    { id: "VC-1015", opp: "Global Logistics — Supply Chain", stage: "Narrative", status: "review", confidence: 91, nextAction: "Executive summary ready for your review", lastActivity: "Narrative generated 2h ago", value: "$2.8M" },
    { id: "VC-1012", opp: "FinServ Partners — Risk Analytics", stage: "Target", status: "paused", confidence: 45, nextAction: "Resume: customer provided new baseline data", lastActivity: "Paused 1d ago — waiting on customer", value: "$3.1M" },
  ];

  return (
    <div className="p-6 lg:p-10 max-w-[1200px] mx-auto space-y-6">
      {/* Header — personal, not org-level */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 tracking-[-0.05em]">My Work</h1>
          <p className="text-[13px] text-zinc-400 mt-0.5">
            {activeCases.length} active cases &middot; {activeCases.filter(c => c.status === "needs-input").length} need your input
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

      {/* Quick start — the fastest path to value */}
      <QuickStart />

      {/* Agent status strip */}
      <AgentStrip />

      {/* Active cases — the primary workspace objects */}
      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 mb-3">Active Cases</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {activeCases.map((c) => (
            <CaseCard key={c.id} {...c} />
          ))}
        </div>
      </div>

      {/* Two-column: integrity queue + recent work */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <IntegrityQueue />
        <RecentIterations />
      </div>
    </div>
  );
}
