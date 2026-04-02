/**
 * ValueCaseWorkspace
 *
 * Sprint 5 integration: connects SDUI CanvasHost, useCanvasState (artifact
 * persistence), and useAgentOrchestrator into a single routable view.
 *
 * Widget layout is driven by an SDUIWidget[] descriptor so the backend can
 * push new layouts without a frontend deploy.
 *
 * Enhanced with PipelineStepper, PipelineProgressBar, and AgentInsightCard
 * for real-time 7-step pipeline visualization driven by SSE LoopProgress events.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { CanvasHost, type SDUIWidget } from "@/components/canvas";
import { AgentInsightCard } from "@/components/orchestration/AgentInsightCard";
import { AgentStatusIndicator } from "@/components/orchestration/AgentStatusIndicator";
import { PipelineCompletionSummary } from "@/components/orchestration/PipelineCompletionSummary";
import { PipelineProgressBar } from "@/components/orchestration/PipelineProgressBar";
import { PipelineStepper } from "@/components/orchestration/PipelineStepper";
import { useTenant } from "@/contexts/TenantContext";
import { useAgentOrchestrator } from "@/hooks/useAgentOrchestrator";
import { useCanvasState } from "@/hooks/useCanvasState";
import { useValueCaseStream } from "@/hooks/useValueCaseStream";

/**
 * Default widget layout when no server-driven layout is available.
 * Each entry maps to a registered CanvasHost widget type.
 */
function buildDefaultWidgets(
  isProcessing: boolean,
  currentStep: string,
): SDUIWidget[] {
  return [
    {
      id: "ws-agent-response",
      componentType: "agent-response",
      props: {
        agentName: "Value Intelligence Agent",
        status: isProcessing ? currentStep : "Awaiting input",
        summary:
          "Submit a query to begin value analysis for this case.",
        valueDrivers: [],
      },
    },
    {
      id: "ws-chat-input",
      componentType: "chat-input",
      props: {
        placeholder: "Describe the value scenario to analyze...",
        disabled: isProcessing,
      },
    },
  ];
}

export function ValueCaseWorkspace() {
  const { caseId } = useParams<{ caseId: string }>();
  const { currentTenant } = useTenant();

  // Canvas state (artifact persistence + undo/redo)
  const {
    assumptions,
    isDirty,
    calculateMetrics,
    commit,
  } = useCanvasState();

  // Agent orchestration
  const {
    state: agentState,
    context: agentContext,
    thoughts,
    isProcessing,
    submitQuery,
  } = useAgentOrchestrator({
    onStateChange: () => {
      // Recalculate metrics when agent finishes
      calculateMetrics();
    },
  });

  // Real-time pipeline stream (SSE)
  const {
    pipeline,
    connect: connectStream,
    progress,
    activeStep,
  } = useValueCaseStream({
    onComplete: () => calculateMetrics(),
  });

  const hasPipelineActivity = pipeline.steps.some((s) => s.status !== "pending");

  // Recalculate on assumption changes
  useEffect(() => {
    calculateMetrics();
  }, [assumptions, calculateMetrics]);

  // Server-driven widget layout (future: fetch from API)
  const [serverWidgets, setServerWidgets] = useState<SDUIWidget[] | null>(null);

  const widgets = useMemo(() => {
    if (serverWidgets) return serverWidgets;
    return buildDefaultWidgets(isProcessing, agentContext.currentStep);
  }, [serverWidgets, isProcessing, agentContext.currentStep]);

  // Handle widget actions (chat submit, button clicks, etc.)
  const handleWidgetAction = useCallback(
    (widgetId: string, action: string, payload?: unknown) => {
      if (widgetId === "ws-chat-input" && action === "submit") {
        const msg = (payload as { message?: string })?.message;
        if (msg) {
          submitQuery(msg);
        }
      }
    },
    [submitQuery],
  );

  // Auto-commit when dirty and agent finishes
  useEffect(() => {
    if (isDirty && agentState === "IDLE") {
      commit();
    }
  }, [isDirty, agentState, commit]);

  return (
    <div className="flex flex-col h-full">
      {/* ── Pipeline progress header ── */}
      {(isProcessing || hasPipelineActivity) && (
        <div className="border-b border-zinc-200 bg-white">
          {/* Compact progress bar at the very top */}
          {pipeline.isRunning && (
            <PipelineProgressBar
              progress={progress}
              isRunning={pipeline.isRunning}
              label={activeStep?.message}
              className="px-6 pt-3 pb-1"
            />
          )}

          {/* 7-step pipeline stepper */}
          <div className="px-6 py-4 overflow-x-auto">
            <PipelineStepper
              steps={pipeline.steps}
              revisionCycle={pipeline.revisionCycle}
              maxRevisionCycles={pipeline.maxRevisionCycles}
            />
          </div>

          {/* Error banner */}
          {pipeline.error && (
            <div className="mx-6 mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
              {pipeline.error}
            </div>
          )}
        </div>
      )}

      {/* ── Fallback: legacy agent status pill ── */}
      {isProcessing && !hasPipelineActivity && (
        <div className="border-b border-zinc-200 bg-zinc-50 px-6 py-2">
          <AgentStatusIndicator
            state={agentState}
            currentStep={agentContext.currentStep}
          />
        </div>
      )}

      {/* ── Thought stream ── */}
      {thoughts.length > 0 && (
        <div className="border-b border-zinc-200 bg-zinc-50/50 px-6 py-3">
          <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide mb-1">
            Agent Thoughts
          </p>
          <div className="space-y-0.5 font-mono text-xs text-zinc-500 max-h-24 overflow-y-auto">
            {thoughts.slice(-5).map((t) => (
              <div key={t.id} className="flex items-start gap-2">
                <span className="text-zinc-900 font-medium">[{t.type}]</span>
                <span>{t.content}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Pipeline completion summary */}
          {pipeline.isComplete && (
            <PipelineCompletionSummary pipeline={pipeline} />
          )}

          {/* Agent insight cards — one per completed/running step */}
          {hasPipelineActivity && (
            <div className="space-y-2">
              {pipeline.steps
                .filter((s) => s.status !== "pending")
                .map((s) => (
                  <AgentInsightCard key={`${s.step}-${pipeline.revisionCycle}`} step={s} />
                ))}
            </div>
          )}

          {/* SDUI Canvas */}
          {caseId ? (
            <CanvasHost
              widgets={widgets}
              onWidgetAction={handleWidgetAction}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-400 text-sm">
              Select or create a value case to begin.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ValueCaseWorkspace;
