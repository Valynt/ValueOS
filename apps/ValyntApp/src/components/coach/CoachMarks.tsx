/**
 * CoachMarks — Contextual Progressive Guidance Component
 *
 * Displays inline coach marks and tooltips for progressive onboarding
 * and contextual guidance within the Journey-Driven Workbench.
 *
 * Features:
 * - Spotlight highlighting for important UI elements
 * - Step-by-step walkthroughs for new users
 * - Contextual tips based on current phase/state
 * - Dismissible and auto-hiding
 * - Keyboard navigable
 *
 * Sprint 55: Progressive disclosure and seamless UX.
 */

import { cva, type VariantProps } from "class-variance-authority";
import { Lightbulb, X, ChevronRight, ChevronLeft, Check } from "lucide-react";
import React, { useState, useCallback, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface CoachMarkStep {
  id: string;
  target: string; // CSS selector for target element
  title: string;
  content: string;
  placement: "top" | "bottom" | "left" | "right" | "center";
  spotlight?: boolean;
  dismissible?: boolean;
  autoHide?: number; // ms to auto-hide, 0 = no auto-hide
  primaryAction?: {
    label: string;
    action: () => void;
  };
  secondaryAction?: {
    label: string;
    action: () => void;
  };
}

export interface CoachMarkProps extends VariantProps<typeof coachMarkVariants> {
  steps: CoachMarkStep[];
  currentStep?: number;
  onComplete?: () => void;
  onDismiss?: (stepId: string) => void;
  onStepChange?: (step: number) => void;
  showProgress?: boolean;
  allowSkip?: boolean;
  className?: string;
}

// ============================================================================
// Styling
// ============================================================================

const coachMarkVariants = cva(
  "relative z-50 rounded-lg border bg-card p-4 shadow-lg",
  {
    variants: {
      variant: {
        default: "border-border",
        highlighted: "border-primary ring-2 ring-primary/20",
        subtle: "border-border/50 bg-card/80 backdrop-blur",
      },
      size: {
        sm: "max-w-xs",
        md: "max-w-sm",
        lg: "max-w-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

const spotlightVariants = cva(
  "fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity",
  {
    variants: {
      visible: {
        true: "opacity-100",
        false: "opacity-0 pointer-events-none",
      },
    },
  }
);

// ============================================================================
// Component
// ============================================================================

export function CoachMarks({
  steps,
  currentStep = 0,
  onComplete,
  onDismiss,
  onStepChange,
  showProgress = true,
  allowSkip = true,
  variant,
  size,
  className,
}: CoachMarkProps) {
  const [activeStep, setActiveStep] = useState(currentStep);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [visible, setVisible] = useState(true);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const autoHideTimerRef = useRef<NodeJS.Timeout | null>(null);

  const step = steps[activeStep];
  const isFirst = activeStep === 0;
  const isLast = activeStep === steps.length - 1;

  // Calculate tooltip position based on target element
  const updatePosition = useCallback(() => {
    if (!step) return;

    if (step.placement === "center") {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      setPosition({ top: centerY - 100, left: centerX - 150 });
      setTargetRect(null);
      return;
    }

    const target = document.querySelector(step.target);
    if (!target) {
      // Target not found, center on screen
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      setPosition({ top: centerY - 100, left: centerX - 150 });
      setTargetRect(null);
      return;
    }

    const rect = target.getBoundingClientRect();
    setTargetRect(rect);

    const tooltipWidth = tooltipRef.current?.offsetWidth ?? 300;
    const tooltipHeight = tooltipRef.current?.offsetHeight ?? 150;

    let top = 0;
    let left = 0;

    switch (step.placement) {
      case "top":
        top = rect.top - tooltipHeight - 16;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "bottom":
        top = rect.bottom + 16;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "left":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - 16;
        break;
      case "right":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + 16;
        break;
    }

    // Keep within viewport
    const padding = 16;
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltipHeight - padding));
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));

    setPosition({ top, left });
  }, [step]);

  // Update position on mount and when step changes
  useEffect(() => {
    updatePosition();

    // Recalculate on resize
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [updatePosition]);

  // Auto-hide timer
  useEffect(() => {
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
    }

    if (step?.autoHide && step.autoHide > 0) {
      autoHideTimerRef.current = setTimeout(() => {
        handleDismiss();
      }, step.autoHide);
    }

    return () => {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
      }
    };
  }, [step]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!visible) return;

      switch (e.key) {
        case "Escape":
          handleDismiss();
          break;
        case "ArrowRight":
          if (!isLast) handleNext();
          break;
        case "ArrowLeft":
          if (!isFirst) handlePrev();
          break;
        case "Enter":
          if (step?.primaryAction) {
            step.primaryAction.action();
          } else if (!isLast) {
            handleNext();
          } else {
            handleComplete();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, isFirst, isLast, step, activeStep]);

  const handleNext = () => {
    if (activeStep < steps.length - 1) {
      const nextStep = activeStep + 1;
      setActiveStep(nextStep);
      onStepChange?.(nextStep);
    }
  };

  const handlePrev = () => {
    if (activeStep > 0) {
      const prevStep = activeStep - 1;
      setActiveStep(prevStep);
      onStepChange?.(prevStep);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    onDismiss?.(step?.id ?? "");
  };

  const handleComplete = () => {
    setVisible(false);
    onComplete?.();
  };

  const handleSkip = () => {
    setVisible(false);
    onComplete?.();
  };

  if (!visible || !step) return null;

  return (
    <>
      {/* Spotlight overlay */}
      {step.spotlight && targetRect && (
        <div className={spotlightVariants({ visible: true })}>
          {/* Cutout for target element */}
          <div
            className="absolute bg-transparent ring-4 ring-primary/30 rounded-lg transition-all"
            style={{
              top: targetRect.top - 8,
              left: targetRect.left - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
            }}
          />
        </div>
      )}

      {/* Coach mark tooltip */}
      <div
        ref={tooltipRef}
        className={cn(
          coachMarkVariants({ variant, size }),
          "fixed animate-in fade-in zoom-in-95 duration-200",
          className
        )}
        style={{
          top: position.top,
          left: position.left,
        }}
        role="dialog"
        aria-label={`Step ${activeStep + 1} of ${steps.length}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            <h3 className="font-medium text-sm">{step.title}</h3>
          </div>
          {step.dismissible !== false && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={handleDismiss}
              aria-label="Dismiss"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Content */}
        <p className="text-sm text-muted-foreground mb-4">{step.content}</p>

        {/* Progress indicator */}
        {showProgress && steps.length > 1 && (
          <div className="flex items-center gap-1 mb-4">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  idx <= activeStep ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {steps.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={handlePrev}
                  disabled={isFirst}
                >
                  <ChevronLeft className="h-3 w-3 mr-1" />
                  Prev
                </Button>
                <span className="text-xs text-muted-foreground">
                  {activeStep + 1} / {steps.length}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {allowSkip && !isLast && (
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleSkip}>
                Skip
              </Button>
            )}

            {step.secondaryAction && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-3"
                onClick={step.secondaryAction.action}
              >
                {step.secondaryAction.label}
              </Button>
            )}

            {step.primaryAction ? (
              <Button
                size="sm"
                className="h-7 px-3"
                onClick={() => {
                  step.primaryAction?.action();
                  if (!isLast) handleNext();
                }}
              >
                {step.primaryAction.label}
                {!isLast && <ChevronRight className="h-3 w-3 ml-1" />}
              </Button>
            ) : isLast ? (
              <Button size="sm" className="h-7 px-3" onClick={handleComplete}>
                <Check className="h-3 w-3 mr-1" />
                Done
              </Button>
            ) : (
              <Button size="sm" className="h-7 px-3" onClick={handleNext}>
                Next
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// Simplified Single Coach Mark
// ============================================================================

export interface SingleCoachMarkProps {
  target: string;
  title: string;
  content: string;
  placement?: CoachMarkStep["placement"];
  variant?: VariantProps<typeof coachMarkVariants>["variant"];
  dismissible?: boolean;
  autoHide?: number;
  onDismiss?: () => void;
  primaryAction?: {
    label: string;
    action: () => void;
  };
}

export function CoachMark({
  target,
  title,
  content,
  placement = "bottom",
  variant = "highlighted",
  dismissible = true,
  autoHide,
  onDismiss,
  primaryAction,
}: SingleCoachMarkProps) {
  return (
    <CoachMarks
      steps={[
        {
          id: "single",
          target,
          title,
          content,
          placement,
          spotlight: true,
          dismissible,
          autoHide,
          primaryAction,
        },
      ]}
      onDismiss={() => onDismiss?.()}
      variant={variant}
      showProgress={false}
      allowSkip={false}
    />
  );
}

export default CoachMarks;
