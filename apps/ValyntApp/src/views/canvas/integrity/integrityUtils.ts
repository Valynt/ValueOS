import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";

import type { IntegrityClaim } from "@/hooks/useIntegrityOutput";

// ---------------------------------------------------------------------------
// Display types — shared across all Integrity sub-components
// ---------------------------------------------------------------------------

export type ClaimStatus = "verified" | "flagged" | "rejected" | "pending";

export interface DisplayClaim {
  id: string;
  text: string;
  tier: string;
  confidence: number;
  status: ClaimStatus;
  objection?: string;
}

export interface StatusConfig {
  icon: LucideIcon;
  color: string;
  bg: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Domain mapping
// ---------------------------------------------------------------------------

export function toDisplayClaim(c: IntegrityClaim): DisplayClaim {
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
// Status and tier display config
// ---------------------------------------------------------------------------

export const statusConfig: Record<ClaimStatus, StatusConfig> = {
  verified: { icon: CheckCircle2, color: "text-emerald-700", bg: "bg-emerald-50", label: "Verified" },
  flagged:  { icon: AlertTriangle, color: "text-amber-700",  bg: "bg-amber-50",   label: "Flagged"  },
  rejected: { icon: XCircle,       color: "text-red-700",    bg: "bg-red-50",     label: "Rejected" },
  pending:  { icon: Clock,         color: "text-zinc-500",   bg: "bg-zinc-100",   label: "Pending"  },
};

export const tierColorMap: Record<string, { color: string; bg: string }> = {
  "Tier 1": { color: "text-emerald-700", bg: "bg-emerald-50" },
  "Tier 2": { color: "text-blue-700",    bg: "bg-blue-50"    },
  "Tier 3": { color: "text-amber-700",   bg: "bg-amber-50"   },
};
