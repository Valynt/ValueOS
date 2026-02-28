import { AlertCircle, CheckCircle, Clock, Loader2, Zap } from "lucide-react";

import type { AgentStatus } from "../types";

import { cn } from "@/lib/utils";

interface AgentStatusBadgeProps {
  status: AgentStatus;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const statusConfig: Record<AgentStatus, { icon: typeof Loader2; label: string; className: string }> = {
  idle: { icon: Clock, label: "Idle", className: "bg-gray-100 text-gray-600" },
  thinking: { icon: Loader2, label: "Thinking", className: "bg-blue-100 text-blue-600" },
  executing: { icon: Zap, label: "Executing", className: "bg-yellow-100 text-yellow-600" },
  completed: { icon: CheckCircle, label: "Completed", className: "bg-green-100 text-green-600" },
  error: { icon: AlertCircle, label: "Error", className: "bg-red-100 text-red-600" },
};

const sizeClasses = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-2.5 py-1",
  lg: "text-base px-3 py-1.5",
};

const iconSizes = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

export function AgentStatusBadge({ status, size = "md", showLabel = true }: AgentStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        config.className,
        sizeClasses[size]
      )}
    >
      <Icon className={cn(iconSizes[size], status === "thinking" && "animate-spin")} />
      {showLabel && config.label}
    </span>
  );
}

export default AgentStatusBadge;
