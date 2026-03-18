/**
 * EvidenceCard
 *
 * Displays evidence description with source badge, confidence badge, freshness date, and tier.
 * Has expandable detail section with full source URL and metadata.
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §1.4
 */

import React, { useState } from "react";
import { ChevronDown, ChevronUp, Calendar, Link2 } from "lucide-react";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { SourceBadge, SourceType } from "./SourceBadge";

export interface EvidenceCardProps {
  id: string;
  description: string;
  sourceType: SourceType;
  confidenceScore: number;
  freshnessDate: string;
  tier: 1 | 2 | 3;
  sourceUrl?: string;
  metadata?: Record<string, string>;
  className?: string;
}

export function EvidenceCard({
  description,
  sourceType,
  confidenceScore,
  freshnessDate,
  tier,
  sourceUrl,
  metadata,
  className = "",
}: EvidenceCardProps) {
  const [expanded, setExpanded] = useState(false);

  const tierBadgeClass =
    tier === 1
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : tier === 2
        ? "bg-blue-100 text-blue-800 border-blue-200"
        : "bg-amber-100 text-amber-800 border-amber-200";

  const formattedDate = new Date(freshnessDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div
      className={`rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm ${className}`}
      data-testid="evidence-card"
    >
      {/* Header row with badges */}
      <div className="flex flex-wrap items-start gap-2 mb-3">
        <SourceBadge sourceType={sourceType} size="sm" />
        <ConfidenceBadge score={confidenceScore} />
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${tierBadgeClass}`}
          aria-label={`Evidence tier ${tier}`}
        >
          Tier {tier}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-foreground mb-3">{description}</p>

      {/* Footer row with date and expand toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="w-3.5 h-3.5" />
          <span>{formattedDate}</span>
        </div>

        {(sourceUrl || metadata) && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
            aria-expanded={expanded}
            aria-controls="evidence-details"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                Less details
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                More details
              </>
            )}
          </button>
        )}
      </div>

      {/* Expandable details section */}
      {expanded && (sourceUrl || metadata) && (
        <div
          id="evidence-details"
          className="mt-3 pt-3 border-t space-y-2"
          data-testid="evidence-details"
        >
          {sourceUrl && (
            <div className="flex items-start gap-2">
              <Link2 className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline break-all"
              >
                {sourceUrl}
              </a>
            </div>
          )}

          {metadata && Object.keys(metadata).length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(metadata).map(([key, value]) => (
                <div key={key} className="text-xs">
                  <span className="text-muted-foreground capitalize">{key}:</span>{" "}
                  <span className="text-foreground font-medium">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
