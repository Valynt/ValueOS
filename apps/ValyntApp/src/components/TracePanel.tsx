// apps/ValyntApp/src/components/TracePanel.tsx
import { CheckCircle, ChevronDown, ChevronRight, Link2 } from "lucide-react";
import React, { useState, useCallback } from "react";

import { cn } from "@/lib/utils";

interface TraceStep {
  step: string;
  citation?: string;
  confidence?: number;
  details?: string;
}

interface TracePanelProps {
  steps: TraceStep[];
  title?: string;
  defaultExpanded?: boolean;
}

const containerClasses = "bg-[var(--vds-color-surface)] border border-[var(--vds-color-border)] rounded-lg p-4";
const titleClasses = "text-lg font-semibold text-[var(--vds-color-text-primary)] mb-4";
const stepContainerClasses = "space-y-2";
const stepClasses = "flex items-start gap-3 p-2 rounded-lg transition-colors hover:bg-[var(--vds-color-surface-2)]/50";
const stepNumberClasses = "flex-shrink-0 w-6 h-6 rounded-full bg-[var(--vds-color-primary)]/10 text-[var(--vds-color-primary)] flex items-center justify-center text-xs font-medium";
const stepContentClasses = "flex-1 min-w-0";
const stepTextClasses = "text-sm text-[var(--vds-color-text-primary)]";
const citationClasses = "text-xs text-[var(--vds-color-text-muted)] mt-1 flex items-center gap-1";
const confidenceClasses = "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium mt-1";
const expandButtonClasses = "p-1 rounded hover:bg-[var(--vds-color-surface-2)] transition-colors text-[var(--vds-color-text-muted)]";

const getConfidenceStyle = (confidence: number): string => {
  if (confidence >= 0.8) return "bg-green-500/10 text-green-500";
  if (confidence >= 0.5) return "bg-amber-500/10 text-amber-500";
  return "bg-red-500/10 text-red-500";
};

const TracePanel: React.FC<TracePanelProps> = ({ steps, title = "Reasoning Trace", defaultExpanded = false }) => {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(defaultExpanded ? new Set(steps.map((_, i) => i)) : new Set());

  const toggleStep = useCallback((index: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  return (
    <div className={containerClasses}>
      <h3 className={titleClasses}>{title}</h3>
      <div className={stepContainerClasses}>
        {steps.map((step, index) => {
          const isExpanded = expandedSteps.has(index);

          return (
            <div key={index} className={stepClasses}>
              <div className={stepNumberClasses}>
                {index + 1}
              </div>
              <div className={stepContentClasses}>
                <div className="flex items-start justify-between gap-2">
                  <p className={stepTextClasses}>{step.step}</p>
                  {step.details && (
                    <button
                      onClick={() => toggleStep(index)}
                      className={expandButtonClasses}
                      aria-label={isExpanded ? "Collapse details" : "Expand details"}
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  )}
                </div>

                {step.citation && (
                  <p className={citationClasses}>
                    <Link2 className="w-3 h-3" aria-hidden="true" />
                    Citation: {step.citation}
                  </p>
                )}

                {step.confidence !== undefined && (
                  <span className={cn(confidenceClasses, getConfidenceStyle(step.confidence))}>
                    {(step.confidence * 100).toFixed(0)}% confidence
                  </span>
                )}

                {isExpanded && step.details && (
                  <div className="mt-2 p-2 bg-[var(--vds-color-surface-2)] rounded text-xs text-[var(--vds-color-text-secondary)]">
                    {step.details}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

TracePanel.displayName = "TracePanel";

export default TracePanel;
