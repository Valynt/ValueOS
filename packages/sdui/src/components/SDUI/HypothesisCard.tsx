import React from "react";

export interface Hypothesis {
  id: string;
  valueDriver: string;
  impactRange: {
    low: number;
    high: number;
  };
  evidenceTier: "tier1" | "tier2" | "tier3";
  confidenceScore: number;
  status: "pending" | "accepted" | "rejected" | "modified";
}

export interface HypothesisCardProps {
  hypothesis: Hypothesis;
  onAccept?: (id: string) => void;
  onEdit?: (id: string) => void;
  onReject?: (id: string) => void;
  className?: string;
}

/**
 * HypothesisCard - Value driver card with impact range, evidence tier, and actions.
 * 
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §3.2.1
 */
export function HypothesisCard({ hypothesis, onAccept, onEdit, onReject, className = "" }: HypothesisCardProps) {
  const tierColors = {
    tier1: "bg-green-100 text-green-800 border-green-200",
    tier2: "bg-blue-100 text-blue-800 border-blue-200",
    tier3: "bg-gray-100 text-gray-800 border-gray-200",
  };

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800",
    accepted: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    modified: "bg-blue-100 text-blue-800",
  };

  return (
    <div className={`bg-card border border-border rounded-lg p-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h4 className="font-semibold text-sm">{hypothesis.valueDriver}</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Impact: ${hypothesis.impactRange.low.toLocaleString()} - ${hypothesis.impactRange.high.toLocaleString()}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-xs px-2 py-0.5 rounded border ${tierColors[hypothesis.evidenceTier]}`}>
              {hypothesis.evidenceTier}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded ${statusColors[hypothesis.status]}`}>
              {hypothesis.status}
            </span>
            <span className="text-xs text-muted-foreground">
              {(hypothesis.confidenceScore * 100).toFixed(0)}% confidence
            </span>
          </div>
        </div>
        {hypothesis.status === "pending" && (
          <div className="flex gap-2">
            <button
              onClick={() => onAccept?.(hypothesis.id)}
              className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
            >
              Accept
            </button>
            <button
              onClick={() => onEdit?.(hypothesis.id)}
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Edit
            </button>
            <button
              onClick={() => onReject?.(hypothesis.id)}
              className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
            >
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
