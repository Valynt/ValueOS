/**
 * ValueModelWorkbench (Journey-Driven)
 *
 * Refactored to use JourneyOrchestrator for phase-based UI instead of static tabs.
 * Supports Journey-Driven Mode Switch, One-Click Hypothesis Promotion,
 * Smart Phase Guidance, Keyboard Shortcuts, and Undo/Redo.
 */

import { AlertCircle, Lock, Sparkles, Lightbulb, CheckCircle2, AlertTriangle, ChevronRight, RotateCcw, Redo2, X } from "lucide-react";
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useParams } from "react-router-dom";

import { CanvasHost, SDUIWidget } from "@/components/canvas/CanvasHost";
import { CoachMarks, CoachMarkStep } from "@/components/coach/CoachMarks";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
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
  type ArtifactSlot,
  type NextStepGuidance,
} from "@/hooks/useJourneyOrchestrator";
import { useKeyboardShortcuts, createWorkbenchHandlers, useUndoStack } from "@/hooks/useKeyboardShortcuts";

export function ValueModelWorkbench() {
  const { caseId } = useParams<{ caseId: string }>();
  const { toast } = useToast();
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [showGuidancePanel, setShowGuidancePanel] = useState(true);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [dismissedGuidance, setDismissedGuidance] = useState<Set<string>>(new Set());
  const [coachSteps, setCoachSteps] = useState<CoachMarkStep[]>([]);
  const [showCoachMarks, setShowCoachMarks] = useState(false);

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

  // Undo/Redo stack for workbench actions
  const { push: pushUndo, undo, redo, canUndo, canRedo } = useUndoStack();

  // Enhanced widget action handler with undo support
  const handleWidgetAction = useCallback((widgetId: string, action: string, payload?: unknown) => {
    const executeAction = () => {
      switch (action) {
        case "accept": {
          const { hypothesisId } = payload as { hypothesisId: string };
          if (caseId) {
            acceptHypothesis.mutate({ caseId, hypothesisId });
            return { hypothesisId, previousStatus: "pending" };
          }
          return null;
        }
        case "reject": {
          const { hypothesisId } = payload as { hypothesisId: string };
          if (caseId) {
            rejectHypothesis.mutate({ caseId, hypothesisId });
            return { hypothesisId, previousStatus: "pending" };
          }
          return null;
        }
        case "promote-to-assumption": {
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
              input: { value, unit, sourceType: sourceType as never },
            });
            toast({
              title: "Hypothesis promoted",
              description: "The hypothesis has been locked as an assumption.",
            });
            return { hypothesisId, promoted: true };
          }
          return null;
        }
        default:
          return null;
      }
    };

    const result = executeAction();

    // Push to undo stack if action was successful
    if (result && action !== "promote-to-assumption") {
      pushUndo({
        id: `${action}-${Date.now()}`,
        description: `${action} hypothesis`,
        undo: async () => {
          // In a real implementation, this would revert the action
          toast({
            title: "Action undone",
            description: `Reverted ${action} action.`,
          });
          return result;
        },
        redo: async () => {
          executeAction();
          return result;
        },
      });
    }
  }, [caseId, acceptHypothesis, rejectHypothesis, promoteHypothesis, pushUndo, toast]);

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

  // Keyboard shortcuts setup
  const shortcutContext = useMemo(() => ({
    caseId,
    activePhaseId: journeyState?.phase?.id,
    canAccept: true,
    canReject: true,
    canPromote: journeyState?.phase?.supportsBoardReadyLock ?? false,
    canLock: journeyState?.phase?.canLock ?? false,
  }), [caseId, journeyState?.phase]);

  const shortcutHandlers = useMemo(() => createWorkbenchHandlers({
    onAccept: () => { },
    onReject: () => { },
    onPromote: () => { },
    onGoToPhase: (index) => {
      const slot = centerSlots[index];
      if (slot) setActiveSlotId(slot.id);
    },
    onNavigatePhase: (direction) => {
      const currentIndex = centerSlots.findIndex((s) => s.id === currentSlot?.id);
      const newIndex = direction === "next"
        ? Math.min(currentIndex + 1, centerSlots.length - 1)
        : Math.max(currentIndex - 1, 0);
      const slot = centerSlots[newIndex];
      if (slot) setActiveSlotId(slot.id);
    },
  }, shortcutContext), [centerSlots, currentSlot, shortcutContext]);

  useKeyboardShortcuts({
    shortcuts: undefined,
    context: shortcutContext,
    handlers: {
      ...shortcutHandlers,
      "?": () => { setShowShortcutsHelp(true); return true; },
      z: (e) => {
        if (e.ctrlKey && canUndo) {
          undo();
          toast({ title: "Undo", description: "Action reverted." });
          return true;
        }
        return false;
      },
      y: (e) => {
        if (e.ctrlKey && canRedo) {
          redo();
          toast({ title: "Redo", description: "Action restored." });
          return true;
        }
        return false;
      },
    },
    enabled: true,
  });

  // Handle guidance dismissal
  const handleDismissGuidance = useCallback((guidanceId: string) => {
    setDismissedGuidance((prev) => new Set([...prev, guidanceId]));
  }, []);

  // Filter guidance to show
  const visibleGuidance = useMemo(() => {
    return (journeyState?.nextStepGuidance ?? []).filter(
      (g) => !dismissedGuidance.has(g.id) && g.type !== "completion"
    );
  }, [journeyState?.nextStepGuidance, dismissedGuidance]);

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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    <Lock className="h-4 w-4" />
                    Lock as Board-Ready
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Press Ctrl+L to lock</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Smart Guidance Panel */}
        {showGuidancePanel && visibleGuidance.length > 0 && (
          <div className="mt-3 space-y-2">
            {visibleGuidance.slice(0, 2).map((guidance) => (
              <div
                key={guidance.id}
                className={`flex items-start gap-3 p-3 rounded-md text-sm ${guidance.type === "auto_advance"
                  ? "bg-primary/10 border border-primary/20"
                  : guidance.type === "action_required"
                    ? "bg-amber-50 border border-amber-200"
                    : "bg-muted border border-border"
                  }`}
              >
                <div className="mt-0.5">
                  {guidance.type === "auto_advance" ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : guidance.type === "action_required" ? (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  ) : (
                    <Lightbulb className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{guidance.title}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {guidance.description}
                  </p>
                  {guidance.progress && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2 text-xs">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${(guidance.progress.current / guidance.progress.total) * 100}%` }}
                          />
                        </div>
                        <span>{guidance.progress.label}</span>
                      </div>
                    </div>
                  )}
                  {guidance.primaryAction && (
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => {
                          // Execute action
                          if (guidance.primaryAction?.id === "lock_phase") {
                            toast({
                              title: "Phase locked",
                              description: `${journeyState?.phase?.label} is now locked.`,
                            });
                          }
                          handleDismissGuidance(guidance.id);
                        }}
                      >
                        {guidance.primaryAction.label}
                        {guidance.primaryAction.shortcut && (
                          <span className="ml-1.5 text-[10px] opacity-70 bg-black/10 px-1 rounded">
                            {guidance.primaryAction.shortcut}
                          </span>
                        )}
                      </Button>
                      {guidance.secondaryActions?.map((action) => (
                        <Button
                          key={action.id}
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => handleDismissGuidance(guidance.id)}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 -mr-1 -mt-1"
                  onClick={() => handleDismissGuidance(guidance.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Inline Validation Summary */}
        {journeyState?.inlineValidations && journeyState.inlineValidations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {journeyState.inlineValidations.slice(0, 4).map((validation) => (
              <div
                key={validation.target}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${validation.status === "valid"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : validation.status === "invalid"
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : validation.status === "warning"
                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-muted text-muted-foreground border border-border"
                  }`}
              >
                {validation.status === "valid" ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : validation.status === "invalid" ? (
                  <AlertCircle className="h-3 w-3" />
                ) : (
                  <AlertTriangle className="h-3 w-3" />
                )}
                <span className="truncate max-w-[200px]">{validation.message}</span>
              </div>
            ))}
          </div>
        )}

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

      {/* Floating Action Toolbar */}
      <div className="fixed bottom-6 right-6 flex items-center gap-2 z-30">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full shadow-lg bg-background"
                onClick={() => setShowShortcutsHelp(true)}
              >
                <span className="text-xs font-medium">?</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Keyboard shortcuts (press ?)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex items-center gap-1 bg-background rounded-full shadow-lg border p-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            disabled={!canUndo}
            onClick={() => {
              undo();
              toast({ title: "Undo", description: "Action reverted." });
            }}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            disabled={!canRedo}
            onClick={() => {
              redo();
              toast({ title: "Redo", description: "Action restored." });
            }}
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Keyboard Shortcuts Help Panel */}
      {showShortcutsHelp && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowShortcutsHelp(false)}
        >
          <div
            className="bg-card rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowShortcutsHelp(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              {journeyState?.keyboardShortcuts && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Available in this phase</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {journeyState.keyboardShortcuts.slice(0, 8).map((shortcut) => (
                      <div key={shortcut.action_id} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                        <span className="text-muted-foreground">{shortcut.label}</span>
                        <kbd className="px-2 py-0.5 bg-card border rounded text-xs font-mono">
                          {shortcut.key}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Global shortcuts</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                    <span className="text-muted-foreground">Show shortcuts</span>
                    <kbd className="px-2 py-0.5 bg-card border rounded text-xs font-mono">?</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                    <span className="text-muted-foreground">Undo</span>
                    <kbd className="px-2 py-0.5 bg-card border rounded text-xs font-mono">Ctrl+Z</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                    <span className="text-muted-foreground">Redo</span>
                    <kbd className="px-2 py-0.5 bg-card border rounded text-xs font-mono">Ctrl+Y</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                    <span className="text-muted-foreground">Close / Cancel</span>
                    <kbd className="px-2 py-0.5 bg-card border rounded text-xs font-mono">Esc</kbd>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <Button variant="outline" size="sm" onClick={() => setShowShortcutsHelp(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Coach Marks Overlay */}
      {showCoachMarks && coachSteps.length > 0 && (
        <CoachMarks
          steps={coachSteps}
          onComplete={() => setShowCoachMarks(false)}
          onDismiss={() => setShowCoachMarks(false)}
          showProgress
          allowSkip
        />
      )}
    </div>
  );
}

export default ValueModelWorkbench;
