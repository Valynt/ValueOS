import React from "react";

export interface ConfidenceBadgeProps {
  /** Confidence score between 0 and 1 */
  score: number;
  /** Show percentage or just tier indicator */
  showPercentage?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Additional CSS class */
  className?: string;
}

/**
 * Displays a confidence score with color-coded tier indicator.
 *
 * Color coding:
 * - Green (>= 0.8): High confidence
 * - Amber (>= 0.5): Medium confidence
 * - Red (< 0.5): Low confidence
 *
 * @example
 * <ConfidenceBadge score={0.85} />
 * <ConfidenceBadge score={0.65} showPercentage />
 */
export const ConfidenceBadge = React.forwardRef<HTMLSpanElement, ConfidenceBadgeProps>(
  ({ score, showPercentage = true, size = "md", className = "" }, ref) => {
    // Determine tier and color based on score
    const tier = score >= 0.8 ? "high" : score >= 0.5 ? "medium" : "low";
    const tierLabel = tier === "high" ? "High" : tier === "medium" ? "Medium" : "Low";

    const colorStyles = {
      high: {
        background: "var(--vds-color-success-light, #dcfce7)",
        color: "var(--vds-color-success, #16a34a)",
        border: "var(--vds-color-success, #16a34a)",
      },
      medium: {
        background: "var(--vds-color-warning-light, #fef3c7)",
        color: "var(--vds-color-warning, #d97706)",
        border: "var(--vds-color-warning, #d97706)",
      },
      low: {
        background: "var(--vds-color-error-light, #fee2e2)",
        color: "var(--vds-color-error, #dc2626)",
        border: "var(--vds-color-error, #dc2626)",
      },
    };

    const sizeStyles = {
      sm: { padding: "2px 6px", fontSize: "10px", gap: "2px" },
      md: { padding: "4px 8px", fontSize: "12px", gap: "4px" },
      lg: { padding: "6px 12px", fontSize: "14px", gap: "6px" },
    };

    const styles = colorStyles[tier];
    const sizeStyle = sizeStyles[size];
    const percentage = Math.round(score * 100);

    return (
      <span
        ref={ref}
        className={className}
        data-tier={tier}
        data-testid="confidence-badge"
        aria-label={`${tierLabel} confidence: ${percentage} percent`}
        title={`Raw score: ${score.toFixed(2)}\nTier: ${tierLabel}\nThreshold: ${tier === "high" ? "≥0.8" : tier === "medium" ? "≥0.5" : "<0.5"}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          borderRadius: "9999px",
          fontWeight: 500,
          border: `1px solid ${styles.border}`,
          background: styles.background,
          color: styles.color,
          ...sizeStyle,
        }}
      >
        <span
          style={{
            width: size === "sm" ? "6px" : size === "md" ? "8px" : "10px",
            height: size === "sm" ? "6px" : size === "md" ? "8px" : "10px",
            borderRadius: "50%",
            background: styles.color,
          }}
        />
        {showPercentage ? `${percentage}%` : tierLabel}
      </span>
    );
  }
);

ConfidenceBadge.displayName = "ConfidenceBadge";
