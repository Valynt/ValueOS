import {
  AlertTriangle,
  ExternalLink,
  Shield,
  X,
} from "lucide-react";

import { useIntegrityOutput, type IntegrityClaim } from "@/hooks/useIntegrityOutput";
import { cn } from "@/lib/utils";

interface EvidenceDrawerProps {
  open: boolean;
  onClose: () => void;
  caseId?: string;
}

function getClaimUrl(claim: IntegrityClaim): string | null {
  if (typeof claim.source_url === "string" && claim.source_url.length > 0) {
    return claim.source_url;
  }

  if (Array.isArray(claim.source_urls)) {
    const firstUrl = claim.source_urls.find((url) => typeof url === "string" && url.length > 0);
    if (firstUrl) return firstUrl;
  }

  const provenance = claim.provenance;
  if (provenance && typeof provenance === "object") {
    const provenanceRecord = provenance as Record<string, unknown>;
    const directUrl = provenanceRecord.source_url;
    if (typeof directUrl === "string" && directUrl.length > 0) {
      return directUrl;
    }

    const provenanceSources = provenanceRecord.sources;
    if (Array.isArray(provenanceSources)) {
      for (const source of provenanceSources) {
        if (source && typeof source === "object") {
          const sourceRecord = source as Record<string, unknown>;
          const candidateUrl = sourceRecord.url;
          if (typeof candidateUrl === "string" && candidateUrl.length > 0) {
            return candidateUrl;
          }
        }
      }
    }
  }

  return null;
}

export function EvidenceDrawer({ open, onClose, caseId }: EvidenceDrawerProps) {
  const { data, isLoading, error } = useIntegrityOutput(caseId);
  if (!open) return null;

  const claims = data?.claims ?? [];

  return (
    <div className="fixed inset-y-0 right-0 w-[400px] bg-white border-l border-zinc-200 z-30 flex flex-col shadow-[-20px_0_40px_-10px_rgba(0,0,0,0.06)]">
      <div className="h-14 flex items-center justify-between px-5 border-b border-zinc-200">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-zinc-600" />
          <span className="text-[13px] font-semibold text-zinc-900">Evidence & Provenance</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 font-medium">
            {claims.length} claims
          </span>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100">
          <X className="w-4 h-4 text-zinc-400" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {!caseId && (
          <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50 text-[12px] text-amber-800">
            Evidence is unavailable until the value case ID is resolved.
          </div>
        )}
        {error && (
          <div className="p-4 rounded-2xl border border-red-200 bg-red-50">
            <div className="flex items-center gap-2 text-red-700 mb-1">
              <AlertTriangle className="w-4 h-4" />
              <p className="text-[12px] font-semibold">Evidence integration failure</p>
            </div>
            <p className="text-[12px] text-red-700">{error.message}</p>
          </div>
        )}
        {isLoading && (
          <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50 text-[12px] text-zinc-600">
            Loading evidence from Integrity output…
          </div>
        )}
        {!isLoading && !error && claims.length === 0 && (
          <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50 text-[12px] text-zinc-600">
            No evidence claims were returned by orchestration for this case.
          </div>
        )}
        {claims.map((claim, index) => {
          const evidenceTier = typeof claim.evidence_tier === "number" ? claim.evidence_tier : null;
          const confidenceScore = typeof claim.confidence_score === "number" ? claim.confidence_score : null;
          const claimId = typeof claim.claim_id === "string" && claim.claim_id.length > 0 ? claim.claim_id : "Unknown claim ID";
          const sourceUrl = getClaimUrl(claim);

          return (
            <div key={claim.claim_id ?? index} className="p-4 rounded-2xl border border-zinc-200 hover:border-zinc-300 transition-colors">
              <p className="text-[13px] font-medium text-zinc-900 mb-2">{claim.text}</p>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-semibold",
                    evidenceTier === 1
                      ? "bg-emerald-50 text-emerald-700"
                      : evidenceTier === 2
                        ? "bg-blue-50 text-blue-700"
                        : "bg-amber-50 text-amber-700",
                  )}
                >
                  {evidenceTier == null ? "Tier unavailable" : `Tier ${evidenceTier}`}
                </span>
                <span className="text-[11px] text-zinc-400">{claimId}</span>
                {sourceUrl ? (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open provenance source for ${claimId}`}
                    className="ml-auto"
                  >
                    <ExternalLink className="w-3 h-3 text-zinc-500 hover:text-zinc-700" />
                  </a>
                ) : (
                  <span
                    aria-label={`No provenance source for ${claimId}`}
                    className="ml-auto"
                    title="No provenance source available"
                  >
                    <ExternalLink className="w-3 h-3 text-zinc-300" />
                  </span>
                )}
              </div>
              {confidenceScore == null ? (
                <p className="text-[11px] text-zinc-500">Confidence unavailable</p>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        confidenceScore >= 0.9
                          ? "bg-emerald-500"
                          : confidenceScore >= 0.75
                            ? "bg-blue-500"
                            : confidenceScore >= 0.5
                              ? "bg-amber-500"
                              : "bg-red-400",
                      )}
                      style={{ width: `${Math.round(confidenceScore * 100)}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-medium text-zinc-600">{Math.round(confidenceScore * 100)}%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
