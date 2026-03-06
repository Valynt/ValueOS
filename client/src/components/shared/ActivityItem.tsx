/*
 * ActivityItem — Reusable activity feed item with status icon, title, subtitle, and timestamp.
 * Used in Dashboard agent activity, case history, and audit logs.
 *
 * Usage:
 *   <ActivityItem
 *     status="success"
 *     title="Opportunity Agent"
 *     subtitle="Completed · 2.1s"
 *     timestamp="2m ago"
 *   />
 */
import { CheckCircle2, XCircle, Loader2, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type ActivityStatus = "success" | "failed" | "running" | "cancelled" | "warning" | "info";

interface ActivityItemProps {
  status: ActivityStatus;
  title: string;
  subtitle?: string;
  timestamp?: string;
  onClick?: () => void;
  className?: string;
}

const statusConfig: Record<ActivityStatus, { bg: string; color: string; icon: React.ReactNode }> = {
  success: {
    bg: "bg-emerald-50",
    color: "text-emerald-600",
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  failed: {
    bg: "bg-red-50",
    color: "text-red-600",
    icon: <XCircle className="w-4 h-4" />,
  },
  running: {
    bg: "bg-blue-50",
    color: "text-blue-600",
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
  },
  cancelled: {
    bg: "bg-muted",
    color: "text-muted-foreground",
    icon: <Clock className="w-4 h-4" />,
  },
  warning: {
    bg: "bg-amber-50",
    color: "text-amber-600",
    icon: <AlertTriangle className="w-4 h-4" />,
  },
  info: {
    bg: "bg-blue-50",
    color: "text-blue-600",
    icon: <Clock className="w-4 h-4" />,
  },
};

export function ActivityItem({
  status,
  title,
  subtitle,
  timestamp,
  onClick,
  className,
}: ActivityItemProps) {
  const config = statusConfig[status] || statusConfig.info;

  return (
    <div
      className={cn(
        "flex items-start gap-3 py-2",
        onClick && "cursor-pointer hover:bg-accent/30 rounded-lg px-2 -mx-2 transition-colors",
        className
      )}
      onClick={onClick}
    >
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", config.bg, config.color)}>
        {config.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {timestamp && (
        <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
          {timestamp}
        </span>
      )}
    </div>
  );
}
