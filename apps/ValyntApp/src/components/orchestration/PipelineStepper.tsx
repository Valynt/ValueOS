/**
 * PipelineStepper
 *
 * A 7-step horizontal pipeline visualization for the HypothesisLoop.
 * Each step shows real-time status, agent name, confidence badge,
 * and timing — all driven by enriched SSE LoopProgress events.
 */

import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  FileSearch,
  Lightbulb,
  Loader2,
  RefreshCw,
  Shield,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";

import type { PipelineStepState, PipelineStepStatus } from "@/hooks/useValueCaseStream";
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';

// ---------------------------------------------------------------------------
// Step icon mapping
// ---------------------------------------------------------------------------

const STEP_ICONS: Record<string, ReactNode> = {
  Hypothesis: <Lightbulb className="h-4 w-4" />,
  Model: <DollarSign className="h-4 w-4" />,
  Evidence: <FileSearch className="h-4 w-4" />,
  Narrative: <BookOpen className="h-4 w-4" />,
  Objection: <Shield className="h-4 w-4" />,
  Revision: <RefreshCw className="h-4 w-4" />,
  Approval: <Sparkles className="h-4 w-4" />,
};

// ---------------------------------------------------------------------------
// Confidence badge
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Duration badge
// ---------------------------------------------------------------------------

function DurationBadge({ ms }: { ms: number }) {
  const label = ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-zinc-400 tabular-nums">
      <Clock className="h-3 w-3" />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Single step node
// ---------------------------------------------------------------------------

interface StepNodeProps {
  step: PipelineStepState;
  isLast: boolean;
}

function statusRingClass(status: PipelineStepStatus): string {
  switch (status) {
    case "completed":
      return "border-emerald-500 bg-emerald-50 text-emerald-600";
    case "running":
      return "border-brand-indigo bg-brand-indigo/10 text-brand-indigo ring-4 ring-brand-indigo/20";
    case "failed":
      return "border-red-500 bg-red-50 text-red-500";
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-400";
  }
}

function connectorClass(status: PipelineStepStatus): string {
  switch (status) {
    case "completed":
      return "bg-emerald-400";
    case "running":
      return "bg-gradient-to-r from-emerald-400 to-brand-indigo animate-pulse";
    default:
      return "bg-zinc-200";
  }
}

function StepNode({ step, isLast }: StepNodeProps) {
  const icon = STEP_ICONS[step.stepName] ?? <ChevronRight className="h-4 w-4" />;

  return (
    <div className="flex items-start gap-0 flex-1 min-w-0">
      {/* Step circle + label column */}
      <div className="flex flex-col items-center gap-1.5 min-w-[72px]">
        {/* Circle */}
        <div
          className={`relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-500 ${statusRingClass(step.status)}`}
        >
          {step.status === "running" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : step.status === "completed" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : step.status === "failed" ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            icon
          )}
        </div>

        {/* Step name */}
        <span
          className={`text-[11px] font-semibold tracking-wide text-center leading-tight ${step.status === "running"
              ? "text-brand-indigo"
              : step.status === "completed"
                ? "text-zinc-700"
                : "text-zinc-400"
            }`}
        >
          {step.stepName}
        </span>

        {/* Agent name */}
        {step.agentName && step.status !== "pending" && (
          <span className="text-[9px] text-zinc-400 font-medium truncate max-w-[80px] text-center">
            {step.agentName}
          </span>
        )}

        {/* Badges row */}
        <div className="flex items-center gap-1">
          {typeof step.confidence === "number" && step.status === "completed" && (
            <ConfidenceBadge value={step.confidence} />
          )}
          {typeof step.durationMs === "number" && step.status === "completed" && (
            <DurationBadge ms={step.durationMs} />
          )}
        </div>

        {/* Message / highlights */}
        {step.message && step.status !== "pending" && (
          <p className="text-[10px] text-zinc-500 text-center leading-snug max-w-[100px] line-clamp-2">
            {step.message}
          </p>
        )}
      </div>

      {/* Connector line */}
      {!isLast && (
        <div className="flex items-center pt-[18px] flex-1 min-w-[12px] px-0.5">
          <div
            className={`h-[2px] w-full rounded-full transition-all duration-700 ${connectorClass(step.status)}`}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PipelineStepper
// ---------------------------------------------------------------------------

interface PipelineStepperProps {
  steps: PipelineStepState[];
  revisionCycle?: number;
  maxRevisionCycles?: number;
  className?: string;
}

export function PipelineStepper({
  steps,
  revisionCycle = 0,
  maxRevisionCycles = 3,
  className = "",
}: PipelineStepperProps) {
  const showRevisionBadge = revisionCycle > 0;

  return (
    <div className={`w-full ${className}`}>
      {/* Revision indicator */}
      {showRevisionBadge && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <div className="flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1">
            <RefreshCw className="h-3 w-3 text-amber-600" />
            <span className="text-[11px] font-semibold text-amber-700">
              Revision cycle {revisionCycle}/{maxRevisionCycles}
            </span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: maxRevisionCycles }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-6 rounded-full transition-colors ${i < revisionCycle ? "bg-amber-400" : "bg-zinc-200"
                  }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Steps row */}
      <div className="flex items-start w-full">
        {steps.map((step, i) => (
          <StepNode key={step.step} step={step} isLast={i === steps.length - 1} />
        ))}
      </div>
    </div>
  );
}
