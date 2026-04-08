import {
  Bot,
  Play,
  Plus,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ActivityFeed } from "@/components/warmth/ActivityFeed";
import { WarmthSummary } from "@/components/warmth/WarmthSummary";
import { useAuth } from "@/contexts/AuthContext";
import { useCasesList, useCreateCase } from "@/hooks/useCases";
import { deriveCaseDisplayFields } from "@/lib/case-utils";
import type { ValueCaseWithRelations } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

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
      navigate(`/case/${newCase.id}`);
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
  const runningCount = cases.filter((c) => deriveCaseDisplayFields(c).status === "running").length;
  const needsInputCount = cases.filter((c) => deriveCaseDisplayFields(c).status === "needs-input").length;
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

export function Dashboard() {
  const greeting = useGreeting();
  const { data: cases, isLoading } = useCasesList();

  const activeCases = (cases ?? []).filter((c) => c.status !== "archived");

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
              </>
            )}
          </p>
        </div>
        <Link
          to="/work/cases/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-zinc-950 text-white rounded-xl text-[13px] font-medium hover:bg-zinc-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Case
        </Link>
      </div>

      <WarmthSummary cases={activeCases} isLoading={isLoading} />
      <QuickStart />
      <AgentStrip cases={activeCases} />

      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 mb-3">Activity</h2>
        <div className="bg-white border border-zinc-200 rounded-2xl p-5">
          <ActivityFeed cases={activeCases} isLoading={isLoading} maxItems={10} />
        </div>
      </div>
    </div>
  );
}
