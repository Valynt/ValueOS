import { Link } from "react-router-dom";
import { Activity, ArrowRight, Bot, CheckCircle2, DollarSign, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const agents = [
  { id: "opportunity", name: "Opportunity Agent", type: "discovery", version: "v2.3", active: true, successRate: 94, costLast7d: "$12.40", runsLast7d: 38, description: "Identifies and analyzes business opportunities from EDGAR filings, news, and market data" },
  { id: "target", name: "Target Agent", type: "modeling", version: "v1.8", active: true, successRate: 91, costLast7d: "$8.20", runsLast7d: 24, description: "Builds value trees and quantifies target outcomes for opportunities" },
  { id: "financial-modeling", name: "Financial Modeling Agent", type: "analysis", version: "v3.1", active: true, successRate: 88, costLast7d: "$22.50", runsLast7d: 15, description: "Generates ROI projections, business cases, and financial models" },
  { id: "realization", name: "Realization Agent", type: "tracking", version: "v1.2", active: true, successRate: 96, costLast7d: "$5.80", runsLast7d: 42, description: "Tracks value delivery against targets and milestones" },
  { id: "expansion", name: "Expansion Agent", type: "growth", version: "v1.0", active: true, successRate: 82, costLast7d: "$3.10", runsLast7d: 8, description: "Identifies upsell and cross-sell opportunities from realized value" },
  { id: "integrity", name: "Integrity Agent", type: "verification", version: "v2.0", active: true, successRate: 99, costLast7d: "$4.60", runsLast7d: 56, description: "Verifies claims against ground truth sources (EDGAR, XBRL, market data)" },
  { id: "research", name: "Research Agent", type: "discovery", version: "v1.5", active: true, successRate: 90, costLast7d: "$15.30", runsLast7d: 20, description: "Conducts competitive landscape analysis and market research" },
  { id: "narrative", name: "Narrative Agent", type: "content", version: "v1.1", active: false, successRate: 85, costLast7d: "$0.00", runsLast7d: 0, description: "Generates executive summaries and presentation narratives" },
];

const typeColors: Record<string, string> = {
  discovery: "bg-blue-50 text-blue-700",
  modeling: "bg-violet-50 text-violet-700",
  analysis: "bg-amber-50 text-amber-700",
  tracking: "bg-emerald-50 text-emerald-700",
  growth: "bg-cyan-50 text-cyan-700",
  verification: "bg-red-50 text-red-700",
  content: "bg-pink-50 text-pink-700",
};

export default function Agents() {
  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 tracking-[-0.05em]">Agent Hub</h1>
          <p className="text-[13px] text-zinc-400 mt-1">Manage, monitor, and audit your agent fleet</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 bg-white max-w-sm">
        <Search className="w-4 h-4 text-zinc-400" />
        <input type="text" placeholder="Search agents..." className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-zinc-400" />
      </div>

      {/* Agent grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map((agent) => (
          <Link
            key={agent.id}
            to={`/agents/${agent.id}`}
            className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] hover:border-zinc-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0", agent.active ? "bg-zinc-950" : "bg-zinc-200")}>
                <Bot className={cn("w-6 h-6", agent.active ? "text-white" : "text-zinc-400")} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-[14px] font-semibold text-zinc-900">{agent.name}</h3>
                  {!agent.active && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-500">Inactive</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize", typeColors[agent.type])}>
                    {agent.type}
                  </span>
                  <span className="text-[11px] text-zinc-400">{agent.version}</span>
                </div>
                <p className="text-[12px] text-zinc-500 leading-relaxed line-clamp-2">{agent.description}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-500 transition-colors flex-shrink-0 mt-1" />
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-zinc-100">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[12px] text-zinc-600">{agent.successRate}% success</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-[12px] text-zinc-600">{agent.runsLast7d} runs / 7d</span>
              </div>
              <div className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-[12px] text-zinc-600">{agent.costLast7d}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
