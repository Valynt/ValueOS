import React from "react";

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
  source: string;
  progress: number; // 0-100
}

export interface KPITargetCardProps {
  target: KPITarget;
  onTrack?: (id: string) => void;
  className?: string;
}

/**
 * KPITargetCard - Metric card showing baseline → target with timeline and progress.
 * 
 * Shows: metric name, baseline → target values, timeline, source badge, progress indicator.
 * 
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §3.5.1
 */
export function KPITargetCard({ target, onTrack, className = "" }: KPITargetCardProps) {
  const formatValue = (value: number) => {
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
    return value.toFixed(0);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  };

  const daysRemaining = Math.ceil(
    (new Date(target.timeline.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const progressColor =
    target.progress >= 80 ? "bg-green-500" : target.progress >= 50 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className={`bg-card border border-border rounded-lg p-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h4 className="font-semibold text-sm">{target.metricName}</h4>
          
          {/* Baseline → Target */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-lg font-bold text-muted-foreground">
              {formatValue(target.baseline)} {target.unit}
            </span>
            <span className="text-muted-foreground">→</span>
            <span className="text-lg font-bold text-primary">
              {formatValue(target.target)} {target.unit}
            </span>
          </div>

          {/* Timeline */}
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <span>📅</span>
            <span>
              {formatDate(target.timeline.startDate)} → {formatDate(target.timeline.targetDate)}
            </span>
            <span className={`${daysRemaining < 30 ? "text-red-500 font-medium" : ""}`}>
              ({daysRemaining} days left)
            </span>
          </div>

          {/* Source */}
          <div className="mt-2 flex items-center gap-1 text-xs">
            <span className="text-muted-foreground">Source:</span>
            <span className="px-1.5 py-0.5 bg-accent rounded">{target.source}</span>
          </div>
        </div>

        {/* Progress Circle */}
        <div className="flex flex-col items-center">
          <div className="relative w-16 h-16">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="3"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray={`${target.progress}, 100`}
                className={progressColor}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold">{target.progress.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Track Button */}
      {onTrack && (
        <button
          onClick={() => onTrack(target.id)}
          className="mt-3 w-full px-3 py-2 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/90"
        >
          Record Measurement
        </button>
      )}
    </div>
  );
}
