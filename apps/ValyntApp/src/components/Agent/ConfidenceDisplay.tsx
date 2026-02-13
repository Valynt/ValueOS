/**
 * ConfidenceDisplay
 *
 * Visual confidence meter with color-coded tiers, optional tooltip breakdown,
 * and screen reader support.
 *
 * UX Principles:
 * - Visual Hierarchy: color tiers (red/amber/green) for instant recognition
 * - Immediate Feedback: animated fill on mount/change
 * - Accessibility: aria-label with percentage, high-contrast colors
 */

import React, { useState } from "react";
import { cn } from "@/lib/utils";

type ConfidenceSize = "sm" | "md" | "lg";

export interface ConfidenceBreakdown {
  freshness?: number;
  reliability?: number;
  transparency?: number;
}

export interface ConfidenceDisplayProps {
  /** Score 0–1 (or via data.score for backward compat) */
  value?: number;
  data?: { score: number };
  label?: string;
  showLabel?: boolean;
  size?: ConfidenceSize;
  breakdown?: ConfidenceBreakdown;
  className?: string;
}

function getTier(score: number): { label: string; color: string; bg: string; ring: string } {
  if (score >= 0.7) return { label: "High", color: "text-success", bg: "bg-success", ring: "ring-success/30" };
  if (score >= 0.4) return { label: "Medium", color: "text-warning", bg: "bg-warning", ring: "ring-warning/30" };
  return { label: "Low", color: "text-destructive", bg: "bg-destructive", ring: "ring-destructive/30" };
}

const sizeConfig: Record<ConfidenceSize, { wrapper: string; text: string; bar: string; dot: string }> = {
  sm: { wrapper: "gap-1.5", text: "text-xs", bar: "h-1 w-12", dot: "h-2 w-2" },
  md: { wrapper: "gap-2", text: "text-sm", bar: "h-1.5 w-16", dot: "h-2.5 w-2.5" },
  lg: { wrapper: "gap-2.5", text: "text-base", bar: "h-2 w-20", dot: "h-3 w-3" },
};

export function ConfidenceDisplay({
  value,
  data,
  label,
  showLabel = true,
  size = "md",
  breakdown,
  className,
}: ConfidenceDisplayProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const score = value ?? data?.score ?? 0;
  const pct = Math.round(score * 100);
  const tier = getTier(score);
  const sizes = sizeConfig[size];

  return (
    <div
      className={cn("relative inline-flex items-center", sizes.wrapper, className)}
      onMouseEnter={() => breakdown && setShowBreakdown(true)}
      onMouseLeave={() => setShowBreakdown(false)}
      onFocus={() => breakdown && setShowBreakdown(true)}
      onBlur={() => setShowBreakdown(false)}
      tabIndex={breakdown ? 0 : undefined}
      role="meter"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${label ? label + ": " : ""}Confidence ${pct}% (${tier.label})`}
    >
      {/* Color dot indicator */}
      <span className={cn("rounded-full shrink-0", sizes.dot, tier.bg)} />

      {/* Mini bar */}
      <div className={cn("overflow-hidden rounded-full bg-secondary", sizes.bar)}>
        <div
          className={cn("h-full rounded-full transition-all duration-500 ease-out", tier.bg)}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Percentage text */}
      <span className={cn("font-medium tabular-nums", sizes.text, tier.color)}>
        {pct}%
      </span>

      {/* Optional label */}
      {showLabel && label && (
        <span className={cn("text-muted-foreground", sizes.text)}>{label}</span>
      )}

      {/* Breakdown tooltip */}
      {breakdown && showBreakdown && (
        <div
          className="absolute top-full left-0 mt-2 z-50 w-48 rounded-md border border-border bg-popover p-3 shadow-md animate-in fade-in-0 zoom-in-95"
          role="tooltip"
        >
          <p className="text-xs font-medium text-foreground mb-2">Score Breakdown</p>
          <div className="space-y-1.5">
            {breakdown.freshness !== undefined && (
              <BreakdownRow label="Freshness" value={breakdown.freshness} weight={30} />
            )}
            {breakdown.reliability !== undefined && (
              <BreakdownRow label="Reliability" value={breakdown.reliability} weight={40} />
            )}
            {breakdown.transparency !== undefined && (
              <BreakdownRow label="Transparency" value={breakdown.transparency} weight={30} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BreakdownRow({ label, value, weight }: { label: string; value: number; weight: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">
        {label} <span className="text-muted-foreground/60">({weight}%)</span>
      </span>
      <span className="font-medium tabular-nums text-foreground">{pct}%</span>
    </div>
  );
}

export default ConfidenceDisplay;
