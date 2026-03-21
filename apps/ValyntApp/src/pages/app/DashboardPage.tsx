import { TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { usePortfolioValue, useCasesList } from "@/hooks/useCases";

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
          aria-label={`${trend.percent} ${isUp ? "increase" : "decrease"}`}
        >
          {isUp ? (
            <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />
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

const timeRanges = ["Last 3 months", "Last 30 days", "Last 7 days"] as const;
type TimeRange = (typeof timeRanges)[number];

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export default function DashboardPage() {
  const [activeRange, setActiveRange] = useState<TimeRange>("Last 3 months");
  const { data: portfolio, isLoading: portfolioLoading } = usePortfolioValue();
  const { data: cases = [], isLoading: casesLoading } = useCasesList();

  const isLoading = portfolioLoading || casesLoading;

  const totalValue = portfolio?.totalValue ?? 0;
  const activeCases = cases.filter((c) => c.status !== "published").length;
  const completedCases = cases.filter((c) => c.status === "published").length;
  const avgConfidence = portfolio?.avgConfidence ?? 0;

  const kpiData: KpiCardProps[] = [
    {
      label: "Total Portfolio Value",
      value: isLoading ? "—" : formatCurrency(totalValue),
      trend: {
        direction: "up",
        percent: portfolio?.valueGrowthPercent ? `+${portfolio.valueGrowthPercent.toFixed(1)}%` : "—",
        description: "Across all active value cases",
        detail: "Based on validated assumptions",
      },
    },
    {
      label: "Active Cases",
      value: isLoading ? "—" : String(activeCases),
      trend: {
        direction: "up",
        percent: `${activeCases} open`,
        description: "Cases currently in progress",
        detail: "Across all lifecycle stages",
      },
    },
    {
      label: "Completed Cases",
      value: isLoading ? "—" : String(completedCases),
      trend: {
        direction: "up",
        percent: `${completedCases} published`,
        description: "Cases ready for delivery",
        detail: "Validated and approved",
      },
    },
    {
      label: "Avg. Confidence",
      value: isLoading ? "—" : `${(avgConfidence * 100).toFixed(0)}%`,
      trend: {
        direction: avgConfidence >= 0.7 ? "up" : "down",
        percent: avgConfidence >= 0.7 ? "On target" : "Below target",
        description: "Mean confidence score",
        detail: "Across all active hypotheses",
      },
    },
  ];

  return (
    <div className="p-6 space-y-6 min-h-full bg-background">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Your workspace overview</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4" role="list" aria-label="Key performance indicators">
        {kpiData.map((kpi) => (
          <div key={kpi.label} role="listitem">
            <KpiCard {...kpi} />
          </div>
        ))}
      </div>

      {/* Portfolio activity chart section */}
      <div className="bg-card border border-border rounded-lg">
        <div className="flex items-start justify-between gap-4 p-6 pb-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Portfolio Activity</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Value case activity over time</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0" role="group" aria-label="Time range selector">
            {timeRanges.map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setActiveRange(range)}
                aria-pressed={range === activeRange}
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
        {/* Chart placeholder — replace with Recharts/Chart.js when telemetry data is available */}
        <div className="px-6 pb-6">
          <div
            className="h-48 rounded-md bg-surface border border-border flex items-end justify-around px-4 pb-4 gap-1"
            role="img"
            aria-label="Portfolio activity chart — live data coming soon"
          >
            {[20, 35, 28, 55, 42, 38, 65, 48, 72, 58, 80, 62, 90, 70, 85, 95, 75, 88].map(
              (height, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-primary/30 hover:bg-primary/50 transition-colors"
                  style={{ height: `${height}%` }}
                  aria-hidden="true"
                />
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
