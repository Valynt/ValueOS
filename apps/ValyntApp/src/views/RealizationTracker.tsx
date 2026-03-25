/**
 * RealizationTracker
 *
 * Page view for post-sale realization: KPI targets, checkpoint timeline, handoff notes.
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §5.5
 */

import { AlertCircle, Calendar, FileText, Target } from "lucide-react";
import React from "react";
import { useParams } from "react-router-dom";

import { CanvasHost, SDUIWidget } from "@/components/canvas/CanvasHost";
import { EmptyState } from "@/components/common/EmptyState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useBaseline, useCheckpoints } from "@/hooks/useRealization";
import { useI18n } from "@/i18n/I18nProvider";

export function RealizationTracker() {
  const { caseId } = useParams<{ caseId: string }>();
  const { t } = useI18n();

  const { data: baseline, isLoading: baselineLoading, error: baselineError } = useBaseline(caseId);
  const { data: checkpoints, isLoading: checkpointsLoading, error: checkpointsError } = useCheckpoints(caseId);

  const isLoading = baselineLoading || checkpointsLoading;
  const error = baselineError || checkpointsError;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t("realization.loadFailed")}</AlertTitle>
        <AlertDescription>{error?.message || t("errors.generic")}</AlertDescription>
      </Alert>
    );
  }

  if (!baseline && !isLoading) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <EmptyState
          title={t("realization.noData")}
          description={t("realization.noDataDescription")}
        />
      </div>
    );
  }

  const kpiWidget: SDUIWidget = {
    id: "kpi-targets",
    componentType: "kpi-target-card",
    props: { targets: baseline?.kpiTargets ?? [] },
  };

  const checkpointWidget: SDUIWidget = {
    id: "checkpoint-timeline",
    componentType: "checkpoint-timeline",
    props: {
      checkpoints: checkpoints ?? [],
      metricName: "Value Realization",
      unit: "$",
    },
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b bg-card">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Realization Tracker</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track post-sale value delivery and outcomes
            </p>
          </div>
          {baseline && (
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Baseline Scenario</p>
              <p className="font-semibold">{baseline.scenarioName}</p>
              <p className="text-xs text-muted-foreground">
                Approved {baseline.approvalDate ? new Date(baseline.approvalDate).toLocaleDateString() : "N/A"}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* KPI Targets */}
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <h2 className="font-semibold text-lg">KPI Targets</h2>
            </div>
            <CanvasHost widgets={[kpiWidget]} />
          </div>

          {/* Checkpoint Timeline */}
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <h2 className="font-semibold text-lg">Checkpoint Timeline</h2>
            </div>
            <CanvasHost widgets={[checkpointWidget]} />
          </div>

          {/* Assumptions (read-only) */}
          {baseline?.assumptions && baseline.assumptions.length > 0 && (
            <div className="rounded-xl border bg-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <h2 className="font-semibold text-lg">Baseline Assumptions</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {baseline.assumptions.map((assumption) => (
                  <div key={assumption.id} className="p-4 border rounded-lg bg-muted/30">
                    <p className="font-medium text-sm">{assumption.name}</p>
                    <p className="text-lg font-semibold mt-1">
                      {assumption.value} {assumption.unit}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Source: {assumption.source}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Handoff Notes */}
          {baseline?.handoffNotes && (
            <div className="rounded-xl border bg-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <h2 className="font-semibold text-lg">Handoff Notes</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium text-sm text-muted-foreground mb-2">Deal Context</h3>
                  <p className="text-sm">{baseline.handoffNotes.dealContext || "N/A"}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium text-sm text-muted-foreground mb-2">
                    Buyer Priorities
                  </h3>
                  <p className="text-sm">{baseline.handoffNotes.buyerPriorities || "N/A"}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium text-sm text-muted-foreground mb-2">
                    Implementation Assumptions
                  </h3>
                  <p className="text-sm">
                    {baseline.handoffNotes.implementationAssumptions || "N/A"}
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium text-sm text-muted-foreground mb-2">Key Risks</h3>
                  <p className="text-sm">{baseline.handoffNotes.keyRisks || "N/A"}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RealizationTracker;
