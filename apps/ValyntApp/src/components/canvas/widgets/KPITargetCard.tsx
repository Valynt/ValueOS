/**
 * KPITargetCard Widget
 *
 * Metric name, baseline → target, timeline, source badge, progress indicator (for post-sale).
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §3.5
 */

import { SourceBadge, SourceType } from "@valueos/components/components/SourceBadge";
import { Minus, Target, TrendingDown, TrendingUp } from "lucide-react";
import React from "react";

import { WidgetProps } from "../CanvasHost";

export interface KPITarget {
  id: string;
  metricName: string;
  baseline: number;
  target: number;
  unit: string;
  timeline: {
    startDate: string;
    targetDate: string;
  };
  source: SourceType;
  progress: number; // 0-100
  currentValue?: number;
}

export interface KPITargetCardData {
  targets: KPITarget[];
}

export function KPITargetCard({ data }: WidgetProps) {
  const widgetData = data as unknown as KPITargetCardData;
  const targets = widgetData.targets ?? [];

  const formatValue = (value: number, unit: string) => {
    if (unit === "$" || unit === "USD") {
      if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
      return `$${value.toLocaleString()}`;
    }
    if (unit === "%") return `${value.toFixed(1)}%`;
    return `${value.toLocaleString()} ${unit}`;
  };

  const getTrendIcon = (baseline: number, target: number) => {
    if (target > baseline) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (target < baseline) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-500" />;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {targets.map((target) => {
        const isImproving = target.target > target.baseline;
        const isOnTrack = target.progress >= 50; // Simple heuristic

        return (
          <div key={target.id} className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">{target.metricName}</h4>
              {getTrendIcon(target.baseline, target.target)}
            </div>

            {/* Value comparison */}
            <div className="flex items-center gap-3 mb-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Baseline</p>
                <p className="font-medium">{formatValue(target.baseline, target.unit)}</p>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <div className="h-px flex-1 bg-border" />
                <span className="mx-2 text-xs text-muted-foreground">→</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Target</p>
                <p className={`font-bold ${isImproving ? "text-green-600" : "text-red-600"}`}>
                  {formatValue(target.target, target.unit)}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Progress</span>
                <span className={isOnTrack ? "text-green-600" : "text-amber-600"}>
                  {target.progress.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isOnTrack ? "bg-green-500" : "bg-amber-500"
                  }`}
                  style={{ width: `${Math.min(target.progress, 100)}%` }}
                />
              </div>
              {target.currentValue !== undefined && (
                <p className="text-xs text-muted-foreground mt-1">
                  Current: {formatValue(target.currentValue, target.unit)}
                </p>
              )}
            </div>

            {/* Timeline */}
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
              <span>{new Date(target.timeline.startDate).toLocaleDateString()}</span>
              <span>{new Date(target.timeline.targetDate).toLocaleDateString()}</span>
            </div>

            {/* Source badge */}
            <SourceBadge sourceType={target.source} size="sm" showTier={false} />
          </div>
        );
      })}

      {targets.length === 0 && (
        <div className="col-span-full text-center py-8 text-muted-foreground">
          <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No KPI targets defined</p>
        </div>
      )}
    </div>
  );
}

export default KPITargetCard;
