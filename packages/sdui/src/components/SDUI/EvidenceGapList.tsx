import React from "react";

export interface EvidenceGap {
  id: string;
  claimId: string;
  field: string;
  currentTier: "tier1" | "tier2" | "tier3" | "none";
  requiredTier: "tier1" | "tier2" | "tier3";
  suggestedAction: string;
  impact: "high" | "medium" | "low";
}

export interface EvidenceGapListProps {
  gaps: EvidenceGap[];
  onAction?: (gapId: string, action: string) => void;
  className?: string;
}

/**
 * EvidenceGapList - List of claims with insufficient evidence.
 * 
 * Shows: current tier, required tier, suggested action for each gap.
 * 
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §3.3.2
 */
export function EvidenceGapList({ gaps, onAction, className = "" }: EvidenceGapListProps) {
  const tierColors = {
    tier1: "bg-green-100 text-green-800 border-green-200",
    tier2: "bg-blue-100 text-blue-800 border-blue-200",
    tier3: "bg-gray-100 text-gray-800 border-gray-200",
    none: "bg-red-100 text-red-800 border-red-200",
  };

  const impactColors = {
    high: "text-red-600 font-semibold",
    medium: "text-yellow-600",
    low: "text-muted-foreground",
  };

  const sortedGaps = [...gaps].sort((a, b) => {
    const impactOrder = { high: 3, medium: 2, low: 1 };
    return impactOrder[b.impact] - impactOrder[a.impact];
  });

  return (
    <div className={`bg-card border border-border rounded-lg p-4 ${className}`}>
      <h3 className="font-semibold text-sm mb-3">
        Evidence Gaps {gaps.length > 0 && <span className="text-muted-foreground">({gaps.length})</span>}
      </h3>
      
      <div className="space-y-3">
        {sortedGaps.map((gap) => (
          <div key={gap.id} className="border border-border rounded-md p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="font-medium text-sm">{gap.field}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded border ${tierColors[gap.currentTier]}`}>
                    Current: {gap.currentTier}
                  </span>
                  <span>→</span>
                  <span className={`text-xs px-2 py-0.5 rounded border ${tierColors[gap.requiredTier]}`}>
                    Required: {gap.requiredTier}
                  </span>
                </div>
                <p className={`text-sm mt-2 ${impactColors[gap.impact]}`}>
                  Impact: {gap.impact}
                </p>
                <div className="mt-2 p-2 bg-accent/50 rounded text-sm">
                  <span className="text-muted-foreground text-xs">Suggested Action:</span>
                  <p className="mt-0.5">{gap.suggestedAction}</p>
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => onAction?.(gap.id, "attach_evidence")}
                className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                Attach Evidence
              </button>
              <button
                onClick={() => onAction?.(gap.id, "find_benchmark")}
                className="px-3 py-1.5 text-xs bg-secondary text-secondary-foreground rounded hover:bg-secondary/90"
              >
                Find Benchmark
              </button>
              <button
                onClick={() => onAction?.(gap.id, "skip")}
                className="px-3 py-1.5 text-xs border border-border rounded hover:bg-accent/50"
              >
                Skip
              </button>
            </div>
          </div>
        ))}
      </div>

      {gaps.length === 0 && (
        <div className="text-center py-6">
          <span className="text-2xl">✓</span>
          <p className="text-sm text-muted-foreground mt-2">All evidence gaps resolved</p>
        </div>
      )}
    </div>
  );
}
