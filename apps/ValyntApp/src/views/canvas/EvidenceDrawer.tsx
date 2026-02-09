import {
  Shield,
  X,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function EvidenceDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  const claims = [
    { claim: "Annual revenue $2.4B", tier: "Tier 1: EDGAR", confidence: 98, source: "10-K FY2025" },
    { claim: "IT spend 7.5% of revenue", tier: "Tier 2: Market Data", confidence: 82, source: "Gartner benchmark" },
    { claim: "340 on-prem servers", tier: "Tier 3: Self-reported", confidence: 70, source: "Customer interview" },
    { claim: "99.2% current uptime", tier: "Tier 1: Customer Data", confidence: 95, source: "SLA Dashboard Export" },
    { claim: "Server consolidation 4:1 ratio", tier: "Tier 2: Estimate", confidence: 72, source: "Engineering assessment" },
    { claim: "APAC revenue potential $2.1M", tier: "Tier 3: Self-reported", confidence: 58, source: "VP Strategy interview" },
  ];

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
        {claims.map((c, i) => (
          <div key={i} className="p-4 rounded-2xl border border-zinc-200 hover:border-zinc-300 transition-colors">
            <p className="text-[13px] font-medium text-zinc-900 mb-2">{c.claim}</p>
            <div className="flex items-center gap-2 mb-2">
              <span className={cn(
                "text-[10px] px-2 py-0.5 rounded-full font-semibold",
                c.tier.includes("Tier 1") ? "bg-emerald-50 text-emerald-700" :
                c.tier.includes("Tier 2") ? "bg-blue-50 text-blue-700" :
                "bg-amber-50 text-amber-700"
              )}>
                {c.tier}
              </span>
              <span className="text-[11px] text-zinc-400">{c.source}</span>
              <ExternalLink className="w-3 h-3 text-zinc-300 cursor-pointer hover:text-zinc-500 ml-auto" />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    c.confidence >= 90 ? "bg-emerald-500" : c.confidence >= 75 ? "bg-blue-500" : c.confidence >= 50 ? "bg-amber-500" : "bg-red-400"
                  )}
                  style={{ width: `${c.confidence}%` }}
                />
              </div>
              <span className="text-[11px] font-medium text-zinc-600">{c.confidence}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
