/**
 * AgentTicker Component
 *
 * Real-time ticker showing agent operation status updates.
 * Subscribes to WebSocket for live updates.
 */

import { useState, useEffect, useCallback } from "react";
import { Zap, CheckCircle, XCircle, Loader2, AlertTriangle, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

export interface TickerEvent {
  id: string;
  agentType: string;
  action: string;
  status: "running" | "success" | "error" | "warning";
  timestamp: string;
  message?: string;
}

interface AgentTickerProps {
  events?: TickerEvent[];
  onEventClick?: (event: TickerEvent) => void;
  maxVisible?: number;
  autoScroll?: boolean;
  className?: string;
}

const statusConfig = {
  running: {
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
  },
  success: {
    icon: <CheckCircle className="w-3 h-3" />,
    color: "text-green-400",
    bgColor: "bg-green-500/10",
  },
  error: {
    icon: <XCircle className="w-3 h-3" />,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
  },
  warning: {
    icon: <AlertTriangle className="w-3 h-3" />,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
  },
};

export function AgentTicker({
  events = [],
  onEventClick,
  maxVisible = 1,
  autoScroll = true,
  className,
}: AgentTickerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-scroll through events
  useEffect(() => {
    if (!autoScroll || isHovered || events.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % events.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [autoScroll, isHovered, events.length]);

  // Reset index when events change
  useEffect(() => {
    if (events.length > 0 && currentIndex >= events.length) {
      setCurrentIndex(0);
    }
  }, [events.length, currentIndex]);

  const handleClick = useCallback(
    (event: TickerEvent) => {
      onEventClick?.(event);
    },
    [onEventClick]
  );

  if (events.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg",
          "bg-gray-800/50 text-gray-500 text-sm",
          className
        )}
      >
        <Zap className="w-3 h-3" />
        <span>No active agents</span>
      </div>
    );
  }

  const visibleEvents = events.slice(currentIndex, currentIndex + maxVisible);
  const currentEvent = visibleEvents[0];
  const config = statusConfig[currentEvent.status];

  return (
    <div
      className={cn("relative", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        onClick={() => handleClick(currentEvent)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg",
          "bg-gray-800/50 hover:bg-gray-800 transition-colors",
          "text-sm group"
        )}
      >
        {/* Status indicator */}
        <span className={cn("flex-shrink-0", config.color)}>{config.icon}</span>

        {/* Content */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-gray-400 font-medium truncate">{currentEvent.agentType}</span>
          <span className="text-gray-600">·</span>
          <span className="text-gray-300 truncate">
            {currentEvent.message || currentEvent.action}
          </span>
        </div>

        {/* Arrow */}
        <ChevronRight
          className={cn(
            "w-4 h-4 text-gray-600 flex-shrink-0",
            "opacity-0 group-hover:opacity-100 transition-opacity"
          )}
        />

        {/* Event count badge */}
        {events.length > 1 && (
          <span
            className={cn(
              "flex-shrink-0 px-1.5 py-0.5 rounded text-xs",
              "bg-gray-700 text-gray-400"
            )}
          >
            {currentIndex + 1}/{events.length}
          </span>
        )}
      </button>

      {/* Progress dots for multiple events */}
      {events.length > 1 && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1">
          {events.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-colors",
                index === currentIndex ? "bg-primary" : "bg-gray-600 hover:bg-gray-500"
              )}
              aria-label={`Go to event ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Compact variant for header use
 */
export function AgentTickerCompact({
  events = [],
  onEventClick,
  className,
}: Omit<AgentTickerProps, "maxVisible" | "autoScroll">) {
  const runningCount = events.filter((e) => e.status === "running").length;
  const latestEvent = events[0];

  if (events.length === 0) {
    return null;
  }

  return (
    <button
      onClick={() => latestEvent && onEventClick?.(latestEvent)}
      className={cn(
        "flex items-center gap-2 px-2 py-1 rounded-md",
        "bg-gray-800/50 hover:bg-gray-800 transition-colors",
        "text-xs",
        className
      )}
    >
      {runningCount > 0 ? (
        <>
          <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
          <span className="text-gray-400">
            {runningCount} agent{runningCount > 1 ? "s" : ""} running
          </span>
        </>
      ) : (
        <>
          <Zap className="w-3 h-3 text-gray-500" />
          <span className="text-gray-500">{events.length} recent</span>
        </>
      )}
    </button>
  );
}

export default AgentTicker;
