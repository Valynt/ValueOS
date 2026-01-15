import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  delta?: {
    value: string | number;
    trend: "up" | "down" | "neutral";
  };
  className?: string;
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  delta,
  className
}: KpiCardProps) {
  const getDeltaColor = (trend: "up" | "down" | "neutral") => {
    switch (trend) {
      case "up":
        return "text-green-600";
      case "down":
        return "text-red-600";
      case "neutral":
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <Card className={cn("bg-card text-card-foreground shadow-beautiful-md rounded-lg", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            {delta && (
              <p className={cn("text-sm", getDeltaColor(delta.trend))}>
                {delta.trend === "up" && "↑"}
                {delta.trend === "down" && "↓"}
                {delta.value}
              </p>
            )}
          </div>
          {Icon && (
            <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
