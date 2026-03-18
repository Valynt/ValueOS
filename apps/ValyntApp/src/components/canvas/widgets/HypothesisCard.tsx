/**
 * HypothesisCard Widget
 *
 * Value driver, impact range, evidence tier, confidence badge, Accept/Edit/Reject actions.
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §3.2
 */

import React from "react";
import { Check, X, Edit3, TrendingUp } from "lucide-react";
import { ConfidenceBadge } from "@valueos/components/components/ConfidenceBadge";
import { WidgetProps } from "../CanvasHost";

export interface HypothesisData {
  id: string;
  valueDriver: string;
  impactRange: { low: number; high: number };
  evidenceTier: "tier1" | "tier2" | "tier3";
  confidenceScore: number;
  status: "pending" | "accepted" | "rejected" | "modified";
  benchmarkReference?: { source: string; p25: number; p50: number; p75: number };
}

export interface HypothesisCardWidgetData {
  hypotheses: HypothesisData[];
}

export function HypothesisCard({ data, onAction }: WidgetProps) {
  const widgetData = data as unknown as HypothesisCardWidgetData;
  const hypotheses = widgetData.hypotheses ?? [];

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "accepted":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "modified":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-4">
      {hypotheses.map((hypothesis) => (
        <div
          key={hypothesis.id}
          className="rounded-xl border bg-card p-5 transition-all hover:shadow-sm"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold">{hypothesis.valueDriver}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${getTierBadge(hypothesis.evidenceTier)}`}>
                    {hypothesis.evidenceTier.replace("tier", "Tier ")}
                  </span>
                  <ConfidenceBadge score={hypothesis.confidenceScore} showTooltip={false} />
                </div>
              </div>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusBadge(hypothesis.status)}`}>
              {hypothesis.status.charAt(0).toUpperCase() + hypothesis.status.slice(1)}
            </span>
          </div>

          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-2">Impact Range</p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">
                ${hypothesis.impactRange.low.toLocaleString()} - ${hypothesis.impactRange.high.toLocaleString()}
              </span>
            </div>
          </div>

          {hypothesis.benchmarkReference && (
            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Benchmark Reference</p>
              <p className="text-sm font-medium">{hypothesis.benchmarkReference.source}</p>
              <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                <span>P25: {hypothesis.benchmarkReference.p25}%</span>
                <span>P50: {hypothesis.benchmarkReference.p50}%</span>
                <span>P75: {hypothesis.benchmarkReference.p75}%</span>
              </div>
            </div>
          )}

          {hypothesis.status === "pending" && (
            <div className="flex gap-2">
              <button
                onClick={() => onAction?.("accept", { hypothesisId: hypothesis.id })}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
              >
                <Check className="w-4 h-4" />
                Accept
              </button>
              <button
                onClick={() => onAction?.("edit", { hypothesisId: hypothesis.id })}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={() => onAction?.("reject", { hypothesisId: hypothesis.id })}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                <X className="w-4 h-4" />
                Reject
              </button>
            </div>
          )}
        </div>
      ))}

      {hypotheses.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No value hypotheses generated yet</p>
        </div>
      )}
    </div>
  );
}

export default HypothesisCard;
