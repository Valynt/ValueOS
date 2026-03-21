/**
 * MetricCard — SDUI component
 *
 * Renders a single VgMetric node with baseline → target values, evidence tier
 * badge, impact timeframe, and expandable measurement method.
 *
 * Registered as intentType "show_metric_card" in both:
 *   - scripts/config/ui-registry.json
 *   - packages/sdui/src/registry.tsx
 *
 * Sprint 50: Initial implementation.
 */

import React, { useState } from "react";

// ---------------------------------------------------------------------------
// Types (mirrors VgMetric + EvidenceTier from @valueos/shared)
// ---------------------------------------------------------------------------

export type VgMetricUnit =
  | "usd"
  | "percent"
  | "hours"
  | "headcount"
  | "days"
  | "count"
  | "score";

export type EvidenceTier = "silver" | "gold" | "platinum";

export interface MetricCardMetric {
  id: string;
  name: string;
  unit: VgMetricUnit;
  baseline_value?: number | null;
  target_value?: number | null;
  measurement_method?: string | null;
  impact_timeframe_months?: number | null;
}

export interface MetricCardProps {
  metric: MetricCardMetric;
  /** Highest evidence tier linked to this metric via evidence_supports_metric edges. */
  evidenceTier?: EvidenceTier | null;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TIER_STYLES: Record<EvidenceTier, { label: string; classes: string }> = {
  silver: {
    label: "Silver",
    classes: "bg-zinc-100 text-zinc-600 border border-zinc-300",
  },
  gold: {
    label: "Gold",
    classes: "bg-amber-50 text-amber-700 border border-amber-300",
  },
  platinum: {
    label: "Platinum",
    classes: "bg-sky-50 text-sky-700 border border-sky-300",
  },
};

function formatValue(value: number, unit: VgMetricUnit): string {
  switch (unit) {
    case "usd": {
      if (Math.abs(value) >= 1_000_000)
        return `$${(value / 1_000_000).toFixed(1)}M`;
      if (Math.abs(value) >= 1_000)
        return `$${(value / 1_000).toFixed(0)}K`;
      return `$${value.toFixed(0)}`;
    }
    case "percent":
      return `${value.toFixed(1)}%`;
    case "hours":
      return `${value.toLocaleString()} hrs`;
    case "days":
      return `${value.toLocaleString()} days`;
    case "headcount":
      return `${value.toLocaleString()} HC`;
    case "count":
      return value.toLocaleString();
    case "score":
      return value.toFixed(1);
    default:
      return String(value);
  }
}

const MEASUREMENT_CLAMP = "line-clamp-2";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MetricCard({
  metric,
  evidenceTier,
  className = "",
}: MetricCardProps) {
  const [methodExpanded, setMethodExpanded] = useState(false);

  const hasBaseline = metric.baseline_value != null;
  const hasTarget = metric.target_value != null;
  const tierStyle = evidenceTier ? TIER_STYLES[evidenceTier] : null;

  return (
    <div
      className={`bg-card border border-border rounded-lg p-4 space-y-3 ${className}`}
      data-testid="metric-card"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground leading-snug">
          {metric.name}
        </h4>
        {tierStyle && (
          <span
            className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${tierStyle.classes}`}
            data-testid="evidence-tier-badge"
          >
            {tierStyle.label}
          </span>
        )}
      </div>

      {/* Baseline → Target */}
      {(hasBaseline || hasTarget) && (
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono text-muted-foreground">
            {hasBaseline
              ? formatValue(metric.baseline_value!, metric.unit)
              : "—"}
          </span>
          <span className="text-muted-foreground text-xs">→</span>
          <span className="font-mono font-semibold text-foreground">
            {hasTarget
              ? formatValue(metric.target_value!, metric.unit)
              : "—"}
          </span>
        </div>
      )}

      {/* Impact timeframe */}
      {metric.impact_timeframe_months != null && (
        <p className="text-xs text-muted-foreground">
          Impact in{" "}
          <span className="font-medium text-foreground">
            {metric.impact_timeframe_months}
          </span>{" "}
          {metric.impact_timeframe_months === 1 ? "month" : "months"}
        </p>
      )}

      {/* Measurement method */}
      {metric.measurement_method && (
        <div>
          <p
            className={`text-xs text-muted-foreground ${methodExpanded ? "" : MEASUREMENT_CLAMP}`}
          >
            {metric.measurement_method}
          </p>
          <button
            type="button"
            onClick={() => setMethodExpanded((v) => !v)}
            className="mt-0.5 text-[10px] text-primary hover:underline"
          >
            {methodExpanded ? "Show less" : "Show more"}
          </button>
        </div>
      )}
    </div>
  );
}

MetricCard.displayName = "MetricCard";
