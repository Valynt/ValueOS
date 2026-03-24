/**
 * StepperWizard
 *
 * Multi-step wizard with keyboard navigation, step validation states,
 * and consistent visual language.
 *
 * UX Principles:
 * - POLA: consistent step indicator styling, predictable Back/Next pattern
 * - Golden Thread: carries context forward, one task per step
 * - Accessibility: arrow key navigation, aria-current, focus management
 * - Error Prevention: disables Next when step is invalid, shows validation state
 */

import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import React, { useCallback, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

export type StepValidation = "valid" | "invalid" | "pending";

export interface Step {
  label: string;
  description?: string;
  content: React.ReactNode;
  validation?: StepValidation;
  optional?: boolean;
}

export interface StepperWizardProps {
  steps: Step[];
  currentStep: number;
  onNext: () => void;
  onBack: () => void;
  onStepClick?: (index: number) => void;
  canNext: boolean;
  canBack: boolean;
  nextLabel?: string;
  backLabel?: string;
  finishLabel?: string;
  className?: string;
}

const StepperWizard: React.FC<StepperWizardProps> = ({
  steps,
  currentStep,
  onNext,
  onBack,
  onStepClick,
  canNext,
  canBack,
  nextLabel,
  backLabel = "Back",
  finishLabel = "Finish",
  className,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const isLastStep = currentStep === steps.length - 1;
  const currentStepData = steps[currentStep];

  // Focus content area on step change for screen readers
  useEffect(() => {
    contentRef.current?.focus();
  }, [currentStep]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowRight" && canNext) {
        e.preventDefault();
        onNext();
      } else if (e.key === "ArrowLeft" && canBack) {
        e.preventDefault();
        onBack();
      }
    },
    [canNext, canBack, onNext, onBack]
  );

  return (
    <div
      className={cn("max-w-2xl mx-auto", className)}
      onKeyDown={handleKeyDown}
    >
      {/* Step indicators */}
      <nav aria-label="Wizard steps" className="mb-8">
        <ol className="flex items-center">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            const isClickable = onStepClick && index <= currentStep;
            const validation = step.validation ?? (isCompleted ? "valid" : "pending");

            return (
              <li
                key={index}
                className={cn("flex items-center", index < steps.length - 1 && "flex-1")}
              >
                {/* Step circle */}
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick?.(index)}
                  disabled={!isClickable}
                  className={cn(
                    "flex flex-col items-center gap-1.5 group",
                    isClickable && "cursor-pointer",
                    !isClickable && "cursor-default"
                  )}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`Step ${index + 1}: ${step.label}${isCompleted ? " (completed)" : isCurrent ? " (current)" : ""}`}
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-medium transition-all duration-200",
                      isCompleted
                        ? "border-green-500 bg-green-500 text-white"
                        : isCurrent
                          ? "border-[var(--vds-color-primary)] bg-[var(--vds-color-primary)] text-white shadow-sm"
                          : "border-[var(--vds-color-border)] bg-[var(--vds-color-surface)] text-[var(--vds-color-text-muted)]",
                      isClickable && !isCurrent && "group-hover:border-[var(--vds-color-primary)]/50"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium text-center max-w-[90px] leading-tight",
                      isCurrent
                        ? "text-[var(--vds-color-primary)]"
                        : isCompleted
                          ? "text-[var(--vds-color-text-primary)]"
                          : "text-[var(--vds-color-text-muted)]"
                    )}
                  >
                    {step.label}
                  </span>
                </button>

                {/* Connector */}
                {index < steps.length - 1 && (
                  <div className="flex-1 mx-3 mt-[-1.25rem]">
                    <div
                      className={cn(
                        "h-0.5 w-full rounded-full transition-all duration-300",
                        isCompleted ? "bg-green-500" : "bg-[var(--vds-color-border)]"
                      )}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Step description */}
      {currentStepData?.description && (
        <p className="text-sm text-[var(--vds-color-text-muted)] mb-4 text-center">
          {currentStepData.description}
        </p>
      )}

      {/* Step content */}
      <div
        ref={contentRef}
        className="mb-8 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vds-color-primary)]/30 rounded-lg"
        tabIndex={-1}
        role="region"
        aria-label={`Step ${currentStep + 1}: ${currentStepData?.label ?? "Step"}`}
      >
        {currentStepData?.content ?? (
          <div className="text-center text-[var(--vds-color-text-muted)] py-8">
            Invalid step
          </div>
        )}
      </div>

      {/* Validation feedback */}
      {currentStepData?.validation === "invalid" && (
        <p className="text-xs text-red-500 mb-3 text-center" role="alert">
          Please complete all required fields before continuing.
        </p>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={!canBack}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition-colors",
            "border border-[var(--vds-color-border)] text-[var(--vds-color-text-primary)] hover:bg-[var(--vds-color-surface)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vds-color-primary)]/30",
            "disabled:opacity-50 disabled:pointer-events-none"
          )}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {backLabel}
        </button>

        {/* Step counter */}
        <span className="text-xs text-[var(--vds-color-text-muted)] tabular-nums">
          {currentStep + 1} of {steps.length}
        </span>

        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          className={cn(
            "inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-md transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vds-color-primary)]/30",
            "disabled:opacity-50 disabled:pointer-events-none",
            isLastStep
              ? "bg-green-500 text-white hover:bg-green-600"
              : "bg-[var(--vds-color-primary)] text-white hover:brightness-110"
          )}
        >
          {isLastStep ? finishLabel : (nextLabel ?? "Next")}
          {!isLastStep && <ChevronRight className="h-4 w-4" aria-hidden="true" />}
          {isLastStep && <Check className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
};

StepperWizard.displayName = "StepperWizard";

export default StepperWizard;
