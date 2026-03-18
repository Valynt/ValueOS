/**
 * UsageMeter Widget
 *
 * Horizontal bar showing used/cap with percentage, color shifts at 80% and 100%, reset date.
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §3.6
 */

import React from "react";
import { Gauge, Zap } from "lucide-react";
import { WidgetProps } from "../CanvasHost";

export interface UsageMeterData {
  meterName: string;
  meterKey: string;
  used: number;
  cap: number;
  unit: string;
  resetDate: string;
  trend: "up" | "down" | "flat";
  trendPercentage: number;
}

export function UsageMeter({ data }: WidgetProps) {
  const widgetData = data as unknown as UsageMeterData;
  const { meterName, used, cap, unit, resetDate, trend, trendPercentage } = widgetData;

  const percentage = Math.min((used / cap) * 100, 100);

  // Color logic: green < 80%, amber 80-100%, red > 100%
  const getBarColor = () => {
    if (percentage >= 100) return "bg-red-500";
    if (percentage >= 80) return "bg-amber-500";
    return "bg-green-500";
  };

  const getStatusText = () => {
    if (percentage >= 100) return "Over limit";
    if (percentage >= 80) return "Approaching limit";
    return "Within limit";
  };

  const getStatusColor = () => {
    if (percentage >= 100) return "text-red-600";
    if (percentage >= 80) return "text-amber-600";
    return "text-green-600";
  };

  const formatValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toLocaleString();
  };

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Gauge className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h4 className="font-semibold">{meterName}</h4>
            <p className="text-xs text-muted-foreground">
              Resets {new Date(resetDate).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-sm font-medium ${getStatusColor()}`}>{getStatusText()}</p>
          <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}% used</p>
        </div>
      </div>

      {/* Usage bar */}
      <div className="mb-3">
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getBarColor()}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>

      {/* Usage details */}
      <div className="flex items-center justify-between text-sm">
        <div>
          <span className="text-muted-foreground">Used: </span>
          <span className="font-medium">{formatValue(used)}</span>
          <span className="text-muted-foreground"> {unit}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Cap: </span>
          <span className="font-medium">{formatValue(cap)}</span>
          <span className="text-muted-foreground"> {unit}</span>
        </div>
      </div>

      {/* Trend indicator */}
      <div className="mt-3 flex items-center gap-2 text-xs">
        <Zap className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Trend:</span>
        <span
          className={`font-medium ${
            trend === "up" ? "text-red-600" : trend === "down" ? "text-green-600" : "text-gray-600"
          }`}
        >
          {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {Math.abs(trendPercentage).toFixed(1)}%
        </span>
        <span className="text-muted-foreground">vs last period</span>
      </div>

      {/* Warning at 80%+ */}
      {percentage >= 80 && percentage < 100 && (
        <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          Approaching usage limit. Consider upgrading your plan.
        </div>
      )}

      {/* Error at 100%+ */}
      {percentage >= 100 && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          Usage limit exceeded. Additional charges may apply.
        </div>
      )}
    </div>
  );
}

export default UsageMeter;
