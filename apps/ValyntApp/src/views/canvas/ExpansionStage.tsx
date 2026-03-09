import {
  ArrowRight,
  Globe,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  useExpansionOpportunities,
  useRunExpansionAgent,
  type ExpansionOpportunity,
} from "@/hooks/useExpansion";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<ExpansionOpportunity["type"], string> = {
  upsell: "Upsell",
  cross_sell: "Cross-sell",
  new_use_case: "New Use Case",
  geographic_expansion: "Geographic",
  deeper_adoption: "Deeper Adoption",
};

const TYPE_COLORS: Record<ExpansionOpportunity["type"], string> = {
  upsell: "bg-violet-50 text-violet-700",
  cross_sell: "bg-blue-50 text-blue-700",
  new_use_case: "bg-emerald-50 text-emerald-700",
  geographic_expansion: "bg-amber-50 text-amber-700",
  deeper_adoption: "bg-pink-50 text-pink-700",
};

function formatValue(low: number | null, high: number | null, unit: string | null): string {
  if (low == null && high == null) return "—";
  const u = unit ?? "";
  if (low != null && high != null) return `${u}${low.toLocaleString()}–${u}${high.toLocaleString()}`;
  return `${u}${(low ?? high ?? 0).toLocaleString()}`;
}

// ---------------------------------------------------------------------------
// OpportunityCard
// ---------------------------------------------------------------------------

function OpportunityCard({ opp }: { opp: ExpansionOpportunity }) {
  const confidencePct = opp.confidence != null ? Math.round(opp.confidence * 100) : null;

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              "text-[10px] px-2 py-0.5 rounded-full font-semibold",
              TYPE_COLORS[opp.type],
            )}>
              {TYPE_LABELS[opp.type]}
            </span>
            {confidencePct != null && (
              <span className="text-[10px] text-zinc-400">{confidencePct}% confidence</span>
            )}
          </div>
          <h4 className="text-[14px] font-semibold text-zinc-900">{opp.title}</h4>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[13px] font-black text-zinc-950">
            {formatValue(opp.estimated_value_low, opp.estimated_value_high, opp.estimated_value_unit)}
          </p>
          {opp.estimated_value_timeframe_months != null && (
            <p className="text-[10px] text-zinc-400">{opp.estimated_value_timeframe_months}mo</p>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-[12px] text-zinc-600 leading-relaxed">{opp.description}</p>

      {/* Evidence */}
      {opp.evidence.length > 0 && (
        <div className="space-y-1">
          {opp.evidence.slice(0, 2).map((e, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
              <span className="text-[11px] text-zinc-500">{e}</span>
            </div>
          ))}
        </div>
      )}

      {/* Prerequisites */}
      {opp.prerequisites.length > 0 && (
        <div className="pt-2 border-t border-zinc-100">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400 mb-1.5">
            Prerequisites
          </p>
          <div className="flex flex-wrap gap-1.5">
            {opp.prerequisites.map((p, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded-full">
                {p}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ExpansionStage
// ---------------------------------------------------------------------------

export function ExpansionStage({ caseId }: { caseId?: string }) {
  const { data: opportunities, isLoading, error } = useExpansionOpportunities(caseId);
  const runAgent = useRunExpansionAgent(caseId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-[13px]">Loading expansion opportunities…</span>
      </div>
    );
  }

  if (error || !opportunities || opportunities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Sparkles className="w-8 h-8 text-zinc-300" />
        <p className="text-[13px] text-zinc-500 text-center max-w-xs">
          No expansion analysis yet. Run the Expansion Agent to identify growth opportunities from this value case.
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
          Run Expansion Agent
        </button>
        {runAgent.error && (
          <p className="text-[11px] text-red-500">{runAgent.error.message}</p>
        )}
      </div>
    );
  }

  // Derive summary from first row (all rows in a run share batch-level fields)
  const first = opportunities[0]!;
  const totalLow = first.total_expansion_value_low;
  const totalHigh = first.total_expansion_value_high;
  const currency = first.total_expansion_currency ?? "$";
  const nextSteps = first.recommended_next_steps ?? [];
  const portfolioSummary = first.portfolio_summary;

  return (
    <div className="space-y-5">
      {/* Summary header */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-600" />
            <h4 className="text-[13px] font-semibold text-zinc-900">Expansion Potential</h4>
          </div>
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

        {/* Total value + opportunity count */}
        <div className="flex items-center gap-1 p-1 bg-zinc-50 rounded-xl">
          {[
            {
              label: "Opportunities",
              value: String(opportunities.length),
              icon: Zap,
              color: "text-violet-700",
            },
            {
              label: "Total Potential",
              value: totalLow != null && totalHigh != null
                ? `${currency}${totalLow.toLocaleString()}–${currency}${totalHigh.toLocaleString()}`
                : "—",
              icon: TrendingUp,
              color: "text-emerald-700",
            },
            {
              label: "Markets",
              value: String(
                new Set(opportunities.filter((o) => o.type === "geographic_expansion").length > 0
                  ? ["Global"]
                  : ["Existing"]).size,
              ),
              icon: Globe,
              color: "text-blue-700",
            },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="flex-1 text-center py-3 rounded-lg">
                <Icon className={cn("w-4 h-4 mx-auto mb-1", s.color)} />
                <p className={cn("text-[14px] font-black tracking-tight", s.color)}>{s.value}</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">
                  {s.label}
                </p>
              </div>
            );
          })}
        </div>

        {/* Portfolio summary */}
        {portfolioSummary && (
          <p className="mt-4 text-[12px] text-zinc-600 leading-relaxed">{portfolioSummary}</p>
        )}
      </div>

      {/* Opportunity cards */}
      <div>
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 mb-3">
          Opportunities
        </h4>
        <div className="space-y-3">
          {opportunities.map((opp) => (
            <OpportunityCard key={opp.id} opp={opp} />
          ))}
        </div>
      </div>

      {/* Next steps */}
      {nextSteps.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5">
          <h4 className="text-[13px] font-semibold text-zinc-900 mb-3">Recommended Next Steps</h4>
          <div className="space-y-2">
            {nextSteps.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <p className="text-[12px] text-zinc-700">{step}</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-300 flex-shrink-0 mt-0.5" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
