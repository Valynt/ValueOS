/**
 * DealAssemblyWorkspace
 *
 * Page view for deal assembly stage: stakeholder map, gap resolution, source summary.
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §5.1
 */

import { AlertCircle, ArrowRight, CheckCircle2, RefreshCw } from "lucide-react";
import React from "react";
import { useNavigate, useParams } from "react-router-dom";

import { CanvasHost, SDUIWidget } from "@/components/canvas/CanvasHost";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useDealContext, useSubmitGapFill, useTriggerAssembly } from "@/hooks/useDealAssembly";

export function DealAssemblyWorkspace() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const { data: dealContext, isLoading, error } = useDealContext(caseId);
  const submitGapFill = useSubmitGapFill(caseId);
  const triggerAssembly = useTriggerAssembly(caseId);

  const handleWidgetAction = (widgetId: string, action: string, payload?: unknown) => {
    if (action === "submitGap") {
      const { gapId, value } = payload as { gapId: string; value: string };
      submitGapFill.mutate({ gapId, value });
    }
  };

  const handleTriggerAssembly = () => {
    triggerAssembly.mutate();
  };

  const handleProceedToModeling = () => {
    if (caseId) {
      navigate(`/workspace/${caseId}/model`);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !dealContext) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Failed to load deal context</AlertTitle>
        <AlertDescription>{error?.message || "Unknown error occurred"}</AlertDescription>
      </Alert>
    );
  }

  // Build SDUI widgets from deal context
  const widgets: SDUIWidget[] = [
    {
      id: "stakeholder-map",
      componentType: "stakeholder-map",
      props: { stakeholders: dealContext.stakeholders },
    },
    {
      id: "gap-resolution",
      componentType: "gap-resolution",
      props: { gaps: dealContext.gaps, caseId },
    },
  ];

  const allGapsResolved = dealContext.gaps.every((g) => g.resolved);
  const resolvedCount = dealContext.gaps.filter((g) => g.resolved).length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-card">
        <div>
          <h1 className="text-xl font-semibold">{dealContext.accountName}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${dealContext.assemblyStatus === "confirmed"
                ? "bg-green-100 text-green-800"
                : dealContext.assemblyStatus === "assembling"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-amber-100 text-amber-800"
                }`}
            >
              {dealContext.assemblyStatus.replace("-", " ")}
            </span>
            <span className="text-sm text-muted-foreground">
              {resolvedCount} of {dealContext.gaps.length} gaps resolved
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTriggerAssembly}
            disabled={triggerAssembly.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${triggerAssembly.isPending ? "animate-spin" : ""}`} />
            Re-assemble
          </button>

          <button
            onClick={handleProceedToModeling}
            disabled={!allGapsResolved}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Confirm & Proceed
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          {/* Progress indicator */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Assembly Progress</span>
              <span className="font-medium">
                {Math.round((resolvedCount / Math.max(dealContext.gaps.length, 1)) * 100)}%
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{
                  width: `${(resolvedCount / Math.max(dealContext.gaps.length, 1)) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Widgets */}
          <CanvasHost widgets={widgets} onWidgetAction={handleWidgetAction} />

          {/* Success state */}
          {allGapsResolved && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <p className="text-green-800">
                All gaps resolved! The deal context is ready for value modeling.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DealAssemblyWorkspace;
