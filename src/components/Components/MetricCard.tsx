import React from "react";
import { MetricCardProps } from "../../types";
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react";

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  trend,
  change,
  tooltipId,
}) => {
  const getTrendIcon = () => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-success" />;
      case "down":
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case "up":
        return "text-success bg-success/10 border-success";
      case "down":
        return "text-destructive bg-destructive/10 border-destructive";
      default:
        return "text-muted-foreground bg-muted border-border";
    }
  };

  return (
    <div className="bg-card text-card-foreground rounded-lg p-vc-3 border border-border transition-all duration-200 h-full">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <h3 className="text-sm font-medium text-muted-foreground">
              {title}
            </h3>
            {tooltipId && <Info className="h-4 w-4 text-muted-foreground" />}
          </div>
          <p className="text-3xl font-bold text-foreground">{value}</p>
        </div>
        <div className={`p-2 rounded-lg border ${getTrendColor()}`}>
          {getTrendIcon()}
        </div>
      </div>

      {change && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{change}</span>
          <div className="w-vc-8 h-vc-1 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                trend === "up"
                  ? "bg-success"
                  : trend === "down"
                    ? "bg-destructive"
                    : "bg-muted-foreground"
              }`}
              className="w-3/4"
            />
          </div>
        </div>
      )}
    </div>
  );
};
