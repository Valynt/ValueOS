import { Activity, ArrowRight, Bot, CheckCircle2, DollarSign, Search, Shield, Zap } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { useAgentList, type AgentInfo } from "@/hooks/useAgentMetrics";
import { cn } from "@/lib/utils";

const typeColors: Record<string, string> = {
  discovery: "bg-blue-50 text-blue-700",
  modeling: "bg-violet-50 text-violet-700",
  analysis: "bg-amber-50 text-amber-700",
  tracking: "bg-emerald-50 text-emerald-700",
  growth: "bg-cyan-50 text-cyan-700",
  verification: "bg-red-50 text-red-700",
  content: "bg-pink-50 text-pink-700",
};

function AgentCard({ agent }: { agent: AgentInfo }) {
  return (
    <Link
      to={`/agents/${agent.id}`}
      className="bg-card border border-border rounded-3xl p-6 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] hover:border-border hover:shadow-md transition-all group"
    >
      <div className="flex items-start gap-4">
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0",
          agent.active ? "bg-background" : "bg-muted/70"
        )}>
          <Bot className={cn("w-6 h-6", agent.active ? "text-white" : "text-muted-foreground")} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[14px] font-semibold text-foreground">{agent.name}</h3>
            {!agent.active && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground">Inactive</span>
            )}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize", typeColors[agent.type] ?? "bg-muted text-muted-foreground")}>
              {agent.type}
            </span>
            <span className="text-[11px] text-muted-foreground">{agent.version}</span>
            {agent.modelVersion && (
              <span className="text-[11px] text-foreground/80 truncate max-w-[120px]" title={agent.modelVersion}>
                {agent.modelVersion.split("/").pop()}
              </span>
            )}
          </div>
          <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2">{agent.description}</p>
        </div>
        <ArrowRight className="w-4 h-4 text-foreground/80 group-hover:text-muted-foreground transition-colors flex-shrink-0 mt-1" />
      </div>

      {/* Stats row — shown when available, omitted when not */}
      {(agent.successRate !== undefined || agent.runsLast7d !== undefined || agent.costLast7d !== undefined) && (
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border">
          {agent.successRate !== undefined && (
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[12px] text-muted-foreground">{agent.successRate}% success</span>
            </div>
          )}
          {agent.runsLast7d !== undefined && (
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[12px] text-muted-foreground">{agent.runsLast7d} runs / 7d</span>
            </div>
          )}
          {agent.costLast7d !== undefined && (
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[12px] text-muted-foreground">{agent.costLast7d}</span>
            </div>
          )}
        </div>
      )}

      {/* Safety constraints preview — shown when model card is loaded */}
      {agent.safetyConstraints && agent.safetyConstraints.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-1.5 mb-2">
            <Shield className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Safety</span>
          </div>
          <p className="text-[11px] text-muted-foreground line-clamp-1">{agent.safetyConstraints[0]}</p>
        </div>
      )}
    </Link>
  );
}

function AgentCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-3xl p-6 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-muted/70 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-36 bg-muted/70 rounded" />
          <div className="h-3 w-20 bg-muted rounded" />
          <div className="h-3 w-full bg-muted rounded" />
          <div className="h-3 w-3/4 bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}

// -- Fleet summary strip --
function FleetSummary({ agents }: { agents: AgentInfo[] }) {
  const active = agents.filter((a) => a.active).length;
  const withModelCard = agents.filter((a) => !!a.modelVersion).length;

  return (
    <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-2xl">
      <Bot className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Fleet</span>
      <div className="flex items-center gap-4 flex-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-[12px] text-muted-foreground">{active} active</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-muted-foreground" />
          <span className="text-[12px] text-muted-foreground">{agents.length} total</span>
        </div>
        {withModelCard > 0 && (
          <div className="flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-muted-foreground" />
            <span className="text-[12px] text-muted-foreground">{withModelCard} model cards loaded</span>
          </div>
        )}
      </div>
      <Link to="/admin/agents" className="text-[11px] text-muted-foreground hover:text-muted-foreground flex-shrink-0">Admin</Link>
    </div>
  );
}

export default function Agents() {
  const [search, setSearch] = useState("");
  const { data: agents, isLoading } = useAgentList();

  const filtered = (agents ?? []).filter((a) =>
    !search ||
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.type.toLowerCase().includes(search.toLowerCase()) ||
    a.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 tracking-[-0.05em]">Agent Hub</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            {isLoading ? (
              <span className="inline-block h-3 w-32 bg-muted/70 rounded animate-pulse" />
            ) : (
              `${agents?.filter((a) => a.active).length ?? 0} active agents`
            )}
          </p>
        </div>
      </div>

      {!isLoading && agents && agents.length > 0 && <FleetSummary agents={agents} />}

      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card max-w-sm">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search agents…"
          className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <AgentCardSkeleton key={i} />)
        ) : filtered.length === 0 ? (
          <div className="col-span-2 text-center py-16">
            <p className="text-[14px] font-medium text-muted-foreground">No agents match your search</p>
          </div>
        ) : (
          filtered.map((agent) => <AgentCard key={agent.id} agent={agent} />)
        )}
      </div>
    </div>
  );
}
