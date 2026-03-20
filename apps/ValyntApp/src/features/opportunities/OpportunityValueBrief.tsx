/**
 * OpportunityValueBrief
 *
 * Primary product surface for Sprint 6. Shows the value summary for an
 * opportunity: account context, lifecycle stage, hypothesis inventory, and
 * aggregated value range. Data comes from the backend domain APIs
 * (Account, Opportunity, ValueHypothesis).
 */

import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";


import type { BriefHypothesis, BriefOpportunity, OpportunityBrief } from "./useOpportunityBrief";
import { useOpportunityBrief } from "./useOpportunityBrief";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUSD(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

const STAGE_LABELS: Record<string, string> = {
  discovery: "Discovery",
  drafting: "Drafting",
  validating: "Validating",
  composing: "Composing",
  refining: "Refining",
  realized: "Realized",
  expansion: "Expansion",
};

const STAGE_COLORS: Record<string, string> = {
  discovery: "bg-blue-500",
  drafting: "bg-violet-500",
  validating: "bg-amber-500",
  composing: "bg-orange-500",
  refining: "bg-pink-500",
  realized: "bg-emerald-500",
  expansion: "bg-teal-500",
};

const CONFIDENCE_CONFIG = {
  high: { label: "High", color: "text-emerald-700", bg: "bg-emerald-50", bar: "bg-emerald-500" },
  medium: { label: "Medium", color: "text-amber-700", bg: "bg-amber-50", bar: "bg-amber-500" },
  low: { label: "Low", color: "text-red-700", bg: "bg-red-50", bar: "bg-red-400" },
} as const;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StageIndicator({ stage }: { stage: string }) {
  const dot = STAGE_COLORS[stage] ?? "bg-zinc-400";
  const label = STAGE_LABELS[stage] ?? stage;
  return (
    <div className="flex items-center gap-2">
      <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", dot)} />
      <span className="text-[13px] font-semibold text-muted-foreground">{label}</span>
    </div>
  );
}

function ValueRangeBar({ low, high, max }: { low: number; high: number; max: number }) {
  if (max === 0) return null;
  const leftPct = (low / max) * 100;
  const widthPct = ((high - low) / max) * 100;
  return (
    <div className="relative h-2 bg-muted rounded-full overflow-hidden">
      <div
        className="absolute h-full bg-emerald-400 rounded-full"
        style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 2)}%` }}
      />
    </div>
  );
}

function HypothesisRow({ hypothesis }: { hypothesis: BriefHypothesis }) {
  const conf = CONFIDENCE_CONFIG[hypothesis.confidence];
  const hasValue = hypothesis.estimated_value?.unit === "usd";

  return (
    <div className="flex items-start gap-3 p-4 rounded-2xl border border-border hover:border-border hover:bg-surface/50 transition-all">
      <div className={cn("mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0", conf.bg)}>
        <Sparkles className={cn("w-3.5 h-3.5", conf.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground leading-snug">{hypothesis.description}</p>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            {hypothesis.category}
          </span>
          <span className={cn("text-[11px] font-semibold px-1.5 py-0.5 rounded-full", conf.color, conf.bg)}>
            {conf.label} confidence
          </span>
          {hypothesis.status !== "proposed" && (
            <span className="text-[11px] text-muted-foreground capitalize">{hypothesis.status}</span>
          )}
        </div>
      </div>
      {hasValue && hypothesis.estimated_value && (
        <div className="text-right flex-shrink-0">
          <p className="text-[13px] font-black text-foreground tracking-tight">
            {formatUSD(hypothesis.estimated_value.low)}–{formatUSD(hypothesis.estimated_value.high)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            over {hypothesis.estimated_value.timeframe_months}mo
          </p>
        </div>
      )}
    </div>
  );
}

function ConfidenceSummaryBar({
  summary,
  total,
}: {
  summary: OpportunityBrief["confidenceSummary"];
  total: number;
}) {
  if (total === 0) return null;
  return (
    <div className="flex gap-1 h-2 rounded-full overflow-hidden">
      {summary.high > 0 && (
        <div className="bg-emerald-500 rounded-full" style={{ width: `${(summary.high / total) * 100}%` }} />
      )}
      {summary.medium > 0 && (
        <div className="bg-amber-400 rounded-full" style={{ width: `${(summary.medium / total) * 100}%` }} />
      )}
      {summary.low > 0 && (
        <div className="bg-red-400 rounded-full" style={{ width: `${(summary.low / total) * 100}%` }} />
      )}
    </div>
  );
}

function AccountCard({ account, opportunity }: { account: OpportunityBrief["account"]; opportunity: BriefOpportunity }) {
  return (
    <div className="bg-card border border-border rounded-3xl p-6 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-background rounded-2xl flex items-center justify-center flex-shrink-0">
          <Building2 className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[18px] font-black text-zinc-950 tracking-tight leading-tight truncate">
            {account.name}
          </h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">{opportunity.name}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="bg-surface rounded-2xl p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-1">Stage</p>
          <StageIndicator stage={opportunity.lifecycle_stage} />
        </div>
        {account.industry && (
          <div className="bg-surface rounded-2xl p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-1">Industry</p>
            <p className="text-[13px] font-semibold text-muted-foreground">{account.industry}</p>
          </div>
        )}
        {account.arr_usd != null && (
          <div className="bg-surface rounded-2xl p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-1">ARR</p>
            <p className="text-[13px] font-semibold text-muted-foreground">{formatUSD(account.arr_usd)}</p>
          </div>
        )}
        {account.employee_count != null && (
          <div className="bg-surface rounded-2xl p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-1">Employees</p>
            <p className="text-[13px] font-semibold text-muted-foreground">
              {account.employee_count.toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {opportunity.close_date && (
        <div className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Target close {new Date(opportunity.close_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </div>
      )}
    </div>
  );
}

function ValueSummaryCard({ brief }: { brief: OpportunityBrief }) {
  const total = brief.hypotheses.length;
  const hasValue = brief.totalValueHigh > 0;

  return (
    <div className="bg-background text-white rounded-3xl p-6 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.15)]">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-emerald-400" />
        <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Value Potential
        </span>
      </div>

      {hasValue ? (
        <>
          <p className="text-[11px] text-muted-foreground mb-1">Estimated range</p>
          <p className="text-[32px] font-black tracking-tight leading-none">
            {formatUSD(brief.totalValueLow)}
            <span className="text-muted-foreground mx-2">–</span>
            {formatUSD(brief.totalValueHigh)}
          </p>
          <p className="text-[12px] text-muted-foreground mt-2">
            across {total} {total === 1 ? "hypothesis" : "hypotheses"}
          </p>
        </>
      ) : (
        <div className="py-2">
          <p className="text-[15px] font-semibold text-muted-foreground">No value estimates yet</p>
          <p className="text-[12px] text-muted-foreground mt-1">
            Run the Financial Modeling agent to generate estimates.
          </p>
        </div>
      )}

      {total > 0 && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-muted-foreground">Confidence mix</span>
            <span className="text-[11px] text-muted-foreground">{total} hypotheses</span>
          </div>
          <ConfidenceSummaryBar summary={brief.confidenceSummary} total={total} />
          <div className="flex items-center gap-4 mt-2">
            {brief.confidenceSummary.high > 0 && (
              <span className="text-[11px] text-emerald-400">{brief.confidenceSummary.high} high</span>
            )}
            {brief.confidenceSummary.medium > 0 && (
              <span className="text-[11px] text-amber-400">{brief.confidenceSummary.medium} medium</span>
            )}
            {brief.confidenceSummary.low > 0 && (
              <span className="text-[11px] text-red-400">{brief.confidenceSummary.low} low</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function HypothesisList({
  hypotheses,
  opportunityId,
}: {
  hypotheses: BriefHypothesis[];
  opportunityId: string;
}) {
  const maxValue = Math.max(...hypotheses.map(h => h.estimated_value?.high ?? 0));

  return (
    <div className="bg-card border border-border rounded-3xl p-6 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[14px] font-black text-zinc-950 tracking-tight">Value Hypotheses</h3>
        <Link
          to={`/opportunities/${opportunityId}/cases/new`}
          className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          Run agent
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {hypotheses.length === 0 ? (
        <div className="py-10 text-center">
          <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-[14px] font-semibold text-muted-foreground">No hypotheses yet</p>
          <p className="text-[13px] text-muted-foreground mt-1 max-w-xs mx-auto">
            Create a value case and run the Opportunity agent to generate hypotheses.
          </p>
          <Link
            to={`/opportunities/${opportunityId}/cases/new`}
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-background text-white text-[13px] font-semibold rounded-xl hover:bg-surface-elevated transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Start a value case
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {hypotheses.map((h) => (
            <div key={h.id}>
              <HypothesisRow hypothesis={h} />
              {h.estimated_value?.unit === "usd" && maxValue > 0 && (
                <div className="px-4 pb-1">
                  <ValueRangeBar
                    low={h.estimated_value.low}
                    high={h.estimated_value.high}
                    max={maxValue}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading / error states
// ---------------------------------------------------------------------------

function BriefSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-48 bg-muted rounded-3xl" />
      <div className="h-40 bg-muted rounded-3xl" />
      <div className="h-64 bg-muted rounded-3xl" />
    </div>
  );
}

function BriefError({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-3xl p-6 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-[14px] font-semibold text-red-800">Failed to load opportunity</p>
        <p className="text-[13px] text-red-600 mt-0.5">{message}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface OpportunityValueBriefProps {
  opportunityId: string;
  /** When true, renders in a compact sidebar-friendly layout. */
  compact?: boolean;
}

export function OpportunityValueBrief({ opportunityId, compact = false }: OpportunityValueBriefProps) {
  const { data: brief, isLoading, error } = useOpportunityBrief(opportunityId);

  if (isLoading) return <BriefSkeleton />;
  if (error) return <BriefError message={error instanceof Error ? error.message : "Unknown error"} />;
  if (!brief) return null;

  if (compact) {
    // Compact layout: stacked single-column for sidebars / drawers
    return (
      <div className="space-y-4">
        <AccountCard account={brief.account} opportunity={brief.opportunity} />
        <ValueSummaryCard brief={brief} />
        <HypothesisList hypotheses={brief.hypotheses} opportunityId={opportunityId} />
      </div>
    );
  }

  // Full layout: two-column grid
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left column: account + value summary */}
      <div className="space-y-4">
        <AccountCard account={brief.account} opportunity={brief.opportunity} />
        <ValueSummaryCard brief={brief} />
      </div>

      {/* Right column: hypotheses */}
      <div className="lg:col-span-2">
        <HypothesisList hypotheses={brief.hypotheses} opportunityId={opportunityId} />
      </div>
    </div>
  );
}
