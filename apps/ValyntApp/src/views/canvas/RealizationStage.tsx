import {
  AlertTriangle,
  CheckCircle2,
  Target,
} from "lucide-react";

import { cn } from "@/lib/utils";

export function RealizationStage() {
  const kpis = [
    { label: "Value Delivered", current: "$2.1M", target: "$4.2M", pct: 50, trend: "up" as const, onTrack: true },
    { label: "KPIs On Track", current: "6/8", target: "8/8", pct: 75, trend: "up" as const, onTrack: true },
    { label: "Milestones Hit", current: "4/7", target: "7/7", pct: 57, trend: "flat" as const, onTrack: false },
    { label: "Time Elapsed", current: "6mo", target: "12mo", pct: 50, trend: "up" as const, onTrack: true },
  ];

  const milestones = [
    { label: "Phase 1: Assessment Complete", date: "Jan 15", status: "done" as const },
    { label: "Phase 2: Pilot Migration (50 servers)", date: "Mar 1", status: "done" as const },
    { label: "Phase 3: Production Migration Wave 1", date: "May 15", status: "done" as const },
    { label: "Phase 4: Production Migration Wave 2", date: "Jul 30", status: "current" as const },
    { label: "Phase 5: Legacy Decommission", date: "Oct 1", status: "upcoming" as const },
    { label: "Phase 6: Optimization & Expansion", date: "Dec 1", status: "upcoming" as const },
    { label: "Phase 7: Final Value Assessment", date: "Jan 15", status: "upcoming" as const },
  ];

  const risks = [
    { label: "Wave 2 migration delayed by 2 weeks due to data dependency", severity: "medium" as const, mitigation: "Parallel migration path identified" },
    { label: "License renegotiation pending — VMware renewal in 45 days", severity: "high" as const, mitigation: "Procurement team engaged" },
  ];

  return (
    <div className="space-y-5">
      {/* KPI summary */}
      <div className="grid grid-cols-2 gap-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white border border-zinc-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] text-zinc-400">{kpi.label}</p>
              {kpi.onTrack ? (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> On Track
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                  <AlertTriangle className="w-3 h-3" /> At Risk
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <p className="text-xl font-black text-zinc-950 tracking-tight">{kpi.current}</p>
              <p className="text-[12px] text-zinc-400">/ {kpi.target}</p>
            </div>
            <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  kpi.onTrack ? "bg-emerald-500" : "bg-amber-500"
                )}
                style={{ width: `${kpi.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Milestone timeline */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-amber-600" />
          <h4 className="text-[13px] font-semibold text-zinc-900">Milestone Timeline</h4>
        </div>
        <div className="space-y-0">
          {milestones.map((m, i) => (
            <div key={m.label} className="flex items-start gap-3">
              {/* Timeline line + dot */}
              <div className="flex flex-col items-center">
                <div className={cn(
                  "w-3 h-3 rounded-full border-2 flex-shrink-0",
                  m.status === "done" ? "bg-emerald-500 border-emerald-500" :
                  m.status === "current" ? "bg-amber-500 border-amber-500 animate-pulse" :
                  "bg-white border-zinc-300"
                )} />
                {i < milestones.length - 1 && (
                  <div className={cn(
                    "w-0.5 h-8",
                    m.status === "done" ? "bg-emerald-300" : "bg-zinc-200"
                  )} />
                )}
              </div>
              {/* Content */}
              <div className="pb-4 -mt-0.5">
                <p className={cn(
                  "text-[13px] font-medium",
                  m.status === "done" ? "text-zinc-500" :
                  m.status === "current" ? "text-zinc-900 font-semibold" :
                  "text-zinc-400"
                )}>
                  {m.label}
                </p>
                <p className="text-[11px] text-zinc-400">{m.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Risks */}
      {risks.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h4 className="text-[13px] font-semibold text-zinc-900">Active Risks</h4>
            <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {risks.length}
            </span>
          </div>
          <div className="space-y-2">
            {risks.map((r) => (
              <div
                key={r.label}
                className={cn(
                  "p-3 rounded-xl border-l-2",
                  r.severity === "high" ? "border-red-400 bg-red-50/50" : "border-amber-400 bg-amber-50/50"
                )}
              >
                <p className="text-[13px] text-zinc-800 font-medium mb-1">{r.label}</p>
                <p className="text-[11px] text-zinc-500">Mitigation: {r.mitigation}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
