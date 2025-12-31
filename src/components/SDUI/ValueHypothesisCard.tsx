/**
 * ValueHypothesisCard Component
 *
 * Displays a value hypothesis with title, description, confidence, and source.
 * Modeled after the "Suggested Hypotheses" cards in the original static view.
 */

import React from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { ConfidenceIndicator } from "./ConfidenceIndicator";

export interface ValueHypothesis {
  id: string | number;
  title: string;
  description: string;
  confidence: number;
  source?: string;
  kpiImpact?: string;
}

export interface ValueHypothesisCardProps {
  hypothesis: ValueHypothesis;
  isSelected?: boolean;
  onClick?: () => void;
  onAction?: (action: string, payload: any) => void;
  className?: string;
}

export const ValueHypothesisCard: React.FC<ValueHypothesisCardProps> = ({
  hypothesis,
  isSelected = false,
  onClick,
  onAction,
  className = "",
}) => {
  const handleClick = () => {
    if (onClick) onClick();
    if (onAction) {
      onAction("select_hypothesis", {
        id: hypothesis.id,
        title: hypothesis.title,
        description: hypothesis.description,
      });
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`
        w-full text-left p-5 rounded-xl border transition-all duration-200 group relative overflow-hidden
        ${
          isSelected
            ? "ring-2 ring-emerald-500 bg-emerald-500/5 border-emerald-500/30"
            : "bg-card hover:bg-accent/50 border-border hover:border-emerald-500/30"
        }
        ${className}
      `}
      aria-pressed={isSelected}
    >
      <div className="flex items-start justify-between gap-4 relative z-10">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div
              className={`p-1.5 rounded-md ${isSelected ? "bg-emerald-500/10" : "bg-secondary group-hover:bg-emerald-500/10 transition-colors"}`}
            >
              <Sparkles
                className={`w-4 h-4 ${isSelected ? "text-emerald-500" : "text-muted-foreground group-hover:text-emerald-500 transition-colors"}`}
                aria-hidden="true"
              />
            </div>
            <span className="font-semibold text-foreground text-lg tracking-tight">
              {hypothesis.title}
            </span>
          </div>

          <p className="text-sm text-foreground/80 mb-3 leading-relaxed">
            {hypothesis.description}
          </p>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {hypothesis.source && (
              <span className="px-2 py-0.5 rounded-full bg-secondary/50 border border-border/50">
                Source: {hypothesis.source}
              </span>
            )}
            {hypothesis.kpiImpact && (
              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-200/50">
                Impact: {hypothesis.kpiImpact}
              </span>
            )}
          </div>
        </div>

        <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
          <div className="text-2xl font-bold text-foreground tabular-nums">
            {hypothesis.confidence}%
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
            Confidence
          </div>
          <ConfidenceIndicator
            value={hypothesis.confidence / 100}
            size="sm"
            variant="bar"
            showPercentage={false}
            className="mt-2 w-16"
          />
        </div>
      </div>

      {/* Hover Effect Gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/0 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </button>
  );
};
