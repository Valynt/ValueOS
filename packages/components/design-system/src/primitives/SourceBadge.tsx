import React from "react";

export type SourceType =
  | "customer-confirmed"
  | "CRM-derived"
  | "call-derived"
  | "benchmark-derived"
  | "SEC-filing"
  | "inferred"
  | "manually-overridden";

export interface SourceBadgeProps {
  /** Source type classification */
  sourceType: SourceType;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Show tier indicator alongside source */
  showTier?: boolean;
  /** Additional CSS class */
  className?: string;
}

interface SourceConfig {
  label: string;
  icon: string;
  tier: 1 | 2 | 3;
  color: string;
  background: string;
}

const sourceConfigs: Record<SourceType, SourceConfig> = {
  "customer-confirmed": {
    label: "Customer Confirmed",
    icon: "✓",
    tier: 1,
    color: "#16a34a",
    background: "#dcfce7",
  },
  "SEC-filing": {
    label: "SEC Filing",
    icon: "📄",
    tier: 1,
    color: "#16a34a",
    background: "#dcfce7",
  },
  "CRM-derived": {
    label: "CRM",
    icon: "💼",
    tier: 2,
    color: "#2563eb",
    background: "#dbeafe",
  },
  "benchmark-derived": {
    label: "Benchmark",
    icon: "📊",
    tier: 2,
    color: "#2563eb",
    background: "#dbeafe",
  },
  "call-derived": {
    label: "Call",
    icon: "📞",
    tier: 3,
    color: "#7c3aed",
    background: "#ede9fe",
  },
  inferred: {
    label: "Inferred",
    icon: "🔮",
    tier: 3,
    color: "#6b7280",
    background: "#f3f4f6",
  },
  "manually-overridden": {
    label: "Manual Override",
    icon: "✎",
    tier: 3,
    color: "#ea580c",
    background: "#ffedd5",
  },
};

/**
 * Displays a source type badge with icon, tier indicator, and color coding.
 *
 * Tier classification:
 * - Tier 1: customer-confirmed, SEC-filing (highest reliability)
 * - Tier 2: CRM-derived, benchmark-derived (moderate reliability)
 * - Tier 3: call-derived, inferred, manually-overridden (lowest reliability)
 *
 * @example
 * <SourceBadge sourceType="customer-confirmed" />
 * <SourceBadge sourceType="benchmark-derived" showTier />
 */
export const SourceBadge = React.forwardRef<HTMLSpanElement, SourceBadgeProps>(
  ({ sourceType, size = "md", showTier = false, className = "" }, ref) => {
    const config = sourceConfigs[sourceType];
    const tierLabel = `Tier ${config.tier}`;

    const sizeStyles = {
      sm: { padding: "2px 6px", fontSize: "10px", gap: "4px" },
      md: { padding: "4px 8px", fontSize: "12px", gap: "6px" },
      lg: { padding: "6px 12px", fontSize: "14px", gap: "8px" },
    };

    const sizeStyle = sizeStyles[size];

    return (
      <span
        ref={ref}
        className={className}
        data-source={sourceType}
        data-tier={config.tier}
        data-testid="source-badge"
        aria-label={`${config.label} source, ${tierLabel}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          borderRadius: "6px",
          fontWeight: 500,
          border: `1px solid ${config.color}`,
          background: config.background,
          color: config.color,
          ...sizeStyle,
        }}
      >
        <span aria-hidden="true">{config.icon}</span>
        <span>{config.label}</span>
        {showTier && (
          <span
            style={{
              marginLeft: "4px",
              padding: "0 4px",
              borderRadius: "4px",
              background: config.color,
              color: "white",
              fontSize: "0.75em",
              fontWeight: 600,
            }}
          >
            T{config.tier}
          </span>
        )}
      </span>
    );
  }
);

SourceBadge.displayName = "SourceBadge";
