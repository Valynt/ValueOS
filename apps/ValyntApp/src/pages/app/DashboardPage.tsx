import { TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  trend: {
    direction: "up" | "down";
    percent: string;
    description: string;
    detail: string;
  };
}

function KpiCard({ label, value, trend }: KpiCardProps) {
  const isUp = trend.direction === "up";
  return (
    <div className="bg-card border border-border rounded-lg p-6 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs font-medium",
            isUp ? "text-primary" : "text-destructive"
          )}
        >
          {isUp ? (
            <TrendingUp className="w-3.5 h-3.5" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5" />
          )}
          {trend.percent}
        </span>
      </div>
      <p className="text-3xl font-bold text-foreground tracking-tight">{value}</p>
      <div>
        <p className="text-xs font-medium text-muted-foreground">{trend.description}</p>
        <p className="text-xs text-muted-foreground/70 mt-0.5">{trend.detail}</p>
      </div>
    </div>
  );
}

const kpiData: KpiCardProps[] = [
  {
    label: "Total revenue",
    value: "$1,250.00",
    trend: {
      direction: "up",
      percent: "+12.5%",
      description: "Trending up this month",
      detail: "Visitors for the last 6 months",
    },
  },
  {
    label: "New Customers",
    value: "1,234",
    trend: {
      direction: "down",
      percent: "-20%",
      description: "Down 20% this period",
      detail: "Acquisition needs attention",
    },
  },
  {
    label: "Active Accounts",
    value: "45,678",
    trend: {
      direction: "up",
      percent: "+12.5%",
      description: "Strong user retention",
      detail: "Engagement exceed targets",
    },
  },
  {
    label: "Growth Rate",
    value: "4.5%",
    trend: {
      direction: "up",
      percent: "+4.5%",
      description: "Steady performance increase",
      detail: "Meets growth projections",
    },
  },
];

const timeRanges = ["Last 3 months", "Last 30 days", "Last 7 days"] as const;
type TimeRange = (typeof timeRanges)[number];

export default function DashboardPage() {
  const [activeRange, setActiveRange] = useState<TimeRange>("Last 3 months");

  return (
    <div className="p-6 space-y-6 min-h-full bg-background">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Your workspace overview</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiData.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Total visitors chart section */}
      <div className="bg-card border border-border rounded-lg">
        <div className="flex items-start justify-between gap-4 p-6 pb-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Total visitors</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Total for the last 3 months</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {timeRanges.map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setActiveRange(range)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  range === activeRange
                    ? "bg-white/8 text-foreground border border-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
        {/* Chart placeholder */}
        <div className="px-6 pb-6">
          <div className="h-48 rounded-md bg-surface border border-border flex items-end justify-around px-4 pb-4 gap-1">
            {[20, 35, 28, 55, 42, 38, 65, 48, 72, 58, 80, 62, 90, 70, 85, 95, 75, 88].map(
              (height, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-primary/30 hover:bg-primary/50 transition-colors"
                  style={{ height: `${height}%` }}
                />
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
