/**
 * MetricCard Component
 * Displays a metric with Truth Engine verification status
 */

import React from "react";
import { AlertCircle, CheckCircle, Info } from "lucide-react";
import { VerificationBadge } from "./VerificationBadge";
import { CitationTooltip } from "./CitationTooltip";

export type MetricTrend = "up" | "down" | "neutral";
export type MetricVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "danger";

export interface MetricCardProps {
  label: string;
  value: string | number;

  // Truth Engine integration
  verified: boolean;
  confidence?: number; // 0-100
  citations?: string[]; // Source IDs

  // Visual enhancements
  trend?: MetricTrend;
  variant?: MetricVariant;
  subtitle?: string;
  icon?: React.ReactNode;

  // Interactions
  onClick?: () => void;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  verified,
  confidence,
  citations = [],
  trend,
  variant = "default",
  subtitle,
  icon,
  onClick,
  className = "",
}) => {
  // Variant styling
  const variantClasses: Record<MetricVariant, string> = {
    default: "bg-card border-border",
    primary: "bg-primary/10 border-primary/30",
    success:
      "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800",
    warning:
      "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800",
    danger: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800",
  };

  // Trend icons and colors
  const getTrendIndicator = () => {
    if (!trend || trend === "neutral") return null;

    return (
      <span
        className={`text-xs font-medium ${
          trend === "up"
            ? "text-green-600 dark:text-green-400"
            : "text-red-600 dark:text-red-400"
        }`}
      >
        {trend === "up" ? "↑" : "↓"}
      </span>
    );
  };

  return (
    <div
      onClick={onClick}
      className={`
        ${variantClasses[variant]}
        border rounded-lg p-4 transition-all
        ${onClick ? "cursor-pointer hover:shadow-md hover:border-primary/50" : ""}
        ${className}
      `}
    >
      {/* Header with label and verification */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-1">
          {icon && <div className="text-muted-foreground">{icon}</div>}
          <span className="text-sm font-medium text-muted-foreground">
            {label}
          </span>
        </div>

        {/* Verification badge */}
        <VerificationBadge
          status={verified ? "verified" : "pending"}
          confidence={confidence}
          showLabel={false}
        />
      </div>

      {/* Main value */}
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-2xl font-bold text-foreground">{value}</span>
        {getTrendIndicator()}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <p className="text-xs text-muted-foreground mb-2">{subtitle}</p>
      )}

      {/* Citations footer */}
      {citations.length > 0 && (
        <div className="flex items-center gap-2 pt-2 border-t border-border/50">
          <Info className="w-3 h-3 text-blue-500" />
          <span className="text-xs text-blue-600 dark:text-blue-400">
            {citations.length} {citations.length === 1 ? "source" : "sources"}
          </span>

          {/* Citation tooltips */}
          <div className="flex gap-1">
            {citations.slice(0, 3).map((citationId, idx) => (
              <CitationTooltip
                key={citationId}
                citationId={citationId}
                sourceType={getCitationSourceType(citationId)}
              />
            ))}
            {citations.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{citations.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Unverified warning */}
      {!verified && (
        <div className="mt-2 flex items-center gap-2 px-2 py-1 bg-amber-50 dark:bg-amber-950/50 rounded text-xs text-amber-700 dark:text-amber-300">
          <AlertCircle className="w-3 h-3" />
          <span>
            {confidence !== undefined
              ? `Confidence: ${confidence}% (below threshold)`
              : "Verification pending"}
          </span>
        </div>
      )}
    </div>
  );
};

// Helper to determine source type from citation ID format
function getCitationSourceType(
  citationId: string
): "crm" | "database" | "api" | "document" {
  if (citationId.startsWith("CRM-")) return "crm";
  if (citationId.startsWith("DB-")) return "database";
  if (citationId.startsWith("API-")) return "api";
  if (citationId.startsWith("DOC-")) return "document";
  return "database"; // default
}

export default MetricCard;
