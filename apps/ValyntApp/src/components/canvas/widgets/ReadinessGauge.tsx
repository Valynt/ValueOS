/**
 * ReadinessGauge Widget
 *
 * Circular gauge for composite score + four component bars (validation rate, grounding, benchmark coverage, unsupported count).
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §3.3
 */

import { AlertTriangle, Anchor, BarChart3, CheckCircle2, Gauge, Loader2 } from "lucide-react";
import React, { useMemo } from "react";

import { WidgetProps } from "../CanvasHost";

export interface ReadinessComponent {
  name?: string;
  score: number;
  /** @deprecated Weight is not currently consumed by the UI */
  weight?: number;
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

/** Type guard for ReadinessComponent */
function isReadinessComponent(value: unknown): value is ReadinessComponent {
  return (
    typeof value === "object" &&
    value !== null &&
    "score" in value &&
    typeof (value as ReadinessComponent).score === "number"
  );
}

/** Type guard for ReadinessGaugeData */
function isReadinessGaugeData(value: unknown): value is ReadinessGaugeData {
  if (typeof value !== "object" || value === null) return false;
  const data = value as Record<string, unknown>;

  return (
    "compositeScore" in data &&
    typeof data.compositeScore === "number" &&
    (data.compositeScore as number) >= 0 &&
    (data.compositeScore as number) <= 1 &&
    "status" in data &&
    ["presentation-ready", "draft", "blocked"].includes(data.status as string) &&
    "components" in data &&
    typeof data.components === "object" &&
    data.components !== null
  );
}

/** Loading state component */
function ReadinessGaugeLoading() {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Defense Readiness</h3>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-amber-100 text-amber-800 border-amber-200">
            Loading...
          </span>
        </div>
      </div>
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
      </div>
    </div>
  );
}

export function ReadinessGauge({ data }: WidgetProps) {
  // Validate data structure with type guard
  const gaugeData = data?.readiness;

  if (gaugeData === undefined || gaugeData === null) {
    return <ReadinessGaugeLoading />;
  }

  if (!isReadinessGaugeData(gaugeData)) {
    console.warn("ReadinessGauge: Invalid data structure received", gaugeData);
    return <ReadinessGaugeLoading />;
  }

  const widgetData = gaugeData;
  const compositeScore = widgetData.compositeScore;
  const status = widgetData.status;
  const components = widgetData.components;
  const blockers = widgetData.blockers ?? [];

  // Calculate circle properties
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - compositeScore * circumference;

  const getScoreColor = React.useCallback((score: number) => {
    if (score >= 0.8) return "text-green-600";
    if (score >= 0.5) return "text-amber-600";
    return "text-red-600";
  }, []);

  const getScoreBg = React.useCallback((score: number) => {
    if (score >= 0.8) return "bg-green-500";
    if (score >= 0.5) return "bg-amber-500";
    return "bg-red-500";
  }, []);

  const statusBadgeClass = useMemo(() =>
    status === "presentation-ready"
      ? "bg-green-100 text-green-800 border-green-200"
      : status === "blocked"
        ? "bg-red-100 text-red-800 border-red-200"
        : "bg-amber-100 text-amber-800 border-amber-200",
    [status]
  );

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Gauge className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Defense Readiness</h3>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadgeClass}`}>
            {status === "presentation-ready" ? "Ready" : status.replace("-", " ").toUpperCase()}
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
            <div
              role="meter"
              aria-label="Defense readiness score"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(compositeScore * 100)}
              className={`absolute inset-0 flex flex-col items-center justify-center ${getScoreColor(compositeScore)}`}
            >
              <span className="text-2xl font-bold">{Math.round(compositeScore * 100)}%</span>
              <span className="text-xs text-muted-foreground">Composite</span>
            </div>
          </div>
        </div>

        {/* Component bars */}
        <div className="flex-1 space-y-4">
          {components && isReadinessComponent(components.validationRate) && (
            <>
              <ComponentBar
                icon={<CheckCircle2 className="w-4 h-4" />}
                label="Validation Rate"
                score={components.validationRate.score}
                colorClass={getScoreBg(components.validationRate.score)}
              />
              {isReadinessComponent(components.grounding) && (
                <ComponentBar
                  icon={<Anchor className="w-4 h-4" />}
                  label="Grounding"
                  score={components.grounding.score}
                  colorClass={getScoreBg(components.grounding.score)}
                />
              )}
              {isReadinessComponent(components.benchmarkCoverage) && (
                <ComponentBar
                  icon={<BarChart3 className="w-4 h-4" />}
                  label="Benchmark Coverage"
                  score={components.benchmarkCoverage.score}
                  colorClass={getScoreBg(components.benchmarkCoverage.score)}
                />
              )}
              {isReadinessComponent(components.unsupportedCount) && (
                <ComponentBar
                  icon={<AlertTriangle className="w-4 h-4" />}
                  label="Unsupported"
                  score={components.unsupportedCount.score}
                  colorClass={getScoreBg(components.unsupportedCount.score)}
                />
              )}
            </>
          )}
        </div>
      </div>

      {blockers.length > 0 && (
        <div className="mt-6 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-medium text-red-800 mb-1">
            {blockers.length} blockers
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
