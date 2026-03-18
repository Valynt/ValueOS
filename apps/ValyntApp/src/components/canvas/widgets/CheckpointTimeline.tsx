/**
 * CheckpointTimeline Widget
 *
 * Horizontal timeline with measurement dates, expected ranges, status indicators (pending/measured/missed/exceeded).
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §3.5
 */

import { AlertCircle, Calendar, CheckCircle2, Clock, XCircle } from "lucide-react";
import React from "react";

import { WidgetProps } from "../CanvasHost";

export type CheckpointStatus = "pending" | "measured" | "missed" | "exceeded";

export interface Checkpoint {
  id: string;
  date: string;
  expectedRange: { min: number; max: number };
  actualValue?: number;
  status: CheckpointStatus;
  notes?: string;
}

export interface CheckpointTimelineData {
  checkpoints: Checkpoint[];
  metricName: string;
  unit: string;
}

export function CheckpointTimeline({ data }: WidgetProps) {
  const widgetData = data as unknown as CheckpointTimelineData;
  const checkpoints = widgetData.checkpoints ?? [];
  const metricName = widgetData.metricName ?? "Metric";
  const unit = widgetData.unit ?? "";

  const getStatusIcon = (status: CheckpointStatus) => {
    switch (status) {
      case "measured":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "missed":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "exceeded":
        return <CheckCircle2 className="w-5 h-5 text-blue-500" />;
      default:
        return <Clock className="w-5 h-5 text-amber-500" />;
    }
  };

  const getStatusColor = (status: CheckpointStatus) => {
    switch (status) {
      case "measured":
        return "bg-green-100 border-green-200 text-green-800";
      case "missed":
        return "bg-red-100 border-red-200 text-red-800";
      case "exceeded":
        return "bg-blue-100 border-blue-200 text-blue-800";
      default:
        return "bg-amber-50 border-amber-200 text-amber-800";
    }
  };

  const formatValue = (value: number) => {
    if (unit === "$" || unit === "USD") {
      if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
      return `$${value.toLocaleString()}`;
    }
    if (unit === "%") return `${value.toFixed(1)}%`;
    return `${value.toLocaleString()} ${unit}`;
  };

  // Sort by date
  const sortedCheckpoints = [...checkpoints].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Calendar className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Checkpoint Timeline</h3>
          <p className="text-sm text-muted-foreground">{metricName} checkpoints</p>
        </div>
      </div>

      {sortedCheckpoints.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No checkpoints defined</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute top-6 left-0 right-0 h-0.5 bg-border" />

          {/* Checkpoints */}
          <div className="flex justify-between">
            {sortedCheckpoints.map((checkpoint, index) => (
              <div key={checkpoint.id} className="relative flex flex-col items-center">
                {/* Status indicator */}
                <div
                  className={`w-12 h-12 rounded-full border-2 flex items-center justify-center z-10 ${getStatusColor(
                    checkpoint.status
                  )}`}
                >
                  {getStatusIcon(checkpoint.status)}
                </div>

                {/* Date */}
                <div className="mt-3 text-center">
                  <p className="text-sm font-medium">
                    {new Date(checkpoint.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(checkpoint.date).getFullYear()}
                  </p>
                </div>

                {/* Expected range */}
                <div className="mt-2 text-center">
                  <p className="text-xs text-muted-foreground">Expected</p>
                  <p className="text-sm font-medium">
                    {formatValue(checkpoint.expectedRange.min)} -{" "}
                    {formatValue(checkpoint.expectedRange.max)}
                  </p>
                </div>

                {/* Actual value if measured */}
                {checkpoint.actualValue !== undefined && (
                  <div className="mt-1 text-center">
                    <p className="text-xs text-muted-foreground">Actual</p>
                    <p
                      className={`text-sm font-bold ${
                        checkpoint.status === "missed"
                          ? "text-red-600"
                          : checkpoint.status === "exceeded"
                            ? "text-blue-600"
                            : "text-green-600"
                      }`}
                    >
                      {formatValue(checkpoint.actualValue)}
                    </p>
                  </div>
                )}

                {/* Notes */}
                {checkpoint.notes && (
                  <p className="mt-1 text-xs text-muted-foreground text-center max-w-[120px]">
                    {checkpoint.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-8 flex flex-wrap gap-4 justify-center text-xs">
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4 text-amber-500" />
          <span>Pending</span>
        </div>
        <div className="flex items-center gap-1">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span>On Target</span>
        </div>
        <div className="flex items-center gap-1">
          <XCircle className="w-4 h-4 text-red-500" />
          <span>Missed</span>
        </div>
        <div className="flex items-center gap-1">
          <CheckCircle2 className="w-4 h-4 text-blue-500" />
          <span>Exceeded</span>
        </div>
      </div>
    </div>
  );
}

export default CheckpointTimeline;
