/**
 * IntegrityScoreCard — Sprint 54
 *
 * Displays the composite integrity_score for a business case alongside
 * a breakdown of open violations by severity.
 *
 * Visual behaviour:
 *   - Circular gauge showing integrity_score (0–1)
 *   - Violation count chips: Critical (red), Warning (amber), Info (blue)
 *   - If hardBlocked=true: card border pulses red, badge reads "Blocked"
 *   - "Review Violations" CTA
 *   - Quick-action button for most recent warning
 *
 * Registered in:
 *   - packages/sdui/src/registry.tsx
 *   - config/ui-registry.json
 */

import React from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IntegrityViolation {
  id: string;
  type: "SCALAR_CONFLICT" | "FINANCIAL_SANITY" | "LOGIC_CHAIN_BREAK" | "UNIT_MISMATCH";
  severity: "critical" | "warning" | "info";
  description: string;
  status: "OPEN" | "RESOLVED_AUTO" | "DISMISSED";
}

export interface IntegrityScoreCardProps {
  /** Composite integrity score (0–1). Null if not yet computed. */
  integrityScore: number | null;
  /** Defense readiness sub-component (0–1). */
  defenseReadinessScore: number | null;
  /** All open violations for this case. */
  violations: IntegrityViolation[];
  /** True when open critical violations block status advance to in_review. */
  hardBlocked: boolean;
  /** Called when the user clicks a violation chip or "Review Violations". */
  onReviewViolations?: () => void;
  /** Called with the violation ID when the quick-action resolve button is clicked. */
  onResolveLatestWarning?: (id: string) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getScoreStatus(
  score: number | null,
  hardBlocked: boolean,
): "blocked" | "warning" | "healthy" | "unknown" {
  if (hardBlocked) return "blocked";
  if (score === null) return "unknown";
  if (score >= 0.8) return "healthy";
  if (score >= 0.5) return "warning";
  return "blocked";
}

function scoreStatusColor(status: ReturnType<typeof getScoreStatus>): string {
  switch (status) {
    case "blocked":
      return "text-red-600";
    case "warning":
      return "text-amber-600";
    case "healthy":
      return "text-green-600";
    default:
      return "text-muted-foreground";
  }
}

function scoreBorderClass(hardBlocked: boolean): string {
  return hardBlocked
    ? "border-red-500 animate-pulse"
    : "border-border";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ViolationChip({
  count,
  label,
  colorClass,
  onClick,
}: {
  count: number;
  label: string;
  colorClass: string;
  onClick?: () => void;
}) {
  if (count === 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colorClass} cursor-pointer hover:opacity-80 transition-opacity`}
      aria-label={`${count} ${label} violation${count !== 1 ? "s" : ""}`}
    >
      <span>{count}</span>
      <span>{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * IntegrityScoreCard
 *
 * Displays the composite integrity score and violation summary for a business
 * case. Pulses red when hard-blocked by critical violations.
 */
export function IntegrityScoreCard({
  integrityScore,
  defenseReadinessScore,
  violations,
  hardBlocked,
  onReviewViolations,
  onResolveLatestWarning,
  className = "",
}: IntegrityScoreCardProps) {
  const status = getScoreStatus(integrityScore, hardBlocked);
  const statusColor = scoreStatusColor(status);
  const borderClass = scoreBorderClass(hardBlocked);

  const criticalCount = violations.filter((v) => v.severity === "critical").length;
  const warningCount = violations.filter((v) => v.severity === "warning").length;
  const infoCount = violations.filter((v) => v.severity === "info").length;

  // Most recent warning for the quick-action button
  const latestWarning = violations.find((v) => v.severity === "warning");

  const circumference = 2 * Math.PI * 45;
  const scoreValue = integrityScore ?? 0;
  const strokeDashoffset = circumference * (1 - scoreValue);

  const statusLabel =
    status === "blocked"
      ? "Blocked"
      : status === "warning"
      ? "At Risk"
      : status === "healthy"
      ? "Healthy"
      : "Pending";

  return (
    <div
      className={`bg-card border rounded-lg p-4 ${borderClass} ${className}`}
      role="region"
      aria-label="Integrity Score"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">Integrity Score</h3>
        {hardBlocked && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
            Blocked
          </span>
        )}
      </div>

      <div className="flex items-center gap-5">
        {/* Circular gauge */}
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            {/* Background track */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-gray-200"
            />
            {/* Score arc */}
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
              className={`${statusColor} transition-all duration-500`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-xl font-bold ${statusColor}`}>
              {integrityScore !== null
                ? `${(integrityScore * 100).toFixed(0)}%`
                : "—"}
            </span>
            <span className="text-xs text-muted-foreground">{statusLabel}</span>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 space-y-3">
          {/* Defense readiness sub-score */}
          {defenseReadinessScore !== null && (
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Defense Readiness</span>
                <span className="font-medium">
                  {(defenseReadinessScore * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    defenseReadinessScore >= 0.8
                      ? "bg-green-500"
                      : defenseReadinessScore >= 0.5
                      ? "bg-amber-500"
                      : "bg-red-500"
                  }`}
                  style={{ width: `${defenseReadinessScore * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Violation chips */}
          {violations.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              <ViolationChip
                count={criticalCount}
                label="Critical"
                colorClass="bg-red-100 text-red-700"
                onClick={onReviewViolations}
              />
              <ViolationChip
                count={warningCount}
                label="Warning"
                colorClass="bg-amber-100 text-amber-700"
                onClick={onReviewViolations}
              />
              <ViolationChip
                count={infoCount}
                label="Info"
                colorClass="bg-blue-100 text-blue-700"
                onClick={onReviewViolations}
              />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No open violations</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2">
        {violations.length > 0 && (
          <button
            type="button"
            onClick={onReviewViolations}
            className="flex-1 text-xs font-medium py-1.5 px-3 rounded-md border border-border hover:bg-accent transition-colors"
          >
            Review Violations
          </button>
        )}
        {latestWarning && onResolveLatestWarning && (
          <button
            type="button"
            onClick={() => onResolveLatestWarning(latestWarning.id)}
            className="text-xs font-medium py-1.5 px-3 rounded-md bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
            title={`Resolve: ${latestWarning.description}`}
          >
            Resolve Warning
          </button>
        )}
      </div>
    </div>
  );
}
