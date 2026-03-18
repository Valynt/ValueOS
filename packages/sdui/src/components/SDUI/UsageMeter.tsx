import React from "react";

export interface UsageMeterProps {
  meterKey: string;
  meterName: string;
  used: number;
  cap: number;
  unit: string;
  resetDate: string;
  trend?: "up" | "down" | "flat";
  className?: string;
}

/**
 * UsageMeter - Horizontal bar showing used/cap with percentage.
 * 
 * Color shifts at 80% (yellow) and 100% (red).
 * 
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §3.6.1
 */
export function UsageMeter({
  meterKey,
  meterName,
  used,
  cap,
  unit,
  resetDate,
  trend,
  className = "",
}: UsageMeterProps) {
  const percentage = Math.min((used / cap) * 100, 100);
  const remaining = cap - used;

  // Color logic: green < 80%, yellow 80-100%, red > 100%
  const getBarColor = () => {
    if (percentage >= 100) return "bg-red-500";
    if (percentage >= 80) return "bg-yellow-500";
    return "bg-green-500";
  };

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
    return num.toFixed(0);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const trendIcons = {
    up: "↑",
    down: "↓",
    flat: "→",
  };

  return (
    <div className={`bg-card border border-border rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-sm">{meterName}</h4>
          {trend && (
            <span
              className={`text-xs ${
                trend === "up" ? "text-red-500" : trend === "down" ? "text-green-500" : "text-gray-500"
              }`}
            >
              {trendIcons[trend]}
            </span>
          )}
        </div>
        <span
          className={`text-sm font-medium ${
            percentage >= 100 ? "text-red-600" : percentage >= 80 ? "text-yellow-600" : "text-green-600"
          }`}
        >
          {percentage.toFixed(1)}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${getBarColor()} transition-all duration-500`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {/* Details */}
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {formatNumber(used)} / {formatNumber(cap)} {unit}
        </span>
        <span>
          {remaining > 0 ? `${formatNumber(remaining)} remaining` : "Cap reached"} · Resets {formatDate(resetDate)}
        </span>
      </div>

      {/* Warning message */}
      {percentage >= 100 && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          ⚠ Usage cap exceeded. Additional usage may be blocked or incur overage charges.
        </div>
      )}
      {percentage >= 80 && percentage < 100 && (
        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
          ⚠ Approaching usage cap. Consider upgrading your plan.
        </div>
      )}
    </div>
  );
}
