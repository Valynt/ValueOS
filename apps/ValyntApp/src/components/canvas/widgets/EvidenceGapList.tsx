/**
 * EvidenceGapList Widget
 *
 * List of claims with insufficient evidence, showing current tier, required tier, suggested action.
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §3.3
 */

import { AlertCircle, ArrowUpRight, Shield } from "lucide-react";
import React from "react";

import { WidgetProps } from "../CanvasHost";

export interface EvidenceGap {
  id: string;
  claimId: string;
  field: string;
  currentTier: "tier1" | "tier2" | "tier3" | "none";
  requiredTier: "tier1" | "tier2" | "tier3";
  suggestedAction: string;
  impact: "high" | "medium" | "low";
}

export interface EvidenceGapListData {
  gaps: EvidenceGap[];
}

export function EvidenceGapList({ data, onAction }: WidgetProps) {
  const widgetData = data as unknown as EvidenceGapListData;
  const gaps = widgetData.gaps ?? [];

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case "tier1":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "tier2":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "tier3":
        return "bg-amber-100 text-amber-800 border-amber-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getImpactBadge = (impact: string) => {
    switch (impact) {
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-amber-100 text-amber-800";
      case "low":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const sortedGaps = [...gaps].sort((a, b) => {
    const impactOrder = { high: 0, medium: 1, low: 2 };
    return impactOrder[a.impact] - impactOrder[b.impact];
  });

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-amber-100 rounded-lg">
          <AlertCircle className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Evidence Gaps</h3>
          <p className="text-sm text-muted-foreground">
            {gaps.length} {gaps.length === 1 ? "gap" : "gaps"} need attention
          </p>
        </div>
      </div>

      {sortedGaps.length === 0 ? (
        <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
          <Shield className="w-5 h-5 text-green-600" />
          <p className="text-green-800">No evidence gaps</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedGaps.map((gap) => (
            <div
              key={gap.id}
              className="p-4 rounded-lg border hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => onAction?.("select", { gapId: gap.id })}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-medium">{gap.field}</h4>
                  <p className="text-sm text-muted-foreground">{gap.suggestedAction}</p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${getImpactBadge(
                    gap.impact
                  )}`}
                >
                  {gap.impact.charAt(0).toUpperCase() + gap.impact.slice(1)} impact
                </span>
              </div>

              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${getTierBadge(
                      gap.currentTier
                    )}`}
                  >
                    Current: {gap.currentTier === "none" ? "None" : gap.currentTier.replace("tier", "Tier ")}
                  </span>
                </div>

                <ArrowUpRight className="w-4 h-4 text-muted-foreground" />

                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${getTierBadge(
                      gap.requiredTier
                    )}`}
                  >
                    Required: {gap.requiredTier.replace("tier", "Tier ")}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default EvidenceGapList;
