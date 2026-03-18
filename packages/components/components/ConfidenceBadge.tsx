/**
 * ConfidenceBadge
 *
 * Displays a confidence score (0-1) with color coding and tier indicator.
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §1.2
 */

import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";

export interface ConfidenceBadgeProps {
  score: number; // 0-1
  className?: string;
  showTooltip?: boolean;
}

export function ConfidenceBadge({ score, className = "", showTooltip = true }: ConfidenceBadgeProps) {
  // Normalize score to 0-1 range
  const normalizedScore = Math.max(0, Math.min(1, score));
  const percentage = Math.round(normalizedScore * 100);

  // Determine tier and color
  let tier: "High" | "Medium" | "Low";
  let colorClass: string;

  if (normalizedScore >= 0.8) {
    tier = "High";
    colorClass = "bg-green-100 text-green-800 border-green-200";
  } else if (normalizedScore >= 0.5) {
    tier = "Medium";
    colorClass = "bg-amber-100 text-amber-800 border-amber-200";
  } else {
    tier = "Low";
    colorClass = "bg-red-100 text-red-800 border-red-200";
  }

  const badge = (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colorClass} ${className}`}
      aria-label={`Confidence: ${percentage}% - ${tier} confidence`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      <span>{percentage}%</span>
      <span className="opacity-75">• {tier}</span>
    </span>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top">
          <div className="space-y-1">
            <p className="font-medium">Confidence Score: {percentage}%</p>
            <p className="text-xs text-muted-foreground">
              Tier thresholds: High ≥80%, Medium ≥50%, Low &lt;50%
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
