/**
 * Canvas Widget: ValueSummaryCard
 * Displays ROI metrics in a summary card format
 */

import React from "react";
import { BarChart3, TrendingUp, Users } from "lucide-react";
import type { WidgetProps } from "../CanvasHost";

interface ValueSummaryData {
  title?: string;
  status?: string;
  roi?: number;
  annualValue?: number;
  stakeholders?: number;
}

export function ValueSummaryCard({ data, _onAction }: WidgetProps) {
  const {
    title = "Value Summary",
    status = "In Progress",
    roi = 324,
    annualValue = 2400000,
    stakeholders = 12,
  } = (data as ValueSummaryData) ?? {};

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value}`;
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          {status}
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Projected ROI"
          value={`${roi}%`}
          highlight
        />
        <MetricCard
          icon={<BarChart3 className="h-4 w-4" />}
          label="Annual Value"
          value={formatCurrency(annualValue)}
        />
        <MetricCard
          icon={<Users className="h-4 w-4" />}
          label="Stakeholders"
          value={String(stakeholders)}
        />
      </div>
    </div>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}

function MetricCard({ icon, label, value, highlight }: MetricCardProps) {
  return (
    <div className="rounded-lg bg-vc-surface-2 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className={`mt-2 text-2xl font-bold ${highlight ? "text-primary" : ""}`}>
        {value}
      </div>
    </div>
  );
}

export default ValueSummaryCard;
