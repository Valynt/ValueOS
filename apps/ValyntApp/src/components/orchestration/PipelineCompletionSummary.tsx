/**
 * PipelineCompletionSummary
 *
 * Celebratory summary card displayed when the 7-step HypothesisLoop
 * completes successfully. Shows aggregate stats, total duration,
 * and a CTA to view the finalized value case.
 */

import { CheckCircle2, Clock, Sparkles, TrendingUp } from "lucide-react";

import type { PipelineState } from "@/hooks/useValueCaseStream";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(steps: PipelineState["steps"]): string {
  const totalMs = steps.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
  if (totalMs < 1000) return `${totalMs}ms`;
  if (totalMs < 60_000) return `${(totalMs / 1000).toFixed(1)}s`;
  return `${Math.floor(totalMs / 60_000)}m ${Math.round((totalMs % 60_000) / 1000)}s`;
}

function formatValue(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function avgConfidence(steps: PipelineState["steps"]): number {
  const scored = steps.filter((s) => typeof s.confidence === "number");
  if (scored.length === 0) return 0;
  return scored.reduce((sum, s) => sum + (s.confidence ?? 0), 0) / scored.length;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PipelineCompletionSummaryProps {
  pipeline: PipelineState;
  className?: string;
  onViewCase?: () => void;
}

export function PipelineCompletionSummary({
  pipeline,
  className = "",
  onViewCase,
}: PipelineCompletionSummaryProps) {
  if (!pipeline.isComplete) return null;

  const duration = formatDuration(pipeline.steps);
  const confidence = avgConfidence(pipeline.steps);
  const confidencePct = Math.round(confidence * 100);
  const approvalStep = pipeline.steps.find((s) => s.step === 7);
  const totalValue = approvalStep?.partialResult?.totalValue;
  const hypothesisCount = approvalStep?.partialResult?.itemCount ?? 0;

  return (
    <div
      className={`rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-brand-indigo/5 p-6 shadow-sm ${className}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-zinc-900">
            Value Case Finalized
          </h3>
          <p className="text-xs text-zinc-500">
            {pipeline.revisionCycle > 0
              ? `Completed after ${pipeline.revisionCycle} revision${pipeline.revisionCycle > 1 ? "s" : ""}`
              : "Completed on first pass"}
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        {/* Hypotheses */}
        <div className="rounded-lg bg-white border border-zinc-100 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles className="h-3.5 w-3.5 text-brand-indigo" />
            <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
              Hypotheses
            </span>
          </div>
          <span className="text-lg font-bold text-zinc-900 tabular-nums">
            {hypothesisCount}
          </span>
        </div>

        {/* Total Value */}
        {typeof totalValue === "number" && totalValue > 0 && (
          <div className="rounded-lg bg-white border border-zinc-100 px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                Total Value
              </span>
            </div>
            <span className="text-lg font-bold text-zinc-900 tabular-nums">
              {formatValue(totalValue)}
            </span>
          </div>
        )}

        {/* Confidence */}
        <div className="rounded-lg bg-white border border-zinc-100 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
              Confidence
            </span>
          </div>
          <span
            className={`text-lg font-bold tabular-nums ${
              confidencePct >= 80
                ? "text-emerald-600"
                : confidencePct >= 60
                  ? "text-amber-600"
                  : "text-red-500"
            }`}
          >
            {confidencePct}%
          </span>
        </div>

        {/* Duration */}
        <div className="rounded-lg bg-white border border-zinc-100 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
              Duration
            </span>
          </div>
          <span className="text-lg font-bold text-zinc-900 tabular-nums">
            {duration}
          </span>
        </div>
      </div>

      {/* CTA */}
      {onViewCase && (
        <button
          type="button"
          onClick={onViewCase}
          className="w-full rounded-lg bg-brand-indigo px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-indigo/50 focus-visible:ring-offset-2"
        >
          View Finalized Value Case
        </button>
      )}
    </div>
  );
}
