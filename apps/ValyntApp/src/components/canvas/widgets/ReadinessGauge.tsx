/**
 * ReadinessGauge Widget
 *
 * Circular gauge for composite score + four component bars (validation rate, grounding, benchmark coverage, unsupported count).
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §3.3
 */

import React from "react";
import { Gauge, CheckCircle2, Anchor, BarChart3, AlertTriangle } from "lucide-react";
import { WidgetProps } from "../CanvasHost";

export interface ReadinessComponent {
  name: string;
  score: number;
  weight: number;
}

export interface ReadinessGaugeData {
  compositeScore: number;
  status: "presentation-ready" | "draft" | "blocked";
  components: {
    validationRate: ReadinessComponent;
    grounding: ReadinessComponent;
    benchmarkCoverage: ReadinessComponent;
    unsupportedCount: ReadinessComponent;
  };
  blockers: string[];
}

export function ReadinessGauge({ data }: WidgetProps) {
  const widgetData = data as unknown as ReadinessGaugeData;
  const compositeScore = widgetData.compositeScore ?? 0;
  const status = widgetData.status ?? "draft";
  const components = widgetData.components;
  const blockers = widgetData.blockers ?? [];

  // Calculate circle properties
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (compositeScore / 100) * circumference;

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return "text-green-600";
    if (score >= 0.5) return "text-amber-600";
    return "text-red-600";
  };

  const getScoreBg = (score: number) => {
    if (score >= 0.8) return "bg-green-500";
    if (score >= 0.5) return "bg-amber-500";
    return "bg-red-500";
  };

  const statusBadgeClass =
    status === "presentation-ready"
      ? "bg-green-100 text-green-800 border-green-200"
      : status === "blocked"
        ? "bg-red-100 text-red-800 border-red-200"
        : "bg-amber-100 text-amber-800 border-amber-200";

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Gauge className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Defense Readiness</h3>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadgeClass}`}>
            {status.replace("-", " ").toUpperCase()}
          </span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Circular gauge */}
        <div className="flex flex-col items-center">
          <div className="relative w-32 h-32">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-muted"
                opacity="0.2"
              />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeLinecap="round"
                className={getScoreColor(compositeScore)}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                style={{ transition: "stroke-dashoffset 0.5s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold">{Math.round(compositeScore * 100)}%</span>
              <span className="text-xs text-muted-foreground">Composite</span>
            </div>
          </div>
        </div>

        {/* Component bars */}
        <div className="flex-1 space-y-4">
          {components && (
            <>
              <ComponentBar
                icon={<CheckCircle2 className="w-4 h-4" />}
                label="Validation Rate"
                score={components.validationRate.score}
                colorClass={getScoreBg(components.validationRate.score)}
              />
              <ComponentBar
                icon={<Anchor className="w-4 h-4" />}
                label="Grounding"
                score={components.grounding.score}
                colorClass={getScoreBg(components.grounding.score)}
              />
              <ComponentBar
                icon={<BarChart3 className="w-4 h-4" />}
                label="Benchmark Coverage"
                score={components.benchmarkCoverage.score}
                colorClass={getScoreBg(components.benchmarkCoverage.score)}
              />
              <ComponentBar
                icon={<AlertTriangle className="w-4 h-4" />}
                label="Unsupported Count"
                score={components.unsupportedCount.score}
                colorClass={getScoreBg(components.unsupportedCount.score)}
                inverted
              />
            </>
          )}
        </div>
      </div>

      {blockers.length > 0 && (
        <div className="mt-6 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-medium text-red-800 mb-1">
            Blockers ({blockers.length})
          </p>
          <ul className="text-sm text-red-700 space-y-0.5">
            {blockers.map((blocker, index) => (
              <li key={index}>• {blocker}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ComponentBar({
  icon,
  label,
  score,
  colorClass,
  inverted = false,
}: {
  icon: React.ReactNode;
  label: string;
  score: number;
  colorClass: string;
  inverted?: boolean;
}) {
  const displayScore = inverted ? 1 - score : score;
  const percentage = Math.round(displayScore * 100);

  return (
    <div className="flex items-center gap-3">
      <div className="text-muted-foreground w-5">{icon}</div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-sm text-muted-foreground">{percentage}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default ReadinessGauge;
