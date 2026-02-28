import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileSearch,
  RotateCcw,
  Shield,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

export function IntegrityStage() {
  const claims: Claim[] = [
    {
      id: "c1",
      text: "Annual revenue $2.4B with 8.2% YoY growth",
      tier: "Tier 1: EDGAR",
      source: "10-K FY2025 Filing",
      confidence: 98,
      status: "verified",
    },
    {
      id: "c2",
      text: "Infrastructure cost reduction of $1.8M through server consolidation",
      tier: "Tier 2: Market Data",
      source: "Gartner IT Spending Benchmark 2025",
      confidence: 72,
      status: "flagged",
      objection: "Server consolidation ratio of 4:1 exceeds industry average of 3:1. The $1.8M figure may be overstated by 15-20%.",
    },
    {
      id: "c3",
      text: "IT spend at 7.5% of revenue ($180M)",
      tier: "Tier 2: Market Data",
      source: "Gartner benchmark + customer estimate",
      confidence: 82,
      status: "verified",
      resolution: "Cross-referenced with Gartner Manufacturing IT Spending Report 2025. 7.5% is within the 6.8-8.2% range for manufacturing sector.",
    },
    {
      id: "c4",
      text: "APAC expansion will generate $2.1M in new revenue within 18 months",
      tier: "Tier 3: Self-reported",
      source: "Customer interview — VP of Strategy",
      confidence: 58,
      status: "flagged",
      objection: "Revenue projection is based on a single customer interview. No market sizing data or competitive analysis to support the $2.1M figure.",
    },
    {
      id: "c5",
      text: "Current uptime is 99.2%, target SLA requires 99.95%",
      tier: "Tier 1: Customer Data",
      source: "Customer SLA Dashboard Export",
      confidence: 95,
      status: "verified",
    },
    {
      id: "c6",
      text: "Migration can be completed in 12 months",
      tier: "Tier 3: Estimate",
      source: "Internal engineering assessment",
      confidence: 45,
      status: "pending",
    },
  ];

  const verified = claims.filter((c) => c.status === "verified").length;
  const flagged = claims.filter((c) => c.status === "flagged").length;
  const pending = claims.filter((c) => c.status === "pending").length;

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="flex items-center gap-1 p-1 bg-white border border-zinc-200 rounded-2xl">
        {[
          { label: "Total Claims", value: claims.length, color: "text-zinc-900" },
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
            <div className="w-24 h-2.5 bg-zinc-100 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: "76%" }} />
            </div>
            <span className="text-[14px] font-black text-zinc-950">76%</span>
          </div>
        </div>
        <p className="text-[12px] text-zinc-500">
          2 claims need attention before this case can advance to Narrative. Resolve flagged items to improve the integrity score.
        </p>
      </div>

      {/* Claims list */}
      <div>
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 mb-3">All Claims</h4>
        <div className="space-y-3">
          {claims.map((claim) => (
            <ClaimCard key={claim.id} claim={claim} />
          ))}
        </div>
      </div>
    </div>
  );
}
