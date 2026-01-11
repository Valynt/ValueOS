/**
 * EngineRoom Component
 *
 * Slide-out panel showing agent execution logs.
 * Accessible via Cmd+J keyboard shortcut.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  X,
  Download,
  Filter,
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  Search,
  RefreshCw,
} from "lucide-react";
import { cn } from "../../lib/utils";

export interface AgentLogEntry {
  id: string;
  timestamp: string;
  sessionId: string;
  agentType: string;
  action: string;
  status: "success" | "error" | "warning" | "info";
  duration?: number;
  message: string;
  details?: Record<string, unknown>;
}

interface EngineRoomProps {
  isOpen: boolean;
  onClose: () => void;
  logs?: AgentLogEntry[];
  onRefresh?: () => void;
  isLoading?: boolean;
}

const statusConfig = {
  success: {
    icon: <CheckCircle className="w-4 h-4" />,
    color: "text-green-400",
    bgColor: "bg-green-500/10",
  },
  error: {
    icon: <XCircle className="w-4 h-4" />,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
  },
  warning: {
    icon: <AlertTriangle className="w-4 h-4" />,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
  },
  info: {
    icon: <Zap className="w-4 h-4" />,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
  },
};

export function EngineRoom({
  isOpen,
  onClose,
  logs = [],
  onRefresh,
  isLoading = false,
}: EngineRoomProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  // Get unique agent types for filter
  const agentTypes = useMemo(() => {
    const types = new Set(logs.map((log) => log.agentType));
    return Array.from(types);
  }, [logs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !log.message.toLowerCase().includes(query) &&
          !log.action.toLowerCase().includes(query) &&
          !log.agentType.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== "all" && log.status !== statusFilter) {
        return false;
      }

      // Agent filter
      if (agentFilter !== "all" && log.agentType !== agentFilter) {
        return false;
      }

      return true;
    });
  }, [logs, searchQuery, statusFilter, agentFilter]);

  // Toggle log expansion
  const toggleExpand = useCallback((id: string) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Export logs as JSON
  const exportJSON = useCallback(() => {
    const data = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agent-logs-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredLogs]);

  // Export logs as CSV
  const exportCSV = useCallback(() => {
    const headers = [
      "timestamp",
      "sessionId",
      "agentType",
      "action",
      "status",
      "duration",
      "message",
    ];
    const rows = filteredLogs.map((log) => [
      log.timestamp,
      log.sessionId,
      log.agentType,
      log.action,
      log.status,
      log.duration?.toString() || "",
      `"${log.message.replace(/"/g, '""')}"`,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agent-logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredLogs]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 bottom-0 z-50 w-full max-w-2xl",
          "bg-gray-900 border-l border-gray-700 shadow-2xl",
          "flex flex-col",
          "animate-slide-in-right"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Engine Room - Agent Logs"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Engine Room</h2>
              <p className="text-sm text-gray-500">
                {filteredLogs.length} of {logs.length} logs
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isLoading}
                className={cn(
                  "p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800",
                  "transition-colors",
                  isLoading && "animate-spin"
                )}
                aria-label="Refresh logs"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-gray-800 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs..."
              className={cn(
                "w-full pl-10 pr-4 py-2 rounded-lg",
                "bg-gray-800 border border-gray-700 text-white placeholder-gray-500",
                "focus:border-primary focus:ring-1 focus:ring-primary/50 outline-none"
              )}
            />
          </div>

          {/* Filter dropdowns */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm",
                  "bg-gray-800 border border-gray-700 text-white",
                  "focus:border-primary outline-none"
                )}
              >
                <option value="all">All Status</option>
                <option value="success">Success</option>
                <option value="error">Error</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </div>

            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm",
                "bg-gray-800 border border-gray-700 text-white",
                "focus:border-primary outline-none"
              )}
            >
              <option value="all">All Agents</option>
              {agentTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            {/* Export buttons */}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={exportJSON}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm",
                  "bg-gray-800 hover:bg-gray-700 text-gray-300",
                  "transition-colors"
                )}
              >
                <Download className="w-4 h-4" />
                JSON
              </button>
              <button
                onClick={exportCSV}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm",
                  "bg-gray-800 hover:bg-gray-700 text-gray-300",
                  "transition-colors"
                )}
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
            </div>
          </div>
        </div>

        {/* Logs list */}
        <div className="flex-1 overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Zap className="w-12 h-12 mb-4 opacity-50" />
              <p>No logs found</p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="mt-2 text-sm text-primary hover:underline"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {filteredLogs.map((log) => {
                const config = statusConfig[log.status];
                const isExpanded = expandedLogs.has(log.id);

                return (
                  <div key={log.id} className="p-4 hover:bg-gray-800/50">
                    {/* Log header */}
                    <button onClick={() => toggleExpand(log.id)} className="w-full text-left">
                      <div className="flex items-start gap-3">
                        {/* Status icon */}
                        <div
                          className={cn(
                            "flex-shrink-0 p-1.5 rounded",
                            config.bgColor,
                            config.color
                          )}
                        >
                          {config.icon}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-white">{log.action}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
                              {log.agentType}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400 truncate">{log.message}</p>
                        </div>

                        {/* Metadata */}
                        <div className="flex-shrink-0 text-right">
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </div>
                          {log.duration && (
                            <div className="text-xs text-gray-500 mt-1">{log.duration}ms</div>
                          )}
                        </div>

                        {/* Expand indicator */}
                        {log.details && (
                          <ChevronDown
                            className={cn(
                              "w-4 h-4 text-gray-500 transition-transform",
                              isExpanded && "rotate-180"
                            )}
                          />
                        )}
                      </div>
                    </button>

                    {/* Expanded details */}
                    {isExpanded && log.details && (
                      <div className="mt-3 ml-10 p-3 rounded-lg bg-gray-800/50">
                        <pre className="text-xs text-gray-400 overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-800 text-xs text-gray-500 flex items-center justify-between">
          <span>Press Esc to close</span>
          <span>Cmd+J to toggle</span>
        </div>
      </div>
    </>
  );
}

export default EngineRoom;
