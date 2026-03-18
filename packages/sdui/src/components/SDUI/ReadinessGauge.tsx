import React from "react";

export interface ReadinessComponent {
  name: string;
  score: number;
  weight: number;
}

export interface ReadinessGaugeProps {
  compositeScore: number;
  status: "presentation-ready" | "draft" | "blocked";
  components: {
    validationRate: ReadinessComponent;
    grounding: ReadinessComponent;
    benchmarkCoverage: ReadinessComponent;
    unsupportedCount: ReadinessComponent;
  };
  className?: string;
}

/**
 * ReadinessGauge - Circular gauge for composite score with component breakdown.
 * 
 * Shows: composite score, four component bars (validation rate, grounding, 
 * benchmark coverage, unsupported count).
 * 
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §3.3.1
 */
export function ReadinessGauge({
  compositeScore,
  status,
  components,
  className = "",
}: ReadinessGaugeProps) {
  const getStatusColor = () => {
    switch (status) {
      case "presentation-ready":
        return "text-green-600";
      case "draft":
        return "text-yellow-600";
      case "blocked":
        return "text-red-600";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return "bg-green-500";
    if (score >= 0.5) return "bg-yellow-500";
    return "bg-red-500";
  };

  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference * (1 - compositeScore);

  return (
    <div className={`bg-card border border-border rounded-lg p-4 ${className}`}>
      <h3 className="font-semibold text-sm mb-4">Defense Readiness</h3>
      
      <div className="flex items-center gap-6">
        {/* Circular Gauge */}
        <div className="relative w-32 h-32 flex-shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-gray-200"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={`${getStatusColor()} transition-all duration-500`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-bold ${getStatusColor()}`}>
              {(compositeScore * 100).toFixed(0)}%
            </span>
            <span className="text-xs text-muted-foreground capitalize">{status}</span>
          </div>
        </div>

        {/* Component Bars */}
        <div className="flex-1 space-y-3">
          <ComponentBar
            label="Validation Rate"
            score={components.validationRate.score}
          />
          <ComponentBar
            label="Evidence Grounding"
            score={components.grounding.score}
          />
          <ComponentBar
            label="Benchmark Coverage"
            score={components.benchmarkCoverage.score}
          />
          <ComponentBar
            label="Unsupported Count"
            score={components.unsupportedCount.score}
            inverse
          />
        </div>
      </div>
    </div>
  );
}

function ComponentBar({
  label,
  score,
  inverse = false,
}: {
  label: string;
  score: number;
  inverse?: boolean;
}) {
  const displayScore = inverse ? 1 - score : score;
  const colorClass =
    displayScore >= 0.8
      ? "bg-green-500"
      : displayScore >= 0.5
      ? "bg-yellow-500"
      : "bg-red-500";

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{(score * 100).toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClass} transition-all duration-500`}
          style={{ width: `${score * 100}%` }}
        />
      </div>
    </div>
  );
}
