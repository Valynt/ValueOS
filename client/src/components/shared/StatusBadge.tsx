/*
 * StatusBadge — Centralized status/stage badge with consistent color mappings.
 * Eliminates duplicated getStageColor/getCaseStatusColor across pages.
 *
 * Usage:
 *   <StatusBadge type="stage" value="hypothesis" />
 *   <StatusBadge type="status" value="running" />
 *   <StatusBadge type="run" value="success" />
 */
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, Loader2, Clock, Pause } from "lucide-react";

type BadgeType = "stage" | "status" | "run" | "tier" | "custom";

interface StatusBadgeProps {
  type: BadgeType;
  value: string;
  /** Override the display label (defaults to capitalized value) */
  label?: string;
  /** Show a dot indicator instead of full badge */
  dot?: boolean;
  /** Show icon for run status */
  showIcon?: boolean;
  className?: string;
}

/* ── Color Maps ── */

const stageColors: Record<string, string> = {
  hypothesis: "bg-blue-50 text-blue-700 border-blue-200",
  modeling: "bg-purple-50 text-purple-700 border-purple-200",
  integrity: "bg-amber-50 text-amber-700 border-amber-200",
  narrative: "bg-pink-50 text-pink-700 border-pink-200",
  realization: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const statusColors: Record<string, string> = {
  running: "bg-emerald-100 text-emerald-700",
  committed: "bg-blue-100 text-blue-700",
  completed: "bg-purple-100 text-purple-700",
  draft: "bg-muted text-muted-foreground",
  paused: "bg-amber-100 text-amber-700",
};

const statusDotColors: Record<string, string> = {
  running: "bg-emerald-500",
  committed: "bg-emerald-500",
  completed: "bg-blue-500",
  draft: "bg-amber-500",
  paused: "bg-zinc-400",
};

const runColors: Record<string, string> = {
  success: "text-emerald-600",
  failed: "text-red-500",
  running: "text-blue-600",
  cancelled: "text-muted-foreground",
  timeout: "text-amber-600",
};

const runIcons: Record<string, React.ReactNode> = {
  success: <CheckCircle2 className="w-3.5 h-3.5" />,
  failed: <XCircle className="w-3.5 h-3.5" />,
  running: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
  cancelled: <Clock className="w-3.5 h-3.5" />,
  timeout: <Pause className="w-3.5 h-3.5" />,
};

const tierColors: Record<string, string> = {
  "1": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "2": "bg-blue-50 text-blue-700 border-blue-200",
  "3": "bg-amber-50 text-amber-700 border-amber-200",
};

function getColorClass(type: BadgeType, value: string): string {
  const key = value.toLowerCase();
  switch (type) {
    case "stage": return stageColors[key] || "bg-muted text-muted-foreground";
    case "status": return statusColors[key] || "bg-muted text-muted-foreground";
    case "run": return runColors[key] || "text-muted-foreground";
    case "tier": return tierColors[key] || "bg-muted text-muted-foreground";
    default: return "bg-muted text-muted-foreground";
  }
}

export function StatusBadge({
  type,
  value,
  label,
  dot = false,
  showIcon = false,
  className,
}: StatusBadgeProps) {
  const displayLabel = label || value.charAt(0).toUpperCase() + value.slice(1);
  const colorClass = getColorClass(type, value);

  // Dot variant — small colored circle + text
  if (dot) {
    const dotColor = type === "status" ? (statusDotColors[value.toLowerCase()] || "bg-zinc-300") : "";
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className={cn("w-2 h-2 rounded-full", dotColor)} />
        <span className="text-sm capitalize">{displayLabel}</span>
      </div>
    );
  }

  // Run status with icon
  if (type === "run" && showIcon) {
    const key = value.toLowerCase();
    return (
      <div className={cn("flex items-center gap-1.5", colorClass, className)}>
        {runIcons[key]}
        <span className="text-xs capitalize font-medium">{displayLabel}</span>
      </div>
    );
  }

  // Standard badge
  return (
    <Badge
      variant="secondary"
      className={cn("text-xs font-semibold uppercase border", colorClass, className)}
    >
      {displayLabel}
    </Badge>
  );
}

/* ── Exported helpers for external use ── */
export { stageColors, statusColors, statusDotColors, runColors, tierColors };
