/**
 * AssumptionsAtRisk — Displays assumptions below confidence threshold.
 *
 * Used in the executive reviewer surface to highlight weak spots in a value case.
 */

import { AlertTriangle } from "lucide-react";

import { WarmthBadge } from "@/components/warmth/WarmthBadge";
import type { WarmthState } from "@/lib/warmth";

export interface ReviewAssumption {
  id: string;
  name: string;
  confidenceScore: number;
  sourceType: string;
  warmthState: WarmthState;
}

interface AssumptionsAtRiskProps {
  assumptions: ReviewAssumption[];
  threshold: number;
  onRequestClarification?: (assumptionId: string) => void;
}

export function AssumptionsAtRisk({
  assumptions,
  threshold,
  onRequestClarification,
}: AssumptionsAtRiskProps) {
  const atRisk = assumptions.filter((a) => a.confidenceScore < threshold);

  if (atRisk.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-zinc-400">
          No assumptions at risk — all assumptions are strong
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {atRisk.map((assumption) => (
        <div
          key={assumption.id}
          className="flex items-start gap-3 p-3 rounded-xl border border-zinc-100 hover:border-zinc-200 transition-colors"
        >
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-medium text-zinc-900 truncate">
                {assumption.name}
              </p>
              <WarmthBadge warmth={assumption.warmthState} size="sm" />
            </div>
            <p className="text-xs text-zinc-400">
              Source: <span className="text-zinc-500">{assumption.sourceType}</span>
              {" · "}
              Confidence: {Math.round(assumption.confidenceScore * 100)}%
            </p>
          </div>

          <button
            type="button"
            onClick={() => onRequestClarification?.(assumption.id)}
            className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors"
          >
            Request clarification
          </button>
        </div>
      ))}
    </div>
  );
}
