import {
  AlertTriangle,
  ExternalLink,
  Shield,
  X,
} from "lucide-react";

import { useIntegrityOutput } from "@/hooks/useIntegrityOutput";
import { cn } from "@/lib/utils";

export function EvidenceDrawer({ open, onClose, caseId }: { open: boolean; onClose: () => void; caseId?: string }) {
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
        {claims.map((c, i) => (
          <div key={i} className="p-4 rounded-2xl border border-zinc-200 hover:border-zinc-300 transition-colors">
            <p className="text-[13px] font-medium text-zinc-900 mb-2">{c.text}</p>
            <div className="flex items-center gap-2 mb-2">
              <span className={cn(
                "text-[10px] px-2 py-0.5 rounded-full font-semibold",
                c.evidence_tier === 1 ? "bg-emerald-50 text-emerald-700" :
                c.evidence_tier === 2 ? "bg-blue-50 text-blue-700" :
                "bg-amber-50 text-amber-700"
              )}>
                {`Tier ${c.evidence_tier ?? 3}`}
              </span>
              <span className="text-[11px] text-zinc-400">{c.claim_id}</span>
              <ExternalLink className="w-3 h-3 text-zinc-300 cursor-pointer hover:text-zinc-500 ml-auto" />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    c.confidence_score >= 0.9 ? "bg-emerald-500" : c.confidence_score >= 0.75 ? "bg-blue-500" : c.confidence_score >= 0.5 ? "bg-amber-500" : "bg-red-400"
                  )}
                  style={{ width: `${Math.round(c.confidence_score * 100)}%` }}
                />
              </div>
              <span className="text-[11px] font-medium text-zinc-600">{Math.round(c.confidence_score * 100)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
