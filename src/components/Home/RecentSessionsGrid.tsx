/**
 * RecentSessionsGrid Component
 *
 * Displays recent agent sessions with snapshot previews and actions.
 */

import { useState, useCallback } from "react";
import {
  Clock,
  Play,
  Archive,
  Share2,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Loader2,
  Zap,
} from "lucide-react";
import { cn } from "../../lib/utils";

export interface SessionSnapshot {
  id: string;
  title: string;
  description?: string;
  status: "active" | "completed" | "failed" | "paused";
  agentType: string;
  createdAt: string;
  updatedAt: string;
  progress?: number;
  previewImage?: string;
  metadata?: Record<string, unknown>;
}

interface RecentSessionsGridProps {
  sessions: SessionSnapshot[];
  onResume?: (sessionId: string) => void;
  onArchive?: (sessionId: string) => void;
  onShare?: (sessionId: string) => void;
  isLoading?: boolean;
  maxItems?: number;
  className?: string;
}

const statusConfig = {
  active: {
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
    label: "Active",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
  },
  completed: {
    icon: <CheckCircle className="w-4 h-4" />,
    label: "Completed",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
  },
  failed: {
    icon: <XCircle className="w-4 h-4" />,
    label: "Failed",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
  },
  paused: {
    icon: <Clock className="w-4 h-4" />,
    label: "Paused",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
  },
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function RecentSessionsGrid({
  sessions,
  onResume,
  onArchive,
  onShare,
  isLoading = false,
  maxItems = 6,
  className,
}: RecentSessionsGridProps) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const displayedSessions = sessions.slice(0, maxItems);

  const handleAction = useCallback(
    (action: "resume" | "archive" | "share", sessionId: string) => {
      setActiveMenu(null);
      switch (action) {
        case "resume":
          onResume?.(sessionId);
          break;
        case "archive":
          onArchive?.(sessionId);
          break;
        case "share":
          onShare?.(sessionId);
          break;
      }
    },
    [onResume, onArchive, onShare]
  );

  if (isLoading) {
    return (
      <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", className)}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-48 rounded-xl bg-gray-800/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
        <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
          <Zap className="w-8 h-8 text-gray-600" />
        </div>
        <h3 className="text-lg font-medium text-white mb-2">No recent sessions</h3>
        <p className="text-sm text-gray-500 max-w-sm">
          Start a new agent session to see it here. Your recent work will be saved automatically.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", className)}>
      {displayedSessions.map((session) => {
        const config = statusConfig[session.status];

        return (
          <div
            key={session.id}
            className={cn(
              "relative group rounded-xl border bg-gray-900/50",
              "hover:bg-gray-800/50 transition-all duration-200",
              config.borderColor
            )}
          >
            {/* Preview area */}
            <div className="relative h-24 rounded-t-xl overflow-hidden bg-gray-800/50">
              {session.previewImage ? (
                <img
                  src={session.previewImage}
                  alt={session.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Zap className="w-8 h-8 text-gray-700" />
                </div>
              )}

              {/* Status badge */}
              <div
                className={cn(
                  "absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
                  config.bgColor,
                  config.color
                )}
              >
                {config.icon}
                {config.label}
              </div>

              {/* Progress bar for active sessions */}
              {session.status === "active" && session.progress !== undefined && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${session.progress}%` }}
                  />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white truncate">{session.title}</h3>
                  {session.description && (
                    <p className="text-sm text-gray-500 truncate">{session.description}</p>
                  )}
                </div>

                {/* Actions menu */}
                <div className="relative">
                  <button
                    onClick={() => setActiveMenu(activeMenu === session.id ? null : session.id)}
                    className={cn(
                      "p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-700",
                      "opacity-0 group-hover:opacity-100 transition-opacity"
                    )}
                    aria-label="Session actions"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>

                  {activeMenu === session.id && (
                    <div
                      className={cn(
                        "absolute right-0 top-full mt-1 z-10",
                        "bg-gray-800 border border-gray-700 rounded-lg shadow-xl",
                        "py-1 min-w-[120px]"
                      )}
                    >
                      {session.status !== "active" && onResume && (
                        <button
                          onClick={() => handleAction("resume", session.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700"
                        >
                          <Play className="w-4 h-4" />
                          Resume
                        </button>
                      )}
                      {onShare && (
                        <button
                          onClick={() => handleAction("share", session.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700"
                        >
                          <Share2 className="w-4 h-4" />
                          Share
                        </button>
                      )}
                      {onArchive && (
                        <button
                          onClick={() => handleAction("archive", session.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700"
                        >
                          <Archive className="w-4 h-4" />
                          Archive
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Metadata */}
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  {session.agentType}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatRelativeTime(session.updatedAt)}
                </span>
              </div>
            </div>

            {/* Click overlay for resume */}
            {session.status !== "active" && onResume && (
              <button
                onClick={() => onResume(session.id)}
                className={cn(
                  "absolute inset-0 rounded-xl",
                  "opacity-0 group-hover:opacity-100 transition-opacity",
                  "flex items-center justify-center",
                  "bg-black/50"
                )}
                aria-label={`Resume ${session.title}`}
              >
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white font-medium">
                  <Play className="w-4 h-4" />
                  Resume
                </div>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default RecentSessionsGrid;
