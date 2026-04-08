/**
 * ReviewPage — Executive Reviewer Surface (/review/:caseId)
 *
 * A first-class surface for executive buyers. Mobile-first, no sidebar,
 * focused on trust signals, confidence breakdown, and approval workflow.
 */

import { ArrowLeft, BarChart3 } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { WarmthBadge } from "@/components/warmth/WarmthBadge";
import { useCase } from "@/hooks/useCases";
import { useJourneyOrchestrator } from "@/hooks/useJourneyOrchestrator";
import { useAssumptions } from "@/hooks/useValueModeling";
import type { Assumption } from "@/hooks/useValueModeling";
import { deriveWarmth } from "@/lib/warmth";
import type { WarmthState } from "@/lib/warmth";
import { cn } from "@/lib/utils";

import { ApprovalActions } from "./components/ApprovalActions";
import { AssumptionsAtRisk } from "./components/AssumptionsAtRisk";
import type { ReviewAssumption } from "./components/AssumptionsAtRisk";

function confidenceToWarmth(score: number): WarmthState {
  if (score >= 0.8) return "verified";
  if (score >= 0.6) return "firm";
  return "forming";
}

function mapAssumptionsToReview(assumptions: Assumption[]): ReviewAssumption[] {
  return assumptions.map((a) => ({
    id: a.id,
    name: a.name,
    confidenceScore: a.confidenceScore,
    sourceType: a.source,
    warmthState: confidenceToWarmth(a.confidenceScore),
  }));
}

function stageToSagaState(stage: string | null): string {
  const s = stage?.toLowerCase() ?? "";
  if (s.includes("discovery")) return "INITIATED";
  if (s.includes("target")) return "VALIDATING";
  if (s.includes("narrat")) return "REFINING";
  return "INITIATED";
}

function formatValue(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

export function ReviewPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const { data: caseData, isLoading: caseLoading } = useCase(caseId);
  const { data: journey, isLoading: journeyLoading } = useJourneyOrchestrator(caseId);
  const { data: rawAssumptions } = useAssumptions(caseId);

  const isLoading = caseLoading || journeyLoading;
  const reviewAssumptions = mapAssumptionsToReview(rawAssumptions ?? []);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6" data-skeleton="true">
          <div className="h-6 w-32 bg-zinc-200 rounded" />
          <div className="h-40 bg-zinc-100 rounded-2xl" />
          <div className="h-24 bg-zinc-100 rounded-2xl" />
          <div className="h-12 bg-zinc-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-sm text-zinc-500">Case not found</p>
      </div>
    );
  }

  const meta = caseData.metadata as Record<string, unknown> | null;
  const projectedValue = typeof meta?.projected_value === "number" ? meta.projected_value : 0;
  const sagaState = stageToSagaState(caseData.stage);
  const warmthResult = deriveWarmth(sagaState, caseData.quality_score);
  const companyName = caseData.company_profiles?.company_name ?? caseData.name;
  const confidencePercent = Math.round((caseData.quality_score ?? 0) * 100);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/work/cases"
          className="p-2 rounded-lg hover:bg-zinc-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-zinc-900">{companyName}</h1>
          <p className="text-xs text-zinc-400">Value Case Review</p>
        </div>
        <WarmthBadge warmth={warmthResult.state} modifier={warmthResult.modifier} showLabel size="md" />
      </div>

      {/* Executive Summary */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 mb-4">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">
          Executive Summary
        </h2>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-zinc-400">Projected Value</p>
            <p className="text-2xl font-black text-zinc-950 tracking-tight">
              {formatValue(projectedValue)}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">Confidence</p>
            <p className="text-2xl font-black text-zinc-950 tracking-tight">
              {confidencePercent}%
            </p>
          </div>
        </div>

        {journey?.workspaceHeader && (
          <p className="text-sm text-zinc-600">
            {journey.workspaceHeader.phase_label} — {journey.uiState?.label}
          </p>
        )}
      </section>

      {/* Assumptions at Risk */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 mb-4">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">
          Assumptions Requiring Attention
        </h2>
        <AssumptionsAtRisk
          assumptions={reviewAssumptions}
          threshold={0.6}
        />
      </section>

      {/* Value Projection placeholder */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">
            Value Projection
          </h2>
        </div>
        <div className="h-32 flex items-center justify-center text-xs text-zinc-400 bg-zinc-50 rounded-xl">
          Chart placeholder — actuals vs. projections
        </div>
      </section>

      {/* Approval Actions */}
      <ApprovalActions
        caseId={caseId ?? ""}
        warmth={warmthResult.state}
        canApprove={true}
        onApprove={() => { }}
        onRequestChanges={() => { }}
        onExport={() => { }}
      />
    </div>
  );
}
