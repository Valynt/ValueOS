/**
 * ValuePathCard — SDUI component
 *
 * Renders a single causal value path: UseCase → Capability → Metric →
 * ValueDriver. Shows path confidence, each hop with entity-type badge, and
 * evidence tier chips per metric.
 *
 * Registered as intentType "show_value_path_card" in both:
 *   - scripts/config/ui-registry.json
 *   - packages/sdui/src/registry.tsx
 *
 * Sprint 50: Initial implementation.
 */

import React from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

import type { VgValueDriverType } from "@shared/domain/VgValueDriver";

export type { VgValueDriverType };

export type ValueGraphEntityType =
  | "account"
  | "stakeholder"
  | "use_case"
  | "vg_capability"
  | "vg_metric"
  | "vg_value_driver"
  | "evidence"
  | "value_hypothesis";

export type EvidenceTier = "silver" | "gold" | "platinum";

export interface PathMetric {
  id: string;
  name: string;
  unit: string;
  /** Evidence IDs linked to this metric via evidence_supports_metric edges. */
  evidence_ids?: string[];
  /** Highest evidence tier for this metric (resolved by parent). */
  evidence_tier?: EvidenceTier | null;
  /** Source URL for the highest-tier evidence item, if available. */
  evidence_source_url?: string | null;
}

export interface PathCapability {
  id: string;
  name: string;
}

export interface PathValueDriver {
  id: string;
  name: string;
  type: VgValueDriverType;
  estimated_impact_usd?: number | null;
}

export interface ValuePathCardPath {
  path_confidence: number;
  use_case_id: string;
  /** Human-readable label for the use case (resolved by parent if available). */
  use_case_label?: string;
  capabilities: PathCapability[];
  metrics: PathMetric[];
  value_driver: PathValueDriver;
}

export interface ValuePathCardProps {
  path: ValuePathCardPath;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ENTITY_LABELS: Record<string, string> = {
  use_case: "Use Case",
  vg_capability: "Capability",
  vg_metric: "Metric",
  vg_value_driver: "Value Driver",
};

const DRIVER_TYPE_LABELS: Record<VgValueDriverType, string> = {
  revenue_growth: "Revenue Growth",
  cost_reduction: "Cost Reduction",
  risk_mitigation: "Risk Mitigation",
  capital_efficiency: "Capital Efficiency",
};

const DRIVER_TYPE_COLORS: Record<VgValueDriverType, string> = {
  revenue_growth: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cost_reduction: "bg-blue-50 text-blue-700 border-blue-200",
  risk_mitigation: "bg-amber-50 text-amber-700 border-amber-200",
  capital_efficiency: "bg-violet-50 text-violet-700 border-violet-200",
};

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

function ConfidencePill({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 70
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : pct >= 40
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-red-50 text-red-700 border-red-200";

  return (
    <span
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${color}`}
      data-testid="confidence-pill"
    >
      {pct}% confidence
    </span>
  );
}

function EntityBadge({ type }: { type: string }) {
  return (
    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground uppercase tracking-wide">
      {ENTITY_LABELS[type] ?? type}
    </span>
  );
}

function HopArrow() {
  return (
    <span className="text-muted-foreground text-xs select-none" aria-hidden>
      →
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ValuePathCard({ path, className = "" }: ValuePathCardProps) {
  const driverColor =
    DRIVER_TYPE_COLORS[path.value_driver.type] ??
    "bg-zinc-50 text-zinc-700 border-zinc-200";

  return (
    <div
      className={`bg-card border border-border rounded-lg p-4 space-y-3 ${className}`}
      data-testid="value-path-card"
    >
      {/* Header: confidence + driver type */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <ConfidencePill value={path.path_confidence} />
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${driverColor}`}
        >
          {DRIVER_TYPE_LABELS[path.value_driver.type]}
        </span>
      </div>

      {/* Causal chain */}
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        {/* Use case */}
        <div className="flex flex-col gap-0.5">
          <EntityBadge type="use_case" />
          <span className="text-xs text-foreground font-medium">
            {path.use_case_label ?? path.use_case_id.slice(0, 8) + "…"}
          </span>
        </div>

        {path.capabilities.map((cap) => (
          <React.Fragment key={cap.id}>
            <HopArrow />
            <div className="flex flex-col gap-0.5">
              <EntityBadge type="vg_capability" />
              <span className="text-xs text-foreground">{cap.name}</span>
            </div>
          </React.Fragment>
        ))}

        {path.metrics.map((metric) => (
          <React.Fragment key={metric.id}>
            <HopArrow />
            <div className="flex flex-col gap-0.5">
              <EntityBadge type="vg_metric" />
              <span className="text-xs text-foreground">{metric.name}</span>
            </div>
          </React.Fragment>
        ))}

        <HopArrow />
        <div className="flex flex-col gap-0.5">
          <EntityBadge type="vg_value_driver" />
          <span className="text-xs text-foreground font-semibold">
            {path.value_driver.name}
          </span>
        </div>
      </div>

      {/* Evidence chips per metric */}
      {path.metrics.some((m) => m.evidence_tier) && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border">
          {path.metrics.map((metric) => {
            if (!metric.evidence_tier) return null;
            const tier = TIER_STYLES[metric.evidence_tier];
            const chip = (
              <span
                key={metric.id}
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${tier.classes}`}
                data-testid="evidence-chip"
              >
                {metric.name}: {tier.label}
              </span>
            );
            if (metric.evidence_source_url) {
              return (
                <a
                  key={metric.id}
                  href={metric.evidence_source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-80 transition-opacity"
                >
                  {chip}
                </a>
              );
            }
            return chip;
          })}
        </div>
      )}

      {/* Estimated impact */}
      {path.value_driver.estimated_impact_usd != null && (
        <p className="text-xs text-muted-foreground">
          Est. impact:{" "}
          <span className="font-semibold text-foreground">
            {path.value_driver.estimated_impact_usd >= 1_000_000
              ? `$${(path.value_driver.estimated_impact_usd / 1_000_000).toFixed(1)}M`
              : path.value_driver.estimated_impact_usd >= 1_000
                ? `$${(path.value_driver.estimated_impact_usd / 1_000).toFixed(0)}K`
                : `$${path.value_driver.estimated_impact_usd.toFixed(0)}`}
          </span>
        </p>
      )}
    </div>
  );
}

ValuePathCard.displayName = "ValuePathCard";
