import { ExternalLink, FileSearch, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";

import { type DisplayClaim, statusConfig, tierColorMap } from "./integrityUtils";

import { cn } from "@/lib/utils";


interface ClaimCardProps {
  claim: DisplayClaim;
}

export function ClaimCard({ claim }: ClaimCardProps) {
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
          : "border-border bg-card",
      )}
    >
      {/* Status badge + tier + confidence */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold",
              st.color,
              st.bg,
            )}
          >
            <StIcon className="w-3 h-3" />
            <span>{st.label}</span>
          </div>
          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", tc.color, tc.bg)}>
            {claim.tier}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
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
          <span className="text-[11px] font-medium text-muted-foreground">{claim.confidence}%</span>
        </div>
      </div>

      {/* Claim text */}
      <p className="text-[13px] text-foreground font-medium mb-2">{claim.text}</p>

      {/* Evidence tier label */}
      <div className="flex items-center gap-1.5 mb-3">
        <FileSearch className="w-3 h-3 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">{claim.tier}</span>
        <ExternalLink className="w-3 h-3 text-foreground/80 cursor-pointer hover:text-muted-foreground" />
      </div>

      {/* Objection (flagged claims only) */}
      {claim.objection && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 mb-3">
          <p className="text-[11px] font-semibold text-amber-800 mb-1">Objection</p>
          <p className="text-[12px] text-amber-700">{claim.objection}</p>
        </div>
      )}

      {/* Actions (flagged claims only) */}
      {claim.status === "flagged" && (
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-background text-white rounded-lg text-[11px] font-medium hover:bg-surface-elevated">
            <RotateCcw className="w-3 h-3" />
            Revise Claim
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-[11px] font-medium text-muted-foreground hover:bg-surface">
            <ThumbsUp className="w-3 h-3" />
            Override
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-[11px] font-medium text-muted-foreground hover:bg-surface">
            <ThumbsDown className="w-3 h-3" />
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
