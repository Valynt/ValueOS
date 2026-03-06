/*
 * StatCard — Reusable metric card with icon, label, value, and optional trend/badge.
 * Follows the reference design: icon-left layout with compact spacing.
 *
 * Usage:
 *   <StatCard icon={DollarSign} label="Value Pipeline" value="$4.2M" trend="+12%" />
 *   <StatCard icon={Activity} label="Active Cases" value={5} badge="1 Flagged" badgeVariant="warning" />
 */
import { type LucideIcon } from "lucide-react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type TrendDirection = "up" | "down" | "neutral";
export type BadgeVariant = "default" | "success" | "warning" | "destructive" | "info";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  /** e.g. "+12%" or "-3%" */
  trend?: string;
  trendDirection?: TrendDirection;
  /** Small badge next to value */
  badge?: string;
  badgeVariant?: BadgeVariant;
  /** Optional progress bar (0-100) */
  progress?: number;
  /** Icon background color class */
  iconBg?: string;
  /** Icon color class */
  iconColor?: string;
  /** Click handler — makes the card interactive */
  onClick?: () => void;
  className?: string;
}

const badgeColors: Record<BadgeVariant, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  destructive: "bg-red-50 text-red-700 border-red-200",
  info: "bg-blue-50 text-blue-700 border-blue-200",
};

const trendColors: Record<TrendDirection, string> = {
  up: "text-emerald-600",
  down: "text-red-500",
  neutral: "text-muted-foreground",
};

export function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  trendDirection = "up",
  badge,
  badgeVariant = "default",
  progress,
  iconBg = "bg-muted",
  iconColor = "text-foreground",
  onClick,
  className,
}: StatCardProps) {
  const isInteractive = !!onClick;

  return (
    <Card
      className={cn(
        "transition-shadow duration-200",
        isInteractive && "cursor-pointer hover:shadow-md hover:border-foreground/10",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", iconBg)}>
            <Icon className={cn("w-5 h-5", iconColor)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
              {label}
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight">{value}</span>
              {trend && (
                <span className={cn("flex items-center text-xs font-medium", trendColors[trendDirection])}>
                  {trendDirection === "up" ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : trendDirection === "down" ? (
                    <ArrowDownRight className="w-3 h-3" />
                  ) : null}
                  {trend}
                </span>
              )}
              {badge && (
                <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", badgeColors[badgeVariant])}>
                  {badge}
                </span>
              )}
            </div>
          </div>
        </div>
        {progress !== undefined && (
          <div className="mt-3 w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-foreground rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
