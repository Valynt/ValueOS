import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileSearch,
  Loader2,
  Play,
  RotateCcw,
  Shield,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useIntegrityResult, useRunIntegrityAgent } from "@/hooks/useIntegrity";

type ClaimStatus = "verified" | "flagged" | "rejected" | "pending";

interface Claim {
  id: string;
  text: string;
  tier: string;
  source: string;
  confidence: number;
  status: ClaimStatus;
  objection?: string;
  resolution?: string;
}

const statusConfig: Record<ClaimStatus, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  verified: { icon: CheckCircle2, color: "text-emerald-700", bg: "bg-emerald-50", label: "Verified" },
  flagged: { icon: AlertTriangle, color: "text-amber-700", bg: "bg-amber-50", label: "Flagged" },
  rejected: { icon: XCircle, color: "text-red-700", bg: "bg-red-50", label: "Rejected" },
  pending: { icon: Clock, color: "text-zinc-500", bg: "bg-zinc-100", label: "Pending" },
};

const tierConfig: Record<string, { color: string; bg: string }> = {
  "Tier 1": { color: "text-emerald-700", bg: "bg-emerald-50" },
  "Tier 2": { color: "text-blue-700", bg: "bg-blue-50" },
  "Tier 3": { color: "text-amber-700", bg: "bg-amber-50" },
};

function ClaimCard({ claim }: { claim: Claim }) {
  const st = statusConfig[claim.status];
  const StIcon = st.icon;
  const tierKey = claim.tier.split(":")[0] ?? "Tier 3";
  const tc = (tierConfig[tierKey] ?? tierConfig["Tier 3"])!;

  return (
    <div className={cn(
      "p-4 rounded-2xl border transition-colors",
      claim.status === "flagged" ? "border-amber-200 bg-amber-50/30" :
      claim.status === "rejected" ? "border-red-200 bg-red-50/30" :
      "border-zinc-200 bg-white"
    )}>
      {/* Header: status + tier + confidence */}
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
                claim.confidence >= 90 ? "bg-emerald-500" : claim.confidence >= 75 ? "bg-blue-500" : claim.confidence >= 50 ? "bg-amber-500" : "bg-red-400"
              )}
              style={{ width: `${claim.confidence}%` }}
            />
          </div>
          <span className="text-[11px] font-medium text-zinc-600">{claim.confidence}%</span>
        </div>
      </div>

      {/* Claim text */}
      <p className="text-[13px] text-zinc-800 font-medium mb-2">{claim.text}</p>

      {/* Source */}
      <div className="flex items-center gap-1.5 mb-3">
        <FileSearch className="w-3 h-3 text-zinc-400" />
        <span className="text-[11px] text-zinc-500">{claim.source}</span>
        <ExternalLink className="w-3 h-3 text-zinc-300 cursor-pointer hover:text-zinc-500" />
      </div>

      {/* Objection (if flagged) */}
      {claim.objection && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 mb-3">
          <p className="text-[11px] font-semibold text-amber-800 mb-1">Objection</p>
          <p className="text-[12px] text-amber-700">{claim.objection}</p>
        </div>
      )}

      {/* Resolution (if resolved) */}
      {claim.resolution && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 mb-3">
          <p className="text-[11px] font-semibold text-emerald-800 mb-1">Resolution</p>
          <p className="text-[12px] text-emerald-700">{claim.resolution}</p>
        </div>
      )}

      {/* Actions */}
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

export function IntegrityStage({ caseId }: { caseId?: string }) {
  const { data: result, isLoading, error } = useIntegrityResult(caseId);
  const runAgent = useRunIntegrityAgent(caseId);

  // Map API ClaimValidation → local Claim shape for the existing ClaimCard component
  const claims: Claim[] = (result?.claims ?? []).map((cv) => ({
    id: cv.claim_id,
    text: cv.claim_text,
    tier: "Tier 2: Agent",
    source: cv.evidence_assessment,
    confidence: Math.round(cv.confidence * 100),
    status:
      cv.verdict === "supported"
        ? "verified"
        : cv.verdict === "unsupported"
          ? "rejected"
          : cv.verdict === "partially_supported"
            ? "flagged"
            : "pending",
    objection: cv.issues.length > 0 ? cv.issues.map((i) => i.description).join(" ") : undefined,
    resolution: cv.suggested_fix,
  }));

  const verified = claims.filter((c) => c.status === "verified").length;
  const flagged = claims.filter((c) => c.status === "flagged").length;
  const pending = claims.filter((c) => c.status === "pending").length;
  const overallScore = result?.overall_score != null ? Math.round(result.overall_score * 100) : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-[13px]">Loading integrity results…</span>
      </div>
    );
  }

  if (error && !result) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Shield className="w-8 h-8 text-zinc-300" />
        <p className="text-[13px] text-zinc-500 text-center max-w-xs">
          No integrity analysis yet. Run the Integrity Agent to validate claims in this value case.
        </p>
        <button
          onClick={() => runAgent.mutate({})}
          disabled={runAgent.isPending || !caseId}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-950 text-white rounded-xl text-[12px] font-semibold hover:bg-zinc-800 disabled:opacity-50"
        >
          {runAgent.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          Run Integrity Agent
        </button>
        {runAgent.error && (
          <p className="text-[11px] text-red-500">{runAgent.error.message}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="flex items-center gap-1 p-1 bg-white border border-zinc-200 rounded-2xl">
        {[
          { label: "Total Claims", value: claims.length, color: "text-zinc-900", bg: undefined },
          { label: "Verified", value: verified, color: "text-emerald-700", bg: "bg-emerald-50" },
          { label: "Flagged", value: flagged, color: "text-amber-700", bg: "bg-amber-50" },
          { label: "Pending", value: pending, color: "text-zinc-500", bg: "bg-zinc-100" },
        ].map((s) => (
          <div key={s.label} className={cn("flex-1 text-center py-3 rounded-xl", s.bg)}>
            <p className={cn("text-lg font-black tracking-tight", s.color)}>{s.value}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Overall integrity score */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-zinc-600" />
            <h4 className="text-[13px] font-semibold text-zinc-900">Integrity Score</h4>
          </div>
          <div className="flex items-center gap-2">
            {overallScore != null && (
              <>
                <div className="w-24 h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      overallScore >= 80 ? "bg-emerald-500" : overallScore >= 60 ? "bg-amber-500" : "bg-red-400"
                    )}
                    style={{ width: `${overallScore}%` }}
                  />
                </div>
                <span className="text-[14px] font-black text-zinc-950">{overallScore}%</span>
              </>
            )}
            <button
              onClick={() => runAgent.mutate({})}
              disabled={runAgent.isPending || !caseId}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 rounded-lg text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
            >
              {runAgent.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RotateCcw className="w-3 h-3" />
              )}
              Re-run
            </button>
          </div>
        </div>
        {result?.veto_decision && (
          <p className={cn(
            "text-[12px] font-medium",
            result.veto_decision === "pass" ? "text-emerald-600" :
            result.veto_decision === "veto" ? "text-red-600" : "text-amber-600"
          )}>
            Decision: {result.veto_decision === "pass" ? "Pass — ready to advance" :
              result.veto_decision === "veto" ? "Veto — case blocked" : "Re-refine required"}
          </p>
        )}
      </div>

      {/* Claims list */}
      {claims.length > 0 && (
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 mb-3">All Claims</h4>
          <div className="space-y-3">
            {claims.map((claim) => (
              <ClaimCard key={claim.id} claim={claim} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
