import { ArrowLeft, Bot, Brain, CheckCircle2, Clock, DollarSign, Search, Wrench, XCircle } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { cn } from "@/lib/utils";

const agent = {
  id: "opportunity",
  name: "Opportunity Agent",
  type: "discovery",
  version: "v2.3",
  active: true,
  description: "Identifies and analyzes business opportunities from EDGAR filings, news, and market data. Uses ground truth verification for all financial claims.",
};

// Run history and memory items are fetched from the agent API by agent ID.
// These empty arrays will be replaced by data from useAgentRuns(id) and useAgentMemory(id).
const runs: Array<{ id: string; status: string; input: string; duration: string; cost: string; tokens: string; timestamp: string; caseId: string }> = [];
const memoryItems: Array<{ type: string; content: string; source: string; confidence: number; timestamp: string }> = [];

const tools = [
  { name: "edgar_search", description: "Search SEC EDGAR filings", scope: "read" },
  { name: "market_data", description: "Query market data providers", scope: "read" },
  { name: "crm_read", description: "Read CRM opportunity data", scope: "read" },
  { name: "memory_write", description: "Store facts to semantic memory", scope: "write" },
  { name: "sdui_emit", description: "Emit SDUI component updates", scope: "write" },
];

const tabs = ["Runs", "Memory", "Configuration", "Permissions"];

export default function AgentDetail() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState("Runs");

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 lg:px-10 pt-6 lg:pt-10 pb-4">
        <div className="flex items-center gap-2 mb-4">
          <Link to="/agents" className="flex items-center gap-1.5 text-[13px] text-zinc-400 hover:text-zinc-700">
            <ArrowLeft className="w-4 h-4" />
            Agent Hub
          </Link>
          <span className="text-zinc-300">/</span>
          <span className="text-[13px] text-zinc-700 font-medium">{agent.name}</span>
        </div>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-zinc-950 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Bot className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-black text-zinc-950 tracking-[-0.05em]">{agent.name}</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">Active</span>
              <span className="text-[12px] text-zinc-400">{agent.version}</span>
            </div>
            <p className="text-[13px] text-zinc-500 max-w-2xl">{agent.description}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 lg:px-10 border-b border-zinc-200">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-3 text-[13px] font-medium border-b-2 transition-colors",
                activeTab === tab
                  ? "border-zinc-950 text-zinc-950"
                  : "border-transparent text-zinc-400 hover:text-zinc-700"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "Runs" && (
          <div className="p-6 lg:p-10 max-w-[1200px] space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 bg-white flex-1 max-w-xs">
                <Search className="w-4 h-4 text-zinc-400" />
                <input type="text" placeholder="Search runs..." className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-zinc-400" />
              </div>
            </div>
            <div className="space-y-2">
              {runs.map((run) => (
                <div key={run.id} className="bg-white border border-zinc-200 rounded-2xl p-4 hover:border-zinc-300 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                      run.status === "success" ? "bg-emerald-50" : "bg-red-50"
                    )}>
                      {run.status === "success" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-zinc-900">{run.input}</p>
                      <p className="text-[11px] text-zinc-400">{run.id} &middot; {run.caseId}</p>
                    </div>
                    <div className="flex items-center gap-5 flex-shrink-0">
                      <div className="text-right">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-zinc-400" />
                          <span className="text-[12px] text-zinc-600">{run.duration}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3 text-zinc-400" />
                          <span className="text-[12px] text-zinc-600">{run.cost}</span>
                        </div>
                      </div>
                      <span className="text-[11px] text-zinc-400 w-12 text-right">{run.timestamp}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "Memory" && (
          <div className="p-6 lg:p-10 max-w-[1000px] space-y-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 bg-white max-w-sm mb-4">
              <Search className="w-4 h-4 text-zinc-400" />
              <input type="text" placeholder="Search memory..." className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-zinc-400" />
            </div>
            <div className="space-y-3">
              {memoryItems.map((item, i) => (
                <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                      item.type === "fact" ? "bg-blue-50" : "bg-violet-50"
                    )}>
                      <Brain className={cn("w-4 h-4", item.type === "fact" ? "text-blue-600" : "text-violet-600")} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] text-zinc-900">{item.content}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize",
                          item.type === "fact" ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"
                        )}>
                          {item.type}
                        </span>
                        <span className="text-[11px] text-zinc-400">{item.source}</span>
                        <span className="text-[11px] text-zinc-400">{item.confidence}% confidence</span>
                        <span className="text-[11px] text-zinc-400 ml-auto">{item.timestamp}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "Configuration" && (
          <div className="p-6 lg:p-10 max-w-[800px]">
            <div className="bg-white border border-zinc-200 rounded-2xl p-5">
              <h3 className="text-[13px] font-semibold text-zinc-900 mb-4">Agent Configuration</h3>
              <pre className="bg-zinc-50 rounded-xl p-4 text-[12px] font-mono text-zinc-700 overflow-x-auto">
{JSON.stringify({
  agent_id: "opportunity",
  model: "together/meta-llama/Llama-3-70b-chat-hf",
  temperature: 0.3,
  max_tokens: 4096,
  system_prompt: "You are the Opportunity Agent for ValueOS...",
  safety: { max_input_length: 10000, blocked_patterns: ["DROP TABLE", "DELETE FROM"], pii_detection: true },
  budget: { max_cost_per_run: 1.00, max_tokens_per_run: 50000 },
}, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {activeTab === "Permissions" && (
          <div className="p-6 lg:p-10 max-w-[800px] space-y-4">
            <h3 className="text-[13px] font-semibold text-zinc-900">Available Tools</h3>
            <div className="space-y-2">
              {tools.map((tool) => (
                <div key={tool.name} className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center">
                    <Wrench className="w-4 h-4 text-zinc-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-mono font-medium text-zinc-900">{tool.name}</p>
                    <p className="text-[12px] text-zinc-500">{tool.description}</p>
                  </div>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-semibold",
                    tool.scope === "read" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
                  )}>
                    {tool.scope}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
