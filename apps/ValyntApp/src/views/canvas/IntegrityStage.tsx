import { RotateCcw, Shield, XCircle } from "lucide-react";


import { ClaimCard } from "./integrity/ClaimCard";
import { IntegrityEmptyState } from "./integrity/IntegrityEmptyState";
import { IntegrityLoading } from "./integrity/IntegrityLoading";
import { toDisplayClaim } from "./integrity/integrityUtils";

import { useTenant } from "@/contexts/TenantContext";
import { useIntegrityOutput } from "@/hooks/useIntegrityOutput";
import { cn } from "@/lib/utils";

interface IntegrityStageProps {
  caseId?: string;
}

export function IntegrityStage({ caseId }: IntegrityStageProps) {
  const { currentTenant } = useTenant();
  const organizationId = currentTenant?.id;
  const { data, isLoading, runAgent, isRunning } = useIntegrityOutput(caseId);

  if (isLoading) return <IntegrityLoading />;

  if (!data) {
    return (
      <IntegrityEmptyState
        onRun={() => organizationId && runAgent(organizationId)}
        isRunning={isRunning}
      />
    );
  }

  const claims = data.claims.map(toDisplayClaim);
  const verified = claims.filter((c) => c.status === "verified").length;
  const flagged  = claims.filter((c) => c.status === "flagged").length;
  const pending  = claims.filter((c) => c.status === "pending").length;
  const score    = data.overall_confidence != null
    ? Math.round(data.overall_confidence * 100)
    : null;

  return (
    <div className="space-y-5">
      {/* Veto banner */}
      {data.veto_triggered && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-200">
          <XCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-[13px] font-semibold text-red-900">Veto triggered</p>
            {data.veto_reason && (
              <p className="text-[12px] text-red-700 mt-0.5">{data.veto_reason}</p>
            )}
          </div>
        </div>
      )}

      {/* Summary counts */}
      <div className="flex items-center gap-1 p-1 bg-card border border-border rounded-2xl">
        {[
          { label: "Total Claims", value: claims.length, color: "text-foreground",   bg: undefined         },
          { label: "Verified",     value: verified,       color: "text-emerald-700", bg: "bg-emerald-50" },
          { label: "Flagged",      value: flagged,        color: "text-amber-700",   bg: "bg-amber-50"   },
          { label: "Pending",      value: pending,        color: "text-muted-foreground",    bg: "bg-muted"   },
        ].map((s) => (
          <div key={s.label} className={cn("flex-1 text-center py-3 rounded-xl", s.bg)}>
            <p className={cn("text-lg font-black tracking-tight", s.color)}>{s.value}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Integrity score */}
      {score != null && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <h4 className="text-[13px] font-semibold text-foreground">Integrity Score</h4>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-400",
                  )}
                  style={{ width: `${score}%` }}
                />
              </div>
              <span className="text-[14px] font-black text-zinc-950">{score}%</span>
            </div>
          </div>
          {flagged > 0 && (
            <p className="text-[12px] text-muted-foreground">
              {flagged} claim{flagged > 1 ? "s" : ""} need attention before this case can advance.
            </p>
          )}
        </div>
      )}

      {/* Re-run */}
      <div className="flex justify-end">
        <button
          onClick={() => organizationId && runAgent(organizationId)}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-xl text-[11px] font-medium text-muted-foreground hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RotateCcw className={cn("w-3 h-3", isRunning && "animate-spin")} />
          {isRunning ? "Running…" : "Re-run Agent"}
        </button>
      </div>

      {/* Claims list */}
      <div>
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
          All Claims
        </h4>
        <div className="space-y-3">
          {claims.map((claim) => (
            <ClaimCard key={claim.id} claim={claim} />
          ))}
        </div>
      </div>
    </div>
  );
}
