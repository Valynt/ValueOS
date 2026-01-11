/**
 * ExecutionProgress Component
 *
 * Displays real-time execution progress with streaming reasoning.
 * Features shimmer animations and pause/resume controls.
 */

import { useState, useEffect, useRef } from "react";
import {
  Pause,
  Play,
  X,
  CheckCircle,
  Loader2,
  Clock,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { ExecutionProgress as ExecutionProgressType, PlanStep } from "../../lib/agent/types";
import { cn } from "../../lib/utils";

interface ExecutionProgressProps {
  progress: ExecutionProgressType;
  plan: PlanStep[];
  isPaused: boolean;
  reasoning?: string;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  className?: string;
}

export function ExecutionProgress({
  progress,
  plan,
  isPaused,
  reasoning,
  onPause,
  onResume,
  onCancel,
  className,
}: ExecutionProgressProps) {
  const [showReasoning, setShowReasoning] = useState(true);
  const reasoningRef = useRef<HTMLDivElement>(null);

  // Auto-scroll reasoning
  useEffect(() => {
    if (reasoningRef.current && showReasoning) {
      reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight;
    }
  }, [reasoning, showReasoning]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.target?.toString().includes("input")) {
        e.preventDefault();
        isPaused ? onResume() : onPause();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPaused, onPause, onResume]);

  const currentStep = plan.find((s) => s.id === progress.currentStepId);
  const completedSteps = progress.currentStepIndex;
  const totalSteps = progress.totalSteps;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            {isPaused ? (
              <>
                <Pause className="w-5 h-5 text-amber-400" />
                Paused
              </>
            ) : (
              <>
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                Executing
              </>
            )}
          </h3>
          <p className="text-sm text-gray-400">
            Step {completedSteps + 1} of {totalSteps}
            {currentStep && ` — ${currentStep.title}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={isPaused ? onResume : onPause}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg",
              "text-sm font-medium transition-colors duration-150",
              isPaused
                ? "bg-primary hover:bg-primary/90 text-white"
                : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30"
            )}
          >
            {isPaused ? (
              <>
                <Play className="w-4 h-4" />
                Resume
              </>
            ) : (
              <>
                <Pause className="w-4 h-4" />
                Pause
              </>
            )}
          </button>
          <button
            onClick={onCancel}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg",
              "text-sm font-medium",
              "bg-gray-800 hover:bg-gray-700 text-gray-300",
              "transition-colors duration-150"
            )}
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Overall Progress</span>
          <span className="text-white font-medium">{Math.round(progress.overallProgress)}%</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              isPaused ? "bg-amber-500" : "bg-primary",
              !isPaused && "animate-shimmer"
            )}
            style={{ width: `${progress.overallProgress}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <Clock className="w-3.5 h-3.5" />
            Elapsed
          </div>
          <div className="text-white font-medium">{formatTime(progress.elapsedSeconds)}</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <Clock className="w-3.5 h-3.5" />
            Remaining
          </div>
          <div className="text-white font-medium">
            {progress.estimatedRemainingSeconds
              ? formatTime(progress.estimatedRemainingSeconds)
              : "—"}
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <Zap className="w-3.5 h-3.5" />
            Validation
          </div>
          <div className="flex items-center gap-1.5">
            <ValidationPulse status={progress.validationStatus} />
            <span className="text-white font-medium capitalize">
              {progress.validationStatus || "pending"}
            </span>
          </div>
        </div>
      </div>

      {/* Step list */}
      <div className="space-y-1">
        {plan.map((step, index) => {
          const isComplete = index < completedSteps;
          const isCurrent = step.id === progress.currentStepId;
          const isPending = index > completedSteps;

          return (
            <div
              key={step.id}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg",
                "transition-all duration-300",
                isCurrent && "bg-primary/10 border border-primary/30",
                isCurrent && !isPaused && "animate-pulse-subtle"
              )}
            >
              <div className="flex-shrink-0">
                {isComplete ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : isCurrent ? (
                  <Loader2 className={cn("w-5 h-5 text-primary", !isPaused && "animate-spin")} />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-gray-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span
                  className={cn(
                    "text-sm",
                    isComplete && "text-gray-400",
                    isCurrent && "text-white font-medium",
                    isPending && "text-gray-500"
                  )}
                >
                  {step.title}
                </span>
              </div>
              {isCurrent && (
                <div className="text-xs text-primary">{Math.round(progress.stepProgress)}%</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Reasoning stream */}
      {reasoning && (
        <div className="border border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className={cn(
              "w-full flex items-center justify-between px-4 py-2",
              "bg-gray-800/50 hover:bg-gray-800",
              "text-sm text-gray-400 transition-colors"
            )}
          >
            <span>Agent Reasoning</span>
            {showReasoning ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          {showReasoning && (
            <div
              ref={reasoningRef}
              className={cn(
                "p-4 bg-gray-900/50 max-h-40 overflow-y-auto",
                "text-sm text-gray-300 font-mono",
                "whitespace-pre-wrap"
              )}
            >
              {reasoning}
              <span className="inline-block w-2 h-4 bg-primary/50 animate-pulse ml-0.5" />
            </div>
          )}
        </div>
      )}

      {/* Keyboard hint */}
      <div className="text-center text-xs text-gray-600">
        Press <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400">Space</kbd> to{" "}
        {isPaused ? "resume" : "pause"}
      </div>
    </div>
  );
}

interface ValidationPulseProps {
  status?: "pending" | "validating" | "validated" | "failed";
}

function ValidationPulse({ status = "pending" }: ValidationPulseProps) {
  const colors = {
    pending: "bg-gray-500",
    validating: "bg-amber-500 animate-pulse",
    validated: "bg-emerald-500",
    failed: "bg-red-500",
  };

  return <div className={cn("w-2 h-2 rounded-full", colors[status])} />;
}

export default ExecutionProgress;
