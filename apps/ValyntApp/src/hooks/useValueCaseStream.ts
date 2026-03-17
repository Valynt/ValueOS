/**
 * useValueCaseStream
 *
 * Real-time SSE connection to the HypothesisLoop backend.
 * Receives enriched LoopProgress events and maintains pipeline state
 * for the PipelineStepper and AgentInsightCard components.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { getApiBaseUrl } from "@/lib/env";

// ---------------------------------------------------------------------------
// Types — mirrors backend LoopProgress
// ---------------------------------------------------------------------------

export type PipelineStepStatus = "pending" | "running" | "completed" | "failed";

export interface PipelineStepState {
  step: number;
  stepName: string;
  status: PipelineStepStatus;
  message?: string;
  agentName?: string;
  confidence?: number;
  durationMs?: number;
  partialResult?: {
    itemCount?: number;
    totalValue?: number;
    highlights?: string[];
  };
}

export interface PipelineState {
  /** All 7 steps with their current status. */
  steps: PipelineStepState[];
  /** Current revision cycle (0 = first pass). */
  revisionCycle: number;
  /** Max allowed revision cycles. */
  maxRevisionCycles: number;
  /** Whether the pipeline is actively running. */
  isRunning: boolean;
  /** Whether the pipeline completed successfully. */
  isComplete: boolean;
  /** Error message if the pipeline failed. */
  error: string | null;
  /** Timestamp of the last received event. */
  lastEventAt: string | null;
}

const STEP_NAMES = [
  "Hypothesis",
  "Model",
  "Evidence",
  "Narrative",
  "Objection",
  "Revision",
  "Approval",
] as const;

function buildInitialSteps(): PipelineStepState[] {
  return STEP_NAMES.map((name, i) => ({
    step: i + 1,
    stepName: name,
    status: "pending" as const,
  }));
}

const INITIAL_STATE: PipelineState = {
  steps: buildInitialSteps(),
  revisionCycle: 0,
  maxRevisionCycles: 3,
  isRunning: false,
  isComplete: false,
  error: null,
  lastEventAt: null,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseValueCaseStreamOptions {
  /** Callback fired on each progress event. */
  onProgress?: (step: PipelineStepState) => void;
  /** Callback fired when the pipeline completes. */
  onComplete?: () => void;
  /** Callback fired on error. */
  onError?: (error: string) => void;
}

export interface UseValueCaseStreamReturn {
  pipeline: PipelineState;
  /** Start streaming for a given job ID. */
  connect: (jobId: string) => void;
  /** Stop the SSE connection. */
  disconnect: () => void;
  /** Reset pipeline to initial state. */
  reset: () => void;
  /** The currently active step (first running step, or last completed). */
  activeStep: PipelineStepState | null;
  /** Overall progress as a 0–1 fraction. */
  progress: number;
}

export function useValueCaseStream(
  options: UseValueCaseStreamOptions = {},
): UseValueCaseStreamReturn {
  const { onProgress, onComplete, onError } = options;

  const [pipeline, setPipeline] = useState<PipelineState>(INITIAL_STATE);
  const eventSourceRef = useRef<EventSource | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    disconnect();
    setPipeline(INITIAL_STATE);
  }, [disconnect]);

  const connect = useCallback(
    (jobId: string) => {
      disconnect();

      const baseUrl = getApiBaseUrl();
      const url = `${baseUrl}/agents/jobs/${encodeURIComponent(jobId)}/stream`;

      setPipeline((prev) => ({
        ...prev,
        steps: buildInitialSteps(),
        isRunning: true,
        isComplete: false,
        error: null,
      }));

      const source = new EventSource(url, { withCredentials: true });
      eventSourceRef.current = source;

      source.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as Record<string, unknown>;

          // Handle progress events from the HypothesisLoop
          if (typeof data.step === "number" && typeof data.stepName === "string") {
            const stepUpdate: PipelineStepState = {
              step: data.step as number,
              stepName: data.stepName as string,
              status: (data.status as PipelineStepStatus) ?? "running",
              message: data.message as string | undefined,
              agentName: data.agentName as string | undefined,
              confidence: data.confidence as number | undefined,
              durationMs: data.durationMs as number | undefined,
              partialResult: data.partialResult as PipelineStepState["partialResult"],
            };

            setPipeline((prev) => {
              const newSteps = prev.steps.map((s) =>
                s.step === stepUpdate.step ? { ...s, ...stepUpdate } : s,
              );

              const isComplete =
                stepUpdate.step === 7 && stepUpdate.status === "completed";

              return {
                ...prev,
                steps: newSteps,
                revisionCycle: (data.revisionCycle as number) ?? prev.revisionCycle,
                maxRevisionCycles:
                  (data.maxRevisionCycles as number) ?? prev.maxRevisionCycles,
                isRunning: !isComplete,
                isComplete,
                lastEventAt: data.timestamp as string,
              };
            });

            optionsRef.current.onProgress?.(stepUpdate);

            if (stepUpdate.step === 7 && stepUpdate.status === "completed") {
              optionsRef.current.onComplete?.();
              source.close();
            }
          }

          // Handle terminal status events from the job stream
          if (data.status === "completed" || data.status === "error") {
            if (data.status === "error") {
              const errorMsg =
                (data.message as string) ?? "Pipeline failed unexpectedly";
              setPipeline((prev) => ({
                ...prev,
                isRunning: false,
                error: errorMsg,
              }));
              optionsRef.current.onError?.(errorMsg);
            }
            source.close();
          }
        } catch {
          // Ignore malformed events
        }
      };

      source.onerror = () => {
        setPipeline((prev) => {
          // If already complete, this is just the connection closing
          if (prev.isComplete) return prev;
          return {
            ...prev,
            isRunning: false,
            error: "Connection lost. The pipeline may still be running.",
          };
        });
        source.close();
      };
    },
    [disconnect],
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  // Derived state
  const activeStep =
    pipeline.steps.find((s) => s.status === "running") ??
    [...pipeline.steps].reverse().find((s) => s.status === "completed") ??
    null;

  const completedCount = pipeline.steps.filter(
    (s) => s.status === "completed",
  ).length;
  const progress = completedCount / 7;

  return {
    pipeline,
    connect,
    disconnect,
    reset,
    activeStep,
    progress,
  };
}
