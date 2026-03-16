/**
 * AgentInsightCard
 *
 * Displays a completed pipeline step's output as a compact, expandable card.
 * Shows agent name, confidence badge, duration, and partial result highlights.
 */

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

import type { PipelineStepState } from "@/hooks/useValueCaseStream";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function confidenceColor(value: number): string {
  const pct = value * 100;
  if (pct >= 80) return "text-emerald-600";
  if (pct >= 60) return "text-amber-600";
  return "text-red-500";
}

function formatValue(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AgentInsightCardProps {
  step: PipelineStepState;
  className?: string;
}

export function AgentInsightCard({ step, className = "" }: AgentInsightCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (step.status === "pending") return null;

  const isRunning = step.status === "running";
  const isFailed = step.status === "failed";

  return (
    <div
      className={`rounded-xl border transition-all duration-300 ${
        isRunning
          ? "border-brand-indigo/30 bg-brand-indigo/5 shadow-sm shadow-brand-indigo/10"
          : isFailed
            ? "border-red-200 bg-red-50/50"
            : "border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm"
      } ${className}`}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Step number */}
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              isRunning
                ? "bg-brand-indigo/10 text-brand-indigo"
                : isFailed
                  ? "bg-red-100 text-red-600"
                  : "bg-emerald-50 text-emerald-600"
            }`}
          >
            {step.step}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-800 truncate">
                {step.stepName}
              </span>
              {step.agentName && (
                <span className="text-[10px] text-zinc-400 font-medium hidden sm:inline">
                  {step.agentName}
                </span>
              )}
            </div>
            {step.message && (
              <p className="text-xs text-zinc-500 truncate mt-0.5">
                {step.message}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Confidence */}
          {typeof step.confidence === "number" && step.status === "completed" && (
            <span
              className={`text-xs font-semibold tabular-nums ${confidenceColor(step.confidence)}`}
            >
              {Math.round(step.confidence * 100)}%
            </span>
          )}

          {/* Duration */}
          {typeof step.durationMs === "number" && step.status === "completed" && (
            <span className="text-[10px] text-zinc-400 tabular-nums">
              {step.durationMs < 1000
                ? `${step.durationMs}ms`
                : `${(step.durationMs / 1000).toFixed(1)}s`}
            </span>
          )}

          {/* Running indicator */}
          {isRunning && (
            <div className="h-2 w-2 rounded-full bg-brand-indigo animate-pulse" />
          )}

          {/* Expand toggle */}
          {step.partialResult && step.status === "completed" && (
            <span className="text-zinc-400">
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </span>
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && step.partialResult && (
        <div className="border-t border-zinc-100 px-4 py-3 space-y-2">
          {/* Stats row */}
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            {typeof step.partialResult.itemCount === "number" && (
              <span>
                <span className="font-semibold text-zinc-700">
                  {step.partialResult.itemCount}
                </span>{" "}
                items
              </span>
            )}
            {typeof step.partialResult.totalValue === "number" && (
              <span>
                <span className="font-semibold text-zinc-700">
                  {formatValue(step.partialResult.totalValue)}
                </span>{" "}
                total value
              </span>
            )}
          </div>

          {/* Highlights */}
          {step.partialResult.highlights && step.partialResult.highlights.length > 0 && (
            <ul className="space-y-1">
              {step.partialResult.highlights.map((h, i) => (
                <li
                  key={i}
                  className="text-xs text-zinc-600 flex items-start gap-1.5"
                >
                  <span className="mt-1 h-1 w-1 rounded-full bg-zinc-400 shrink-0" />
                  <span className="line-clamp-2">{h}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
