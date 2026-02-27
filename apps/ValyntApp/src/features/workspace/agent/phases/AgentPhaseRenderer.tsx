/**
 * AgentPhaseRenderer — Renders the correct phase UI based on the current agent state.
 * Reads from the Zustand agent store and delegates to individual phase components.
 * Error overlay is rendered on top of the current phase when an error is present.
 */

import React, { useCallback, useMemo } from "react";

import { cn } from "@/lib/utils";

import { selectArtifacts, useAgentStore } from "../store";
import { useAgentPhase } from "../useAgentPhase";
import { ClarifyPhase } from "./ClarifyPhase";
import { ErrorOverlay } from "./ErrorOverlay";
import { ExecutePhase } from "./ExecutePhase";
import { FinalizePhase } from "./FinalizePhase";
import { IdlePhase } from "./IdlePhase";
import { PlanPhase } from "./PlanPhase";
import { ResumePhase } from "./ResumePhase";
import { ReviewPhase } from "./ReviewPhase";

interface AgentPhaseRendererProps {
  /** Called when user submits a message (idle or clarify) */
  onSendMessage: (message: string) => void;
  /** Called when user wants to export */
  onExport?: () => void;
  className?: string;
}

export function AgentPhaseRenderer({
  onSendMessage,
  onExport,
  className,
}: AgentPhaseRendererProps) {
  const { phase, hasError, transition } = useAgentPhase();

  // Store selectors
  const pendingQuestion = useAgentStore((s) => s.pendingQuestion);
  const steps = useAgentStore((s) => s.steps);
  const assumptions = useAgentStore((s) => s.assumptions);
  const progress = useAgentStore((s) => {
    if (s.steps.length === 0) return 0;
    const completed = s.steps.filter((st) => st.status === "completed").length;
    const running = s.steps.find((st) => st.status === "running");
    const runningProgress = running?.progress ?? 0;
    return Math.round(((completed + runningProgress / 100) / s.steps.length) * 100);
  });
  const streamingContent = useAgentStore((s) => s.streamingContent);
  const artifactsRecord = useAgentStore(selectArtifacts);
  const error = useAgentStore((s) => s.error);
  const checkpoints = useAgentStore((s) => s.checkpoints);
  const messages = useAgentStore((s) => s.messages);

  // Derived
  const artifactList = useMemo(
    () => Object.values(artifactsRecord),
    [artifactsRecord]
  );

  // Actions
  const approvePlan = useAgentStore((s) => s.approvePlan);
  const rejectPlan = useAgentStore((s) => s.rejectPlan);
  const updateAssumption = useAgentStore((s) => s.updateAssumption);
  const approveArtifact = useAgentStore((s) => s.approveArtifact);
  const rejectArtifact = useAgentStore((s) => s.rejectArtifact);
  const cancelRun = useAgentStore((s) => s.cancelRun);
  const reset = useAgentStore((s) => s.reset);
  const selectOption = useAgentStore((s) => s.selectOption);

  const handleApproveAll = useCallback(() => {
    artifactList.forEach((a) => {
      if (a.status === "proposed" || a.status === "draft") {
        approveArtifact(a.id);
      }
    });
    transition("APPROVED");
  }, [artifactList, approveArtifact, transition]);

  const handleRequestRevision = useCallback(() => {
    transition("REVISION_NEEDED");
  }, [transition]);

  const handleFinalize = useCallback(() => {
    transition("FINALIZED");
  }, [transition]);

  const handleRetry = useCallback(() => {
    // Clear error and stay in current phase
    useAgentStore.setState({ error: null });
  }, []);

  const handleReset = useCallback(() => {
    reset();
  }, [reset]);

  return (
    <div className={cn("relative", className)}>
      {/* Phase-specific UI */}
      {phase === "idle" && (
        <IdlePhase onSubmit={onSendMessage} />
      )}

      {phase === "clarify" && pendingQuestion && (
        <ClarifyPhase
          question={pendingQuestion.question}
          options={pendingQuestion.options}
          defaultOption={pendingQuestion.defaultOption}
          allowFreeform={pendingQuestion.allowFreeform}
          onSelectOption={selectOption}
          onSubmitFreeform={onSendMessage}
        />
      )}

      {phase === "plan" && (
        <PlanPhase
          steps={steps}
          assumptions={assumptions}
          onApprove={approvePlan}
          onReject={rejectPlan}
          onUpdateAssumption={updateAssumption}
        />
      )}

      {phase === "execute" && (
        <ExecutePhase
          steps={steps}
          progress={progress}
          streamingContent={streamingContent || undefined}
          onCancel={cancelRun}
        />
      )}

      {phase === "review" && (
        <ReviewPhase
          artifacts={artifactList}
          onApproveArtifact={approveArtifact}
          onRejectArtifact={rejectArtifact}
          onApproveAll={handleApproveAll}
          onRequestRevision={handleRequestRevision}
        />
      )}

      {phase === "finalize" && (
        <FinalizePhase
          artifacts={artifactList}
          onFinalize={handleFinalize}
          onExport={onExport}
        />
      )}

      {phase === "resume" && (
        <ResumePhase
          messageCount={messages.length}
          artifactCount={artifactList.length}
          progress={checkpoints.length > 0 ? 100 : 50}
        />
      )}

      {/* Error overlay — rendered on top of any phase */}
      {hasError && error && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-start justify-center pt-8 z-10">
          <div className="w-full max-w-md">
            <ErrorOverlay
              code={error.code}
              message={error.message}
              recoverable={error.recoverable}
              suggestions={error.suggestions}
              onRetry={handleRetry}
              onReset={handleReset}
            />
          </div>
        </div>
      )}
    </div>
  );
}
