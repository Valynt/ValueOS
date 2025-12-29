/**
 * Virtualized List Component
 * Performance-optimized list using @tanstack/react-virtual
 * Handles 10,000+ items efficiently
 */

import React, { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

interface VirtualizedListProps<T> {
  items: T[];
  estimateSize?: number;
  overscan?: number;
  renderItem: (item: T, index: number, virtualItem: any) => React.ReactNode;
  className?: string;
  itemClassName?: string;
  emptyMessage?: string;
}

export function VirtualizedList<T>({
  items,
  estimateSize = 100,
  overscan = 5,
  renderItem,
  className = "",
  itemClassName = "",
  emptyMessage = "No items to display",
}: VirtualizedListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  if (items.length === 0) {
    return (
      <div
        className={`flex items-center justify-center h-64 text-muted-foreground ${className}`}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={`overflow-auto ${className}`}
      style={{ height: "100%" }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            className={itemClassName}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(items[virtualItem.index], virtual.index, virtualItem)}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Virtualized Activity List
 * Optimized for Agent Activity Monitor
 */
import { AgentActivity } from "../views/AgentActivityMonitor";

interface VirtualizedActivityListProps {
  activities: AgentActivity[];
  onActivityClick?: (activity: AgentActivity) => void;
  className?: string;
}

export function VirtualizedActivityList({
  activities,
  onActivityClick,
  className = "",
}: VirtualizedActivityListProps) {
  return (
    <VirtualizedList
      items={activities}
      estimateSize={120}
      overscan={10}
      className={className}
      renderItem={(activity, index) => (
        <div
          onClick={() => onActivityClick?.(activity)}
          className={`
            p-4 border-b border-border hover:bg-secondary/30 cursor-pointer transition-colors
            ${activity.status === "failed" ? "bg-red-50" : ""}
            ${activity.status === "running" ? "bg-blue-50" : ""}
          `}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">
                {activity.agentName}
              </span>
              <span className="text-xs px-2 py-0.5 bg-white/50 rounded">
                {activity.agentRole}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-medium uppercase ${
                  activity.status === "completed"
                    ? "text-green-600"
                    : activity.status === "failed"
                      ? "text-red-600"
                      : activity.status === "running"
                        ? "text-blue-600"
                        : "text-amber-600"
                }`}
              >
                {activity.status}
              </span>
            </div>
          </div>

          <div className="text-sm mb-2">{activity.action}</div>

          <div className="flex items-center gap-3 text-xs text-gray-600">
            <span>{new Date(activity.timestamp).toLocaleTimeString()}</span>
            {activity.duration && <span>{activity.duration}ms</span>}
            {activity.cost !== undefined && (
              <span>${activity.cost.toFixed(2)}</span>
            )}
            {activity.confidence !== undefined && (
              <span>{Math.round(activity.confidence)}%</span>
            )}
          </div>
        </div>
      )}
      emptyMessage="No activities found. Adjust filters or wait for real-time updates."
    />
  );
}

export default VirtualizedList;
