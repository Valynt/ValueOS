/**
 * ValueModelWorkbench (Journey-Driven)
 *
 * Refactored to use JourneyOrchestrator for phase-based UI instead of static tabs.
 * Supports Journey-Driven Mode Switch and One-Click Hypothesis Promotion.
 */

import { AlertCircle, Lock, Sparkles } from "lucide-react";
import React, { useState, useMemo } from "react";
import { useParams } from "react-router-dom";

import { CanvasHost, SDUIWidget } from "@/components/canvas/CanvasHost";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAcceptHypothesis,
  useAssumptions,
  useHypotheses,
  useRejectHypothesis,
  useScenarios,
  useSensitivity,
} from "@/hooks/useValueModeling";
import {
  useJourneyOrchestrator,
  usePromoteHypothesisToAssumption,
} from "@/hooks/useJourneyOrchestrator";
import type { ArtifactSlot } from "@/hooks/useJourneyOrchestrator";

export function ValueModelWorkbench() {
  const { caseId } = useParams<{ caseId: string }>();
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);

  // Journey orchestration
  const { data: journeyState, isLoading: journeyLoading, error: journeyError } = useJourneyOrchestrator(caseId);

  // Data fetching for widgets
  const { data: hypotheses, isLoading: hypothesesLoading, error: hypothesesError } = useHypotheses(caseId);
  const { data: assumptions, isLoading: assumptionsLoading, error: assumptionsError } = useAssumptions(caseId);
  const { data: scenarios, isLoading: scenariosLoading, error: scenariosError } = useScenarios(caseId);
  const { data: sensitivity, isLoading: sensitivityLoading, error: sensitivityError } = useSensitivity(caseId);

  // Mutations
  const acceptHypothesis = useAcceptHypothesis();
  const rejectHypothesis = useRejectHypothesis();
  const promoteHypothesis = usePromoteHypothesisToAssumption();

  const handleWidgetAction = (widgetId: string, action: string, payload?: unknown) => {
    if (action === "accept") {
      const { hypothesisId } = payload as { hypothesisId: string };
      if (caseId) acceptHypothesis.mutate({ caseId, hypothesisId });
    } else if (action === "reject") {
      const { hypothesisId } = payload as { hypothesisId: string };
      if (caseId) rejectHypothesis.mutate({ caseId, hypothesisId });
    } else if (action === "promote-to-assumption") {
      const { hypothesisId, value, unit, sourceType } = payload as {
        hypothesisId: string;
        value?: number;
        unit?: string;
        sourceType?: string;
      };
      if (caseId) {
        promoteHypothesis.mutate({
          caseId,
          hypothesisId,
          input: {
            value,
            unit,
            sourceType: sourceType as never,
          },
        });
      }
    }
  };

  // Map artifact slots to SDUI widgets based on current data
  const getWidgetForSlot = (slot: ArtifactSlot): SDUIWidget => {
    switch (slot.component) {
      case "hypothesis-cards":
        return {
          id: slot.id,
          componentType: "hypothesis-card",
          props: {
            hypotheses: hypotheses ?? [],
            // Pass journey state to enable phase-specific actions
            canPromote: journeyState?.phase?.supportsBoardReadyLock ?? false,
            phaseId: journeyState?.phase?.id,
          },
        };
      case "assumption-register":
        return {
          id: slot.id,
          componentType: "assumption-register",
          props: { assumptions: assumptions ?? [] },
        };
      case "scenario-comparison":
        return {
          id: slot.id,
          componentType: "scenario-comparison",
          props: { scenarios: scenarios ?? [] },
        };
      case "sensitivity-tornado":
        return {
          id: slot.id,
          componentType: "sensitivity-tornado",
          props: { items: sensitivity?.tornadoData ?? [], baseScenario: sensitivity?.baseScenario },
        };
      default:
        // Fallback: use slot component as-is if registered
        return {
          id: slot.id,
          componentType: slot.component,
          props: { slotId: slot.id },
        };
    }
  };

  // Derive active slots from journey or fallback to default
  const activeSlots: ArtifactSlot[] = useMemo(() => {
    if (journeyState?.phase?.artifactSlots?.length) {
      return journeyState.phase.artifactSlots;
    }
    // Fallback: static slots when journey not available
    return [
      { id: "hypotheses", label: "Hypotheses", component: "hypothesis-cards", region: "center_canvas", panelTitle: "Value Hypotheses", dataSource: "value_hypotheses", refreshOn: [], badgeType: "count" },
      { id: "assumptions", label: "Assumptions", component: "assumption-register", region: "center_canvas", panelTitle: "Assumption Register", dataSource: "assumptions", refreshOn: [], badgeType: "count" },
      { id: "scenarios", label: "Scenarios", component: "scenario-comparison", region: "center_canvas", panelTitle: "Scenario Comparison", dataSource: "scenarios", refreshOn: [], badgeType: "none" },
      { id: "sensitivity", label: "Sensitivity", component: "sensitivity-tornado", region: "center_canvas", panelTitle: "Sensitivity Analysis", dataSource: "sensitivity", refreshOn: [], badgeType: "none" },
    ];
  }, [journeyState]);

  // Group slots by region (simplified: using center_canvas for main content)
  const centerSlots = activeSlots.filter((s) => s.region === "center_canvas");
  const headerSlots = activeSlots.filter((s) => s.region === "header");

  // Determine current active slot (journey-driven or first available)
  const currentSlot = useMemo(() => {
    if (activeSlotId) {
      return centerSlots.find((s) => s.id === activeSlotId) ?? centerSlots[0];
    }
    // Default to first slot, or prioritize based on phase
    const phaseId = journeyState?.phase?.id;
    if (phaseId === "discovery" || phaseId === "analysis") {
      return centerSlots.find((s) => s.id.includes("hypothesis")) ?? centerSlots[0];
    }
    if (phaseId === "modeling" || phaseId === "sensitivity") {
      return centerSlots.find((s) => s.id.includes("scenario") || s.id.includes("sensitivity")) ?? centerSlots[0];
    }
    return centerSlots[0];
  }, [activeSlotId, centerSlots, journeyState]);

  const isLoading = journeyLoading || hypothesesLoading || assumptionsLoading || scenariosLoading || sensitivityLoading;
  const error = journeyError || hypothesesError || assumptionsError || scenariosError || sensitivityError;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Failed to load value model</AlertTitle>
        <AlertDescription>{error?.message || "Unknown error occurred"}</AlertDescription>
      </Alert>
    );
  }

  const currentWidget = currentSlot ? getWidgetForSlot(currentSlot) : null;

  return (
    <div className="h-full flex flex-col">
      {/* Journey Header */}
      <div className="px-6 py-4 border-b bg-card">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">
                {journeyState?.workspaceHeader?.title ?? "Value Model Workbench"}
              </h1>
              {journeyState?.phase && (
                <Badge variant="secondary" className="text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  {journeyState.phase.label}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {journeyState?.phase?.userGoal ?? "Build and refine the economic case for this opportunity"}
            </p>
            {journeyState?.uiState?.label && (
              <p className="text-xs text-muted-foreground mt-1">
                Status: {journeyState.uiState.label}
                {journeyState.uiState.showConfidence && journeyState.workspaceHeader?.confidence_score !== undefined && (
                  <span className="ml-2">• Confidence: {Math.round(journeyState.workspaceHeader.confidence_score * 100)}%</span>
                )}
              </p>
            )}
          </div>
          {journeyState?.phase?.canLock && (
            <Button variant="outline" size="sm" className="gap-1">
              <Lock className="h-4 w-4" />
              Lock as Board-Ready
            </Button>
          )}
        </div>

        {/* Phase Navigation (replaces static tabs) */}
        {centerSlots.length > 1 && (
          <div className="flex gap-1 mt-4">
            {centerSlots.map((slot) => (
              <button
                key={slot.id}
                onClick={() => setActiveSlotId(slot.id)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${currentSlot?.id === slot.id
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
              >
                {slot.label}
                {slot.badgeType === "count" && slot.id === "hypotheses" && hypotheses && hypotheses.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-background rounded-full">
                    {hypotheses.length}
                  </span>
                )}
                {slot.badgeType === "count" && slot.id === "assumptions" && assumptions && assumptions.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-background rounded-full">
                    {assumptions.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 overflow-y-auto">
        {currentWidget ? (
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-muted-foreground">
              {currentSlot?.panelTitle}
            </h2>
            <CanvasHost widgets={[currentWidget]} onWidgetAction={handleWidgetAction} />
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No content available for this phase
          </div>
        )}
      </div>
    </div>
  );
}

export default ValueModelWorkbench;
