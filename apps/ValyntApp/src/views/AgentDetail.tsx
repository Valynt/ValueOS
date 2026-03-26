import { ArrowLeft, Bot } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useAgentInfo } from "@/hooks/useAgentMetrics";
import { cn } from "@/lib/utils";

const tabs = ["Runs", "Memory", "Configuration", "Permissions"] as const;
type AgentDetailTab = (typeof tabs)[number];

function EmptyTabState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
      {label} data is not available in this environment yet.
    </div>
  );
}

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<AgentDetailTab>("Runs");
  const agent = useAgentInfo(id ?? "");

  if (!agent) {
    return (
      <div className="p-6 lg:p-10">
        <Link to="/agents" className="inline-flex items-center gap-1.5 text-[13px] text-zinc-400 hover:text-zinc-700">
          <ArrowLeft className="h-4 w-4" />
          Agent Hub
        </Link>
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
          Agent not found.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 pb-4 pt-6 lg:px-10 lg:pt-10">
        <div className="mb-4 flex items-center gap-2">
          <Link to="/agents" className="flex items-center gap-1.5 text-[13px] text-zinc-400 hover:text-zinc-700">
            <ArrowLeft className="h-4 w-4" />
            Agent Hub
          </Link>
          <span className="text-zinc-300">/</span>
          <span className="text-[13px] font-medium text-zinc-700">{agent.name}</span>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-zinc-950">
            <Bot className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1">
            <div className="mb-1 flex items-center gap-3">
              <h1 className="tracking-[-0.05em] text-xl font-black text-zinc-950">{agent.name}</h1>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", agent.active ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600")}>
                {agent.active ? "Active" : "Inactive"}
              </span>
              <span className="text-[12px] text-zinc-400">{agent.version}</span>
            </div>
            <p className="max-w-2xl text-[13px] text-zinc-500">{agent.description}</p>
          </div>
        </div>
      </div>

      <div className="border-b border-zinc-200 px-6 lg:px-10">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "border-b-2 px-4 py-3 text-[13px] font-medium transition-colors",
                activeTab === tab ? "border-zinc-950 text-zinc-950" : "border-transparent text-zinc-400 hover:text-zinc-700"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 lg:p-10">
        {activeTab === "Runs" && <EmptyTabState label="Run history" />}
        {activeTab === "Memory" && <EmptyTabState label="Memory" />}
        {activeTab === "Configuration" && <EmptyTabState label="Configuration" />}
        {activeTab === "Permissions" && <EmptyTabState label="Permissions" />}
      </div>
    </div>
  );
}
