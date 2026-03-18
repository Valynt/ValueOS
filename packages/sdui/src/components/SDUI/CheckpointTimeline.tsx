import React from "react";

export type CheckpointStatus = "pending" | "measured" | "missed" | "exceeded";

export interface Checkpoint {
  id: string;
  date: string;
  expectedRange: {
    min: number;
    max: number;
  };
  actualValue?: number;
  status: CheckpointStatus;
  notes?: string;
}

export interface CheckpointTimelineProps {
  checkpoints: Checkpoint[];
  unit: string;
  onCheckpointClick?: (id: string) => void;
  className?: string;
}

/**
 * CheckpointTimeline - Horizontal timeline with measurement dates and status.
 * 
 * Shows: measurement dates, expected ranges, status indicators (pending/measured/missed/exceeded).
 * 
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §3.5.2
 */
export function CheckpointTimeline({
  checkpoints,
  unit,
  onCheckpointClick,
  className = "",
}: CheckpointTimelineProps) {
  const sortedCheckpoints = [...checkpoints].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const statusConfig = {
    pending: { color: "bg-gray-300", icon: "○", label: "Pending" },
    measured: { color: "bg-blue-500", icon: "✓", label: "Measured" },
    missed: { color: "bg-red-500", icon: "✗", label: "Missed" },
    exceeded: { color: "bg-green-500", icon: "★", label: "Exceeded" },
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const formatValue = (value: number) => {
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
    return value.toFixed(0);
  };

  return (
    <div className={`bg-card border border-border rounded-lg p-4 ${className}`}>
      <h3 className="font-semibold text-sm mb-4">Checkpoint Timeline</h3>

      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute top-6 left-0 right-0 h-0.5 bg-gray-200" />

        {/* Checkpoints */}
        <div className="relative flex justify-between">
          {sortedCheckpoints.map((checkpoint, index) => {
            const status = statusConfig[checkpoint.status];
            const isPast = new Date(checkpoint.date) < new Date();

            return (
              <button
                key={checkpoint.id}
                onClick={() => onCheckpointClick?.(checkpoint.id)}
                className="relative flex flex-col items-center group"
                style={{ width: `${100 / sortedCheckpoints.length}%` }}
              >
                {/* Status Dot */}
                <div
                  className={`w-4 h-4 rounded-full ${status.color} flex items-center justify-center text-white text-xs z-10 transition-transform group-hover:scale-110`}
                >
                  {status.icon}
                </div>

                {/* Date */}
                <span className="mt-2 text-xs text-muted-foreground">{formatDate(checkpoint.date)}</span>

                {/* Expected Range */}
                <div className="mt-1 text-xs text-center">
                  <span className="text-muted-foreground">
                    {formatValue(checkpoint.expectedRange.min)}-{formatValue(checkpoint.expectedRange.max)} {unit}
                  </span>
                </div>

                {/* Actual Value (if measured) */}
                {checkpoint.actualValue !== undefined && (
                  <div className="mt-1 px-2 py-0.5 bg-accent rounded text-xs font-medium">
                    Actual: {formatValue(checkpoint.actualValue)} {unit}
                  </div>
                )}

                {/* Status Label */}
                <span className={`mt-1 text-xs ${isPast ? "text-muted-foreground" : "text-blue-600"}`}>
                  {status.label}
                </span>

                {/* Tooltip */}
                {checkpoint.notes && (
                  <div className="absolute bottom-full mb-2 hidden group-hover:block w-32 p-2 bg-black text-white text-xs rounded z-20">
                    {checkpoint.notes}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-border flex flex-wrap gap-4 text-xs">
        {Object.entries(statusConfig).map(([key, config]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-full ${config.color}`} />
            <span className="capitalize">{config.label}</span>
          </div>
        ))}
      </div>

      {checkpoints.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No checkpoints defined.</p>
      )}
    </div>
  );
}
