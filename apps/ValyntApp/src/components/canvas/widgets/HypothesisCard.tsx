/**
 * HypothesisCard Widget
 *
 * Value driver, impact range, evidence tier, confidence badge.
 * Includes Accept/Edit/Reject actions and "Lock as Assumption" promotion.
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §3.2
 */

import { ConfidenceBadge } from "@valueos/components/components/ConfidenceBadge";
import { Check, Edit3, Lock, TrendingUp, X } from "lucide-react";
import React from "react";

import { useToast } from "@/components/common/Toast";
import { WidgetProps } from "../CanvasHost";

export interface HypothesisData {
  id: string;
  valueDriver: string;
  impactRange: { low: number; high: number };
  evidenceTier: "tier1" | "tier2" | "tier3";
  confidenceScore: number;
  status: "pending" | "accepted" | "rejected" | "modified" | "promoted";
  benchmarkReference?: { source: string; p25: number; p50: number; p75: number };
}

export interface HypothesisCardWidgetData {
  hypotheses: HypothesisData[];
  canPromote?: boolean;
  phaseId?: string;
}

export function HypothesisCard({ data, onAction }: WidgetProps) {
  const { error, success } = useToast();

  // Validate data shape before casting
  const widgetData = validateHypothesisCardData(data);
  const hypotheses = widgetData?.hypotheses ?? [];
  const canPromote = widgetData?.canPromote ?? false;

  const getSourceTypeFromTier = (tier: string): string => {
    switch (tier) {
      case "tier1":
        return "customer-confirmed";
      case "tier2":
        return "benchmark-derived";
      default:
        return "inferred";
    }
  };

  const handleAction = async (
    action: "accept" | "edit" | "reject" | "promote-to-assumption",
    hypothesisId: string,
    payload?: { value?: number; unit?: string; sourceType?: string }
  ) => {
    try {
      if (action === "promote-to-assumption") {
        const hypothesis = hypotheses.find((h) => h.id === hypothesisId);
        if (hypothesis) {
          const avgValue = (hypothesis.impactRange.low + hypothesis.impactRange.high) / 2;
          await onAction?.(action, {
            hypothesisId,
            value: payload?.value ?? avgValue,
            unit: payload?.unit ?? "USD",
            sourceType: payload?.sourceType ?? getSourceTypeFromTier(hypothesis.evidenceTier),
          });
          success("Hypothesis locked as assumption.");
        }
      } else {
        await onAction?.(action, { hypothesisId });
        success(`Hypothesis ${action}ed.`);
      }
    } catch {
      error("Could not update hypothesis. Please try again.");
    }
  };

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
      case "promoted":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-4">
      {hypotheses.map((hypothesis) => (
        <div
          key={hypothesis.id}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
            }
          }}
          aria-label={`Hypothesis ${hypothesis.valueDriver}`}
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
              <span className="text-lg font-bold">${hypothesis.impactRange.low.toLocaleString()}</span>
              <span className="text-muted-foreground">-</span>
              <span className="text-lg font-bold">${hypothesis.impactRange.high.toLocaleString()}</span>
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
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  onClick={() => void handleAction("accept", hypothesis.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  Accept
                </button>
                <button
                  onClick={() => void handleAction("edit", hypothesis.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => void handleAction("reject", hypothesis.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Reject
                </button>
              </div>
              {canPromote && (
                <button
                  onClick={() => void handleAction("promote-to-assumption", hypothesis.id)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors w-full"
                >
                  <Lock className="w-4 h-4" />
                  Lock as Assumption
                </button>
              )}
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

// Validation helper for runtime type safety
function validateHypothesisCardData(data: unknown): HypothesisCardWidgetData | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;

  // Validate hypotheses array
  const hypotheses = Array.isArray(d.hypotheses) ? d.hypotheses : [];
  const validatedHypotheses = hypotheses.filter((h): h is HypothesisData => {
    if (!h || typeof h !== "object") return false;
    const hypothesis = h as Record<string, unknown>;
    return (
      typeof hypothesis.id === "string" &&
      typeof hypothesis.valueDriver === "string" &&
      typeof hypothesis.confidenceScore === "number" &&
      hypothesis.confidenceScore >= 0 &&
      hypothesis.confidenceScore <= 1
    );
  });

  return {
    hypotheses: validatedHypotheses,
    canPromote: typeof d.canPromote === "boolean" ? d.canPromote : false,
    phaseId: typeof d.phaseId === "string" ? d.phaseId : undefined,
  };
}
