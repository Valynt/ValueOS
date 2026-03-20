import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Play,
  Target,
} from "lucide-react";

import { useRealizationReport, useRunRealizationAgent } from "@/hooks/useRealization";
import { cn } from "@/lib/utils";

export function RealizationStage({ caseId }: { caseId?: string }) {
  const { data: report, isLoading, error } = useRealizationReport(caseId);
  const runAgent = useRunRealizationAgent(caseId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-[13px]">Loading realization report…</span>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Target className="w-8 h-8 text-foreground/80" />
        <p className="text-[13px] text-muted-foreground text-center max-w-xs">
          No realization plan yet. Run the Realization Agent to generate milestones, KPI targets, and risk analysis.
        </p>
        <button
          onClick={() => runAgent.mutate({})}
          disabled={runAgent.isPending || !caseId}
          className="flex items-center gap-2 px-4 py-2 bg-background text-white rounded-xl text-[12px] font-semibold hover:bg-surface-elevated disabled:opacity-50"
        >
          {runAgent.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          Run Realization Agent
        </button>
        {runAgent.error && (
          <p className="text-[11px] text-red-500">{runAgent.error.message}</p>
        )}
      </div>
    );
  }

  const milestones = report.milestones;
  const risks = report.risks;
  const kpiTargets = report.kpi_targets;

  return (
    <div className="space-y-5">
      {/* KPI targets */}
      {kpiTargets.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {kpiTargets.map((kpi) => {
            const pct = kpi.target_value > 0
              ? Math.min(100, Math.round((kpi.current_value / kpi.target_value) * 100))
              : 0;
            const onTrack = pct >= 50;
            return (
              <div key={kpi.kpi_name} className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] text-muted-foreground truncate pr-2">{kpi.kpi_name}</p>
                  {onTrack ? (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3" /> On Track
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full flex-shrink-0">
                      <AlertTriangle className="w-3 h-3" /> At Risk
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <p className="text-xl font-black text-zinc-950 tracking-tight">
                    {kpi.current_value}{kpi.unit}
                  </p>
                  <p className="text-[12px] text-muted-foreground">/ {kpi.target_value}{kpi.unit}</p>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", onTrack ? "bg-emerald-500" : "bg-amber-500")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Milestone timeline */}
      {milestones.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-amber-600" />
            <h4 className="text-[13px] font-semibold text-foreground">Milestone Timeline</h4>
            {report.implementation_timeline_weeks != null && (
              <span className="text-[11px] text-muted-foreground ml-auto">
                {report.implementation_timeline_weeks}w total
              </span>
            )}
          </div>
          <div className="space-y-0">
            {milestones.map((m, i) => {
              const isDone = m.status === "completed";
              const isCurrent = m.status === "in_progress";
              return (
                <div key={m.id} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "w-3 h-3 rounded-full border-2 flex-shrink-0",
                      isDone ? "bg-emerald-500 border-emerald-500" :
                      isCurrent ? "bg-amber-500 border-amber-500 animate-pulse" :
                      "bg-card border-border"
                    )} />
                    {i < milestones.length - 1 && (
                      <div className={cn("w-0.5 h-8", isDone ? "bg-emerald-300" : "bg-muted/70")} />
                    )}
                  </div>
                  <div className="pb-4 -mt-0.5">
                    <p className={cn(
                      "text-[13px] font-medium",
                      isDone ? "text-muted-foreground" :
                      isCurrent ? "text-foreground font-semibold" :
                      "text-muted-foreground"
                    )}>
                      {m.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{m.target_date} · {m.owner}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Risks */}
      {risks.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h4 className="text-[13px] font-semibold text-foreground">Active Risks</h4>
            <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {risks.length}
            </span>
          </div>
          <div className="space-y-2">
            {risks.map((r) => (
              <div
                key={r.id}
                className={cn(
                  "p-3 rounded-xl border-l-2",
                  r.impact === "high" ? "border-red-400 bg-red-50/50" : "border-amber-400 bg-amber-50/50"
                )}
              >
                <p className="text-[13px] text-foreground font-medium mb-1">{r.description}</p>
                <p className="text-[11px] text-muted-foreground">Mitigation: {r.mitigation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success criteria */}
      {report.success_criteria.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h4 className="text-[13px] font-semibold text-foreground mb-3">Success Criteria</h4>
          <div className="space-y-2">
            {report.success_criteria.map((criterion, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                <span className="text-[12px] text-muted-foreground">{criterion}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
