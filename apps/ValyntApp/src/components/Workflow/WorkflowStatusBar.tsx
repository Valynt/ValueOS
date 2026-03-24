/**
 * WorkflowStatusBar
 *
 * Displays the current workflow phase with animated progress,
 * step indicators, and system status feedback.
 *
 * UX Principles:
 * - Visual Hierarchy: progress bar along F-pattern scan line
 * - Immediate Feedback: animated transitions between states, pulsing for active steps
 * - Accessibility: role="progressbar" with aria attributes, keyboard navigable steps
 */

import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import React from "react";

import { cn } from "@/lib/utils";

export interface WorkflowStep {
  id: string;
  label: string;
  description?: string;
}

export type StepStatus = "pending" | "active" | "completed" | "failed" | "skipped";

export interface WorkflowStatusBarProps {
  steps?: WorkflowStep[];
  currentStepId?: string;
  stepStatuses?: Record<string, StepStatus>;
  status?: string;
  progress?: number;
  message?: string;
  className?: string;
}

const statusIcons: Record<StepStatus, React.FC<{ className?: string }>> = {
  pending: Circle,
  active: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
  skipped: Circle,
};

const statusStyles: Record<StepStatus, string> = {
  pending: "text-[var(--vds-color-text-muted)] border-[var(--vds-color-border)]",
  active: "text-[var(--vds-color-primary)] border-[var(--vds-color-primary)]",
  completed: "text-green-500 border-green-500",
  failed: "text-red-500 border-red-500",
  skipped: "text-[var(--vds-color-text-muted)]/50 border-[var(--vds-color-border)]/50",
};

const connectorStyles: Record<string, string> = {
  completed: "bg-green-500",
  pending: "bg-[var(--vds-color-border)]",
};

export function WorkflowStatusBar({
  steps = [],
  currentStepId,
  stepStatuses = {},
  status,
  progress,
  message,
  className,
}: WorkflowStatusBarProps) {
  const resolvedProgress =
    progress ??
    (steps.length > 0
      ? (Object.values(stepStatuses).filter((s) => s === "completed").length /
        steps.length) *
      100
      : 0);

  const getStepStatus = (stepId: string, index: number): StepStatus => {
    if (stepStatuses[stepId]) return stepStatuses[stepId]!;
    if (!currentStepId) return "pending";
    const currentIndex = steps.findIndex((s) => s.id === currentStepId);
    if (index < currentIndex) return "completed";
    if (index === currentIndex) return "active";
    return "pending";
  };

  // Minimal mode: no steps defined, just a progress bar
  if (steps.length === 0) {
    return (
      <div
        className={cn("w-full", className)}
        role="progressbar"
        aria-valuenow={Math.round(resolvedProgress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={status ?? "Workflow progress"}
      >
        <div className="flex items-center justify-between mb-2">
          {status && (
            <span className="text-sm font-medium text-[var(--vds-color-text-primary)]">{status}</span>
          )}
          <span className="text-xs text-[var(--vds-color-text-muted)] tabular-nums">
            {Math.round(resolvedProgress)}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--vds-color-surface)]">
          <div
            className="h-full rounded-full bg-[var(--vds-color-primary)] transition-all duration-500 ease-out"
            style={{ width: `${resolvedProgress}%` }}
          />
        </div>
        {message && (
          <p className="mt-1.5 text-xs text-[var(--vds-color-text-muted)]">{message}</p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn("w-full", className)}
      role="progressbar"
      aria-valuenow={Math.round(resolvedProgress)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={status ?? "Workflow progress"}
    >
      {(status || message) && (
        <div className="flex items-center justify-between mb-4">
          {status && (
            <span className="text-sm font-medium text-[var(--vds-color-text-primary)]">{status}</span>
          )}
          {message && (
            <span className="text-xs text-[var(--vds-color-text-muted)]">{message}</span>
          )}
        </div>
      )}

      <nav aria-label="Workflow steps">
        <ol className="flex items-center w-full">
          {steps.map((step, index) => {
            const stepStatus = getStepStatus(step.id, index);
            const Icon = statusIcons[stepStatus];
            const isLast = index === steps.length - 1;

            return (
              <li
                key={step.id}
                className={cn("flex items-center", !isLast && "flex-1")}
              >
                <div className="flex flex-col items-center gap-1.5 min-w-0">
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300",
                      statusStyles[stepStatus],
                      stepStatus === "completed" && "bg-green-500/10",
                      stepStatus === "active" && "bg-[var(--vds-color-primary)]/10",
                      stepStatus === "failed" && "bg-red-500/10"
                    )}
                    aria-current={stepStatus === "active" ? "step" : undefined}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        stepStatus === "active" && "animate-spin"
                      )}
                      aria-hidden="true"
                    />
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium text-center max-w-[80px] truncate",
                      stepStatus === "active"
                        ? "text-[var(--vds-color-primary)]"
                        : stepStatus === "completed"
                          ? "text-green-500"
                          : stepStatus === "failed"
                            ? "text-red-500"
                            : "text-[var(--vds-color-text-muted)]"
                    )}
                    title={step.description ?? step.label}
                  >
                    {step.label}
                  </span>
                </div>

                {!isLast && (
                  <div className="flex-1 mx-2 mt-[-1.25rem]">
                    <div
                      className={cn(
                        "h-0.5 w-full rounded-full transition-all duration-500",
                        connectorStyles[stepStatus === "completed" ? "completed" : "pending"]
                      )}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[var(--vds-color-surface)]">
        <div
          className="h-full rounded-full bg-[var(--vds-color-primary)] transition-all duration-500 ease-out"
          style={{ width: `${resolvedProgress}%` }}
        />
      </div>
    </div>
  );
}

WorkflowStatusBar.displayName = "WorkflowStatusBar";
