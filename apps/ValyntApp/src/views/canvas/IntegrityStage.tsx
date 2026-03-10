import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileSearch,
  Play,
  RotateCcw,
  Shield,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useTenant } from "@/contexts/TenantContext";
import type { LucideIcon } from "lucide-react";
import {
  useIntegrityOutput,
  type IntegrityClaim,
} from "@/hooks/useIntegrityOutput";

// ---------------------------------------------------------------------------
// Display types
// ---------------------------------------------------------------------------

type ClaimStatus = "verified" | "flagged" | "rejected" | "pending";

interface DisplayClaim {
  id: string;
  text: string;
  tier: string;
  confidence: number;
  status: ClaimStatus;
  objection?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDisplayClaim(c: IntegrityClaim): DisplayClaim {
  const tierLabel = c.evidence_tier != null ? `Tier ${c.evidence_tier}` : "Tier 3";
  const status: ClaimStatus = c.flagged ? "flagged" : "verified";
  return {
    id: c.claim_id,
    text: c.text,
    tier: tierLabel,
    confidence: Math.round(c.confidence_score * 100),
    status,
    objection: c.flag_reason,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const statusConfig: Record<
  ClaimStatus,
  { icon: LucideIcon; color: string; bg: string; label: string }
> = {
  verified: { icon: CheckCircle2, color: "text-emerald-700", bg: "bg-emerald-50", label: "Verified" },
  flagged: { icon: AlertTriangle, color: "text-amber-700", bg: "bg-amber-50", label: "Flagged" },
  rejected: { icon: XCircle, color: "text-red-700", bg: "bg-red-50", label: "Rejected" },
  pending: { icon: Clock, color: "text-zinc-500", bg: "bg-zinc-100", label: "Pending" },
};

const tierColorMap: Record<string, { color: string; bg: string }> = {
  "Tier 1": { color: "text-emerald-700", bg: "bg-emerald-50" },
  "Tier 2": { color: "text-blue-700", bg: "bg-blue-50" },
  "Tier 3": { color: "text-amber-700", bg: "bg-amber-50" },
};

function ClaimCard({ claim }: { claim: DisplayClaim }) {
  const st = statusConfig[claim.status];
  const StIcon = st.icon;
  const tierKey = claim.tier.split(":")[0]?.trim() ?? "Tier 3";
  const tc = tierColorMap[tierKey] ?? tierColorMap["Tier 3"]!;

  return (
    <div
      className={cn(
        "p-4 rounded-2xl border transition-colors",
        claim.status === "flagged"
          ? "border-amber-200 bg-amber-50/30"
          : claim.status === "rejected"
          ? "border-red-200 bg-red-50/30"
          : "border-zinc-200 bg-white",
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold", st.color, st.bg)}>
            <StIcon className="w-3 h-3" />
            <span>{st.label}</span>
          </div>
          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", tc.color, tc.bg)}>
            {claim.tier}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-12 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full",
                claim.confidence >= 90 ? "bg-emerald-500"
                  : claim.confidence >= 75 ? "bg-blue-500"
                  : claim.confidence >= 50 ? "bg-amber-500"
                  : "bg-red-400",
              )}
              style={{ width: `${claim.confidence}%` }}
            />
          </div>
          <span className="text-[11px] font-medium text-zinc-600">{claim.confidence}%</span>
        </div>
      </div>

      <p className="text-[13px] text-zinc-800 font-medium mb-2">{claim.text}</p>

      <div className="flex items-center gap-1.5 mb-3">
        <FileSearch className="w-3 h-3 text-zinc-400" />
        <span className="text-[11px] text-zinc-500">{claim.tier}</span>
        <ExternalLink className="w-3 h-3 text-zinc-300 cursor-pointer hover:text-zinc-500" />
      </div>

      {claim.objection && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 mb-3">
          <p className="text-[11px] font-semibold text-amber-800 mb-1">Objection</p>
          <p className="text-[12px] text-amber-700">{claim.objection}</p>
        </div>
      )}

      {claim.status === "flagged" && (
        <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 text-white rounded-lg text-[11px] font-medium hover:bg-zinc-800">
            <RotateCcw className="w-3 h-3" />
            Revise Claim
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 rounded-lg text-[11px] font-medium text-zinc-600 hover:bg-zinc-50">
            <ThumbsUp className="w-3 h-3" />
            Override
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 rounded-lg text-[11px] font-medium text-zinc-600 hover:bg-zinc-50">
            <ThumbsDown className="w-3 h-3" />
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-16 bg-zinc-100 rounded-2xl" />
      <div className="h-20 bg-zinc-100 rounded-2xl" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-28 bg-zinc-100 rounded-2xl" />
      ))}
    </div>
  );
}

function EmptyState({ onRun, isRunning }: { onRun: () => void; isRunning: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center">
        <Shield className="w-6 h-6 text-zinc-400" />
      </div>
      <div>
        <p className="text-[14px] font-semibold text-zinc-900">No integrity analysis yet</p>
        <p className="text-[12px] text-zinc-500 mt-1">
          Run the Integrity agent to validate your claims
        </p>
      </div>
      <button
        onClick={onRun}
        disabled={isRunning}
        className="flex items-center gap-2 px-4 py-2 bg-zinc-950 text-white rounded-xl text-[12px] font-medium hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Play className="w-3.5 h-3.5" />
        {isRunning ? "Running…" : "Run Integrity Agent"}
      </button>
    </div>
  );
}

function VetoBanner({ reason }: { reason: string | null }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-200">
      <XCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
      <div>
        <p className="text-[13px] font-semibold text-red-900">Veto triggered</p>
        {reason && <p className="text-[12px] text-red-700 mt-0.5">{reason}</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface IntegrityStageProps {
  caseId?: string;
}

export function IntegrityStage({ caseId }: IntegrityStageProps) {
  const { currentTenant } = useTenant();
  const organizationId = currentTenant?.id;
  const { data, isLoading, runAgent, isRunning } = useIntegrityOutput(caseId);

  if (isLoading) return <LoadingSkeleton />;

  if (!data) {
    return (
      <EmptyState
        onRun={() => organizationId && runAgent(organizationId)}
        isRunning={isRunning}
      />
    );
  }

  const claims = data.claims.map(toDisplayClaim);
  const verified = claims.filter((c) => c.status === "verified").length;
  const flagged = claims.filter((c) => c.status === "flagged").length;
  const pending = claims.filter((c) => c.status === "pending").length;
  const scorePercent =
    data.overall_confidence != null ? Math.round(data.overall_confidence * 100) : null;

  return (
    <div className="space-y-5">
      {data.veto_triggered && <VetoBanner reason={data.veto_reason} />}

      <div className="flex items-center gap-1 p-1 bg-white border border-zinc-200 rounded-2xl">
        {[
          { label: "Total Claims", value: claims.length, color: "text-zinc-900", bg: undefined },
          { label: "Verified", value: verified, color: "text-emerald-700", bg: "bg-emerald-50" },
          { label: "Flagged", value: flagged, color: "text-amber-700", bg: "bg-amber-50" },
          { label: "Pending", value: pending, color: "text-zinc-500", bg: "bg-zinc-100" },
        ].map((s) => (
          <div key={s.label} className={cn("flex-1 text-center py-3 rounded-xl", s.bg)}>
            <p className={cn("text-lg font-black tracking-tight", s.color)}>{s.value}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {scorePercent != null && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-zinc-600" />
              <h4 className="text-[13px] font-semibold text-zinc-900">Integrity Score</h4>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    scorePercent >= 80 ? "bg-emerald-500"
                      : scorePercent >= 60 ? "bg-amber-500"
                      : "bg-red-400",
                  )}
                  style={{ width: `${scorePercent}%` }}
                />
              </div>
              <span className="text-[14px] font-black text-zinc-950">{scorePercent}%</span>
            </div>
          </div>
          {flagged > 0 && (
            <p className="text-[12px] text-zinc-500">
              {flagged} claim{flagged > 1 ? "s" : ""} need attention before this case can advance.
              Resolve flagged items to improve the integrity score.
            </p>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => organizationId && runAgent(organizationId)}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 rounded-xl text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RotateCcw className={cn("w-3 h-3", isRunning && "animate-spin")} />
          {isRunning ? "Running…" : "Re-run Agent"}
        </button>
      </div>

      <div>
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 mb-3">
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
