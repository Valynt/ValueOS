import React, { useState } from "react";

import { ConfidenceBadge } from "./ConfidenceBadge";
import { SourceBadge, SourceType } from "./SourceBadge";

export interface EvidenceCardProps {
  /** Evidence description text */
  description: string;
  /** Source classification */
  sourceType: SourceType;
  /** Confidence score (0-1) */
  confidenceScore: number;
  /** Date the evidence was captured */
  freshnessDate: string;
  /** Evidence tier (1-3) */
  tier: 1 | 2 | 3;
  /** Full source URL for detail view */
  sourceUrl?: string;
  /** Additional metadata */
  metadata?: Record<string, string>;
  /** Initial expanded state */
  defaultExpanded?: boolean;
  /** Callback when expand/collapse is toggled */
  onToggle?: (expanded: boolean) => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * Displays evidence with source, confidence, and expandable detail.
 *
 * Shows in collapsed mode by default with key info (description, source badge,
 * confidence badge, freshness). Expandable to show full source URL and metadata.
 *
 * @example
 * <EvidenceCard
 *   description="Q3 revenue increased 15% YoY"
 *   sourceType="SEC-filing"
 *   confidenceScore={0.95}
 *   freshnessDate="2024-01-15"
 *   tier={1}
 *   sourceUrl="https://sec.gov/..."
 * />
 */
export const EvidenceCard = React.forwardRef<HTMLDivElement, EvidenceCardProps>(
  (
    {
      description,
      sourceType,
      confidenceScore,
      freshnessDate,
      tier,
      sourceUrl,
      metadata,
      defaultExpanded = false,
      onToggle,
      className = "",
    },
    ref
  ) => {
    const [expanded, setExpanded] = useState(defaultExpanded);

    const handleToggle = () => {
      const newState = !expanded;
      setExpanded(newState);
      onToggle?.(newState);
    };

    const tierLabels = { 1: "Tier 1", 2: "Tier 2", 3: "Tier 3" };
    const tierColors = {
      1: { bg: "#dcfce7", color: "#16a34a" },
      2: { bg: "#dbeafe", color: "#2563eb" },
      3: { bg: "#f3f4f6", color: "#6b7280" },
    };

    const tierStyle = tierColors[tier];

    // Format freshness date with error handling
    const date = new Date(freshnessDate);
    const isValidDate = !isNaN(date.getTime());

    const formattedDate = isValidDate
      ? date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
      : "Invalid date";

    const daysSince = isValidDate
      ? Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
      : NaN;
    const freshnessLabel = !isValidDate
      ? "Unknown"
      : daysSince === 0
        ? "Today"
        : daysSince === 1
          ? "Yesterday"
          : `${daysSince} days ago`;

    return (
      <div
        ref={ref}
        className={className}
        data-testid="evidence-card"
        data-expanded={expanded}
        style={{
          border: "1px solid var(--vds-color-border, #e5e7eb)",
          borderRadius: "8px",
          padding: "12px",
          background: "var(--vds-color-surface, white)",
        }}
      >
        {/* Header: Description */}
        <p
          style={{
            margin: "0 0 8px 0",
            fontSize: "14px",
            lineHeight: "1.5",
            color: "var(--vds-color-text-primary, #111827)",
          }}
        >
          {description}
        </p>

        {/* Badges Row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
            marginBottom: "8px",
          }}
        >
          <SourceBadge sourceType={sourceType} size="sm" />
          <ConfidenceBadge score={confidenceScore} size="sm" />
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "2px 6px",
              borderRadius: "4px",
              fontSize: "10px",
              fontWeight: 500,
              background: tierStyle.bg,
              color: tierStyle.color,
            }}
          >
            {tierLabels[tier]}
          </span>
        </div>

        {/* Freshness */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "12px",
            color: "var(--vds-color-text-secondary, #6b7280)",
            marginBottom: expanded ? "8px" : "0",
          }}
        >
          <span>📅</span>
          <span title={formattedDate}>{freshnessLabel}</span>
        </div>

        {/* Expand/Collapse Toggle */}
        <button
          onClick={handleToggle}
          aria-expanded={expanded}
          aria-controls="evidence-details"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            marginTop: "8px",
            fontSize: "12px",
            color: "var(--vds-color-primary, #2563eb)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px 0",
          }}
        >
          <span>{expanded ? "▲" : "▼"}</span>
          <span>{expanded ? "Hide details" : "Show details"}</span>
        </button>

        {/* Expanded Detail Section */}
        {expanded && (
          <div
            id="evidence-details"
            style={{
              marginTop: "12px",
              paddingTop: "12px",
              borderTop: "1px solid var(--vds-color-border, #e5e7eb)",
            }}
          >
            {sourceUrl && (
              <div style={{ marginBottom: "8px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 500,
                    color: "var(--vds-color-text-secondary, #6b7280)",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  Source URL
                </span>
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "block",
                    fontSize: "12px",
                    color: "var(--vds-color-primary, #2563eb)",
                    textDecoration: "none",
                    wordBreak: "break-all",
                    marginTop: "4px",
                  }}
                >
                  {sourceUrl}
                </a>
              </div>
            )}

            {metadata && Object.keys(metadata).length > 0 && (
              <div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 500,
                    color: "var(--vds-color-text-secondary, #6b7280)",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  Metadata
                </span>
                <dl
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    gap: "4px 12px",
                    margin: "4px 0 0 0",
                    fontSize: "12px",
                  }}
                >
                  {Object.entries(metadata).map(([key, value]) => (
                    <React.Fragment key={key}>
                      <dt style={{ color: "var(--vds-color-text-secondary, #6b7280)" }}>{key}:</dt>
                      <dd style={{ margin: 0, color: "var(--vds-color-text-primary, #111827)" }}>{value}</dd>
                    </React.Fragment>
                  ))}
                </dl>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

EvidenceCard.displayName = "EvidenceCard";
