import {
  CheckCircle2,
  Shield,
  ArrowUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function AgentThread() {
  const steps = [
    { agent: "Opportunity Agent", action: "Fetched 10-K from EDGAR", status: "done" as const, time: "2m" },
    { agent: "Opportunity Agent", action: "Extracted financial metrics", status: "done" as const, time: "1m" },
    { agent: "Research Agent", action: "Competitive landscape analysis", status: "done" as const, time: "3m" },
    { agent: "Integrity Agent", action: "Verified revenue claims", status: "done" as const, time: "30s" },
    { agent: "Integrity Agent", action: "Flagged server consolidation ratio", status: "done" as const, time: "15s" },
    { agent: "Target Agent", action: "Building value tree...", status: "running" as const, time: "—" },
  ];

  return (
    <div className="space-y-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Agent Workflow</h4>
      <div className="space-y-2">
        {steps.map((s, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50">
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
              s.status === "done" ? "bg-emerald-100" : "bg-blue-100"
            )}>
              {s.status === "done" ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-zinc-700">{s.action}</p>
              <p className="text-[11px] text-zinc-400">{s.agent} &middot; {s.time}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Human checkpoint */}
      <div className="p-4 rounded-2xl border-2 border-amber-300 bg-amber-50/50">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-amber-600" />
          <span className="text-[12px] font-semibold text-amber-800">Approval Required</span>
        </div>
        <p className="text-[12px] text-amber-700 mb-3">
          Value tree includes projected savings of $1.8M. Confirm before proceeding to narrative generation.
        </p>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 bg-zinc-950 text-white rounded-lg text-[12px] font-medium hover:bg-zinc-800">
            Approve
          </button>
          <button className="px-3 py-1.5 border border-zinc-300 text-zinc-700 rounded-lg text-[12px] font-medium hover:bg-zinc-50">
            Request Changes
          </button>
        </div>
      </div>

      {/* Agent input */}
      <div className="flex items-end gap-2 bg-white border border-zinc-200 rounded-2xl p-2 mt-4">
        <textarea
          placeholder="Ask the agent about this case..."
          rows={1}
          className="flex-1 resize-none bg-transparent px-3 py-2 text-[13px] text-zinc-900 placeholder:text-zinc-400 placeholder:italic placeholder:font-light outline-none"
        />
        <button className="w-9 h-9 bg-zinc-950 rounded-full flex items-center justify-center flex-shrink-0 hover:bg-zinc-800">
          <ArrowUp className="w-3.5 h-3.5 text-white" />
        </button>
      </div>
    </div>
  );
}
