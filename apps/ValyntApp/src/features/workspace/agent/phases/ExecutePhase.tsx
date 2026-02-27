/**
 * ExecutePhase — Scanning beam progress with per-step status indicators.
 * Shows real-time tool execution, streaming content, and overall progress.
 */

import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WorkflowStepState } from "../types";

interface ExecutePhaseProps {
  steps: WorkflowStepState[];
  progress: number;
  streamingContent?: string;
  onCancel: () => void;
  className?: string;
}

export function ExecutePhase({
  steps,
  progress,
  streamingContent,
  onCancel,
  className,
}: ExecutePhaseProps) {
  const activeStep = steps.find((s) => s.status === "running");
  const completedCount = steps.filter((s) => s.status === "completed").length;

  return (
    <div className={cn("space-y-3 animate-fade-in", className)}>
      <Card className="p-5 border-success/30 bg-success/5 shadow-sm">
        {/* Header with scanning beam */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="relative w-2.5 h-2.5">
              <div className="absolute inset-0 rounded-full bg-success animate-ping opacity-75" />
              <div className="relative w-2.5 h-2.5 rounded-full bg-success" />
            </div>
            <span className="text-xs font-semibold text-success-700 uppercase tracking-wide">
              Executing
            </span>
          </div>
          <span className="text-xs text-slate-500 tabular-nums">
            {completedCount}/{steps.length} steps &middot; {progress}%
          </span>
        </div>

        {/* Progress bar with scanning beam overlay */}
        <div className="relative w-full h-2 bg-slate-100 rounded-full mb-5 overflow-hidden">
          <div
            className="h-full bg-success rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
          {/* Scanning beam */}
          <div className="absolute inset-0 overflow-hidden rounded-full">
            <div className="w-1/3 h-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-scan-beam" />
          </div>
        </div>

        {/* Step list */}
        <div className="space-y-1.5 mb-4">
          {steps.map((step) => (
            <div key={step.id} className="flex items-center gap-2.5">
              <StepIcon status={step.status} />
              <span
                className={cn(
                  "text-sm",
                  step.status === "completed" && "text-slate-500 line-through",
                  step.status === "running" && "text-slate-800 font-medium",
                  step.status === "pending" && "text-slate-400",
                  step.status === "error" && "text-destructive",
                  step.status === "skipped" && "text-slate-400 italic"
                )}
              >
                {step.label}
              </span>
              {step.status === "running" && step.progress !== undefined && (
                <span className="ml-auto text-2xs text-slate-400 tabular-nums">
                  {step.progress}%
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Active step detail */}
        {activeStep && (
          <div className="bg-white/60 rounded-lg p-3 border border-success/20 mb-4">
            <div className="text-2xs text-success-600 font-medium mb-1">
              Currently running
            </div>
            <div className="text-sm text-slate-700">{activeStep.label}</div>
          </div>
        )}

        {/* Streaming content preview */}
        {streamingContent && (
          <div className="bg-white/60 rounded-lg p-3 border border-slate-200 mb-4 max-h-32 overflow-y-auto">
            <div className="text-2xs text-slate-400 mb-1">Agent output</div>
            <div className="text-sm text-slate-600 whitespace-pre-wrap font-mono leading-relaxed">
              {streamingContent}
              <span className="inline-block w-1.5 h-4 bg-success ml-0.5 animate-pulse" />
            </div>
          </div>
        )}

        {/* Cancel */}
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="w-full text-slate-500 hover:text-destructive hover:border-destructive/30"
        >
          Cancel Execution
        </Button>
      </Card>
    </div>
  );
}

function StepIcon({ status }: { status: WorkflowStepState["status"] }) {
  switch (status) {
    case "completed":
      return (
        <svg className="w-4 h-4 text-success shrink-0" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1" />
          <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "running":
      return (
        <div className="w-4 h-4 shrink-0 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full border-2 border-success border-t-transparent animate-spin" />
        </div>
      );
    case "error":
      return (
        <svg className="w-4 h-4 text-destructive shrink-0" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1" />
          <path d="M6 6l4 4M10 6l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "skipped":
      return (
        <svg className="w-4 h-4 text-slate-300 shrink-0" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
          <path d="M5 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4 text-slate-300 shrink-0" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
  }
}
