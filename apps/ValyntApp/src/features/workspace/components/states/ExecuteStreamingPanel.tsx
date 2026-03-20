/**
 * FE-020: Execute State UI — Streaming Progress
 *
 * Shows real-time execution progress with step-by-step status,
 * animated progress bar, elapsed time, and cancel action.
 */

import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Loader2,
  PlayCircle,
  SkipForward,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { WorkflowStepState } from "../../agent/types";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";


interface ExecuteStreamingPanelProps {
  steps: WorkflowStepState[];
  progress: number;
  streamingContent: string;
  isStreaming: boolean;
  onCancel: () => void;
}

const STEP_ICONS: Record<WorkflowStepState["status"], React.ReactNode> = {
  completed: <CheckCircle2 size={16} className="text-emerald-500" />,
  running: <Loader2 size={16} className="text-purple-500 animate-spin" />,
  pending: <Circle size={16} className="text-slate-300" />,
  error: <AlertCircle size={16} className="text-red-500" />,
  skipped: <SkipForward size={16} className="text-slate-400" />,
};

export function ExecuteStreamingPanel({
  steps,
  progress,
  streamingContent,
  isStreaming,
  onCancel,
}: ExecuteStreamingPanelProps) {
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef(Date.now());

  // Elapsed timer
  useEffect(() => {
    if (!isStreaming) return;
    startTimeRef.current = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isStreaming]);

  const completedCount = steps.filter((s) => s.status === "completed").length;
  const currentStep = steps.find((s) => s.status === "running");

  const formatElapsed = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  return (
    <Card className="border-purple-200 bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-purple-50/50 border-b border-purple-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PlayCircle size={16} className="text-purple-600" />
          <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
            Executing
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>{completedCount}/{steps.length} steps</span>
          <span>{formatElapsed(elapsed)}</span>
          <span className="font-medium text-purple-700">{progress}%</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1 bg-purple-100">
        <div
          className="h-full bg-purple-500 transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Steps */}
      <div className="p-4 space-y-1">
        {steps.map((step) => (
          <div
            key={step.id}
            className={cn(
              "flex items-center gap-3 py-1.5 px-2 rounded-md transition-colors",
              step.status === "running" && "bg-purple-50",
              step.status === "error" && "bg-red-50"
            )}
          >
            <div className="w-5 flex justify-center shrink-0">
              {STEP_ICONS[step.status]}
            </div>
            <span
              className={cn(
                "text-sm flex-1",
                step.status === "pending" && "text-slate-400",
                step.status === "running" && "text-purple-700 font-medium",
                step.status === "completed" && "text-slate-600",
                step.status === "error" && "text-red-700",
                step.status === "skipped" && "text-slate-400 line-through"
              )}
            >
              {step.label}
            </span>
            {step.status === "completed" && step.completedAt && step.startedAt && (
              <span className="text-[10px] text-slate-400">
                {((step.completedAt - step.startedAt) / 1000).toFixed(1)}s
              </span>
            )}
            {step.error && (
              <span className="text-[10px] text-red-500 truncate max-w-[120px]">
                {step.error}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Current step detail / streaming content */}
      {currentStep && streamingContent && (
        <div className="px-4 pb-3">
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div className="text-[10px] font-medium text-slate-400 uppercase mb-1">
              {currentStep.label}
            </div>
            <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
              {streamingContent}
            </p>
          </div>
        </div>
      )}

      {/* Cancel */}
      {isStreaming && (
        <div className="px-4 py-3 border-t border-slate-100">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="w-full text-slate-500 hover:text-red-600 hover:border-red-200"
          >
            <XCircle size={14} className="mr-1.5" />
            Cancel Execution
          </Button>
        </div>
      )}
    </Card>
  );
}
