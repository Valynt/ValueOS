/**
 * Agent State Store
 *
 * Client-side state management for agent interactions.
 * Uses Zustand for reactive state.
 */

import { create } from "zustand";
import { createIntegrityValidationService } from "@services/IntegrityValidationService";
import {
  ValidationLevel,
  ContentType,
} from "@services/IntegrityValidationService";
import type {
  AgentPhase,
  AgentEvent,
  Artifact,
  ConversationMessage,
  WorkflowStepState,
  PlanAssumption,
  ClarifyOption,
} from "./types";
import {
  transition,
  buildTransitionContext,
  type AgentAction,
} from "./state-machine";
import { logger } from "../../../lib/logger";

/**
 * Map incoming phase_changed targets to state machine events.
 * This bridges the backend event model with the validated transition table.
 */
function phaseToTransitionEvent(from: AgentPhase, to: AgentPhase): AgentTransitionEvent | null {
  const key = `${from}:${to}`;
  const mapping: Record<string, AgentTransitionEvent> = {
    "idle:clarify": "START",
    "idle:plan": "PLAN_READY",
    "idle:resume": "RESUME_SESSION",
    "clarify:plan": "CLARIFIED",
    "plan:execute": "PLAN_APPROVED",
    "plan:idle": "PLAN_REJECTED",
    "plan:clarify": "NEED_CLARIFICATION",
    "execute:review": "EXECUTION_DONE",
    "execute:clarify": "NEED_INPUT",
    "execute:plan": "PLAN_READY",
    "review:finalize": "APPROVED",
    "review:plan": "REVISION_NEEDED",
    "finalize:idle": "FINALIZED",
    "resume:idle": "SESSION_RESTORED",
    "resume:plan": "PLAN_READY",
    "resume:execute": "PLAN_APPROVED",
  };
  return mapping[key] ?? null;
}

/**
 * Attempt a validated phase transition. Falls back to direct assignment
 * if no mapping exists (for backward compatibility during migration).
 */
function safeTransition(currentPhase: AgentPhase, targetPhase: AgentPhase): AgentPhase {
  const event = phaseToTransitionEvent(currentPhase, targetPhase);
  if (event) {
    const resolved = resolveTransition(currentPhase, event);
    if (resolved) return resolved;
  }
  // Fallback: allow the transition but log a warning in dev
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      `[AgentStore] Unvalidated phase transition: ${currentPhase} → ${targetPhase}`
    );
  }
  return targetPhase;
}

export interface AgentState {
  // Current phase
  phase: AgentPhase;
  previousPhase: AgentPhase | null;

  // Active run
  runId: string | null;
  isStreaming: boolean;

  // Conversation
  messages: ConversationMessage[];
  streamingMessageId: string | null;
  streamingContent: string;

  // Plan state
  planId: string | null;
  steps: WorkflowStepState[];
  assumptions: PlanAssumption[];

  // Clarification state
  pendingQuestion: {
    questionId: string;
    question: string;
    options?: ClarifyOption[];
    defaultOption?: string;
    allowFreeform: boolean;
  } | null;

  // Artifacts
  artifacts: Record<string, Artifact>;
  activeArtifactId: string | null;

  // Checkpoints (for undo/restore)
  checkpoints: Array<{
    id: string;
    label: string;
    timestamp: number;
    canRestore: boolean;
  }>;

  // Undo/Redo history
  history: AgentState[];
  historyIndex: number;

  // Error state
  error: {
    code: string;
    message: string;
    recoverable: boolean;
    suggestions?: string[];
  } | null;
}

export interface AgentActions {
  // State machine transition (preferred over direct phase mutation)
  tryTransition: (action: AgentAction) => boolean;

  // Event processing
  processEvent: (event: AgentEvent) => void;

  // User actions
  sendMessage: (content: string) => void;
  selectOption: (optionId: string) => void;
  approvePlan: () => void;
  rejectPlan: () => void;
  updateAssumption: (id: string, value: string | number) => void;
  approveArtifact: (artifactId: string) => void;
  rejectArtifact: (artifactId: string) => void;
  selectArtifact: (artifactId: string | null) => void;
  restoreCheckpoint: (checkpointId: string) => void;
  dismissError: () => void;
  retryFromError: () => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  saveSnapshot: () => void;

  // Control
  startRun: (runId: string) => void;
  cancelRun: () => void;
  reset: () => void;

  // Session persistence
  loadSession: (messages: ConversationMessage[], artifacts?: Record<string, Artifact>) => void;
  getSessionData: () => { messages: ConversationMessage[]; artifacts: Artifact[] };
}

const initialState: AgentState = {
  phase: "idle",
  previousPhase: null,
  runId: null,
  isStreaming: false,
  messages: [],
  streamingMessageId: null,
  streamingContent: "",
  planId: null,
  steps: [],
  assumptions: [],
  pendingQuestion: null,
  artifacts: {},
  activeArtifactId: null,
  checkpoints: [],
  history: [],
  historyIndex: -1,
  error: null,
};

const MAX_HISTORY = 50; // Maximum undo steps

export const useAgentStore = create<AgentState & AgentActions>()((set, get) => ({
  ...initialState,

  tryTransition: (action: AgentAction): boolean => {
    const state = get();
    const ctx = buildTransitionContext(state);
    const nextPhase = transition(state.phase, action, ctx);
    if (nextPhase === null) {
      logger.warn("Invalid state transition", { from: state.phase, action });
      return false;
    }
    set({ previousPhase: state.phase, phase: nextPhase });
    return true;
  },

  processEvent: (event: AgentEvent) => {
    const processEventAsync = async () => {
      // Integrity validation on phase change
      if (event.type === "phase_changed") {
        const integrityService = createIntegrityValidationService(undefined as any, "", "");
        await integrityService.validateIntegrity({
          content: { reasoning: [event.payload.reason || ""], confidence: undefined },
          contentType: ContentType.AGENT_REASONING,
          agentType: "workspace-agent",
          context: {},
          traceId: event.runId,
          validationLevel: ValidationLevel.BASIC,
        });
      }
      switch (event.type) {
        case "phase_changed": {
          const validatedPhase = safeTransition(get().phase, event.payload.to);
          return {
            ...get(),
            phase: validatedPhase,
            error: validatedPhase !== "idle" ? null : get().error,
          };
        }

        case "checkpoint_created":
          return {
            ...get(),
            checkpoints: [
              ...get().checkpoints,
              {
                id: event.payload.checkpointId,
                label: event.payload.label,
                timestamp: event.timestamp,
                canRestore: event.payload.canRestore,
              },
            ],
          };

        case "tool_started": {
          const stepIndex = get().steps.findIndex((s) => s.id === event.payload.toolId);
          if (stepIndex < 0) return get();
          const newSteps: WorkflowStepState[] = get().steps.map((step, idx) =>
            idx === stepIndex
              ? { ...step, status: "running" as const, startedAt: event.timestamp }
              : step
          );
          return { ...get(), steps: newSteps };
        }

        case "tool_finished": {
          const stepIdx = get().steps.findIndex((s) => s.id === event.payload.toolId);
          if (stepIdx < 0) return get();
          const newStatus =
            event.payload.status === "success"
              ? ("completed" as const)
              : event.payload.status === "error"
                ? ("error" as const)
                : ("skipped" as const);
          const newSteps: WorkflowStepState[] = get().steps.map((step, idx) =>
            idx === stepIdx
              ? {
                  ...step,
                  status: newStatus,
                  completedAt: event.timestamp,
                  error: event.payload.error,
                }
              : step
          );
          return { ...get(), steps: newSteps };
        }

        case "artifact_proposed":
          return {
            ...get(),
            artifacts: { ...get().artifacts, [event.payload.artifact.id]: event.payload.artifact },
            activeArtifactId: get().activeArtifactId || event.payload.artifact.id,
          };

        case "artifact_updated": {
          const artifact = get().artifacts[event.payload.artifactId];
          if (!artifact) return get();
          return {
            ...get(),
            artifacts: {
              ...get().artifacts,
              [event.payload.artifactId]: {
                ...artifact,
                ...event.payload.changes,
                updatedAt: event.timestamp,
              },
            },
          };
        }

        case "message_delta":
          if (event.payload.done) {
            // Finalize message
            const msgIndex = get().messages.findIndex((m) => m.id === get().streamingMessageId);
            if (msgIndex >= 0) {
              const newMessages: ConversationMessage[] = get().messages.map((msg, idx) =>
                idx === msgIndex ? { ...msg, content: get().streamingContent } : msg
              );
              return {
                ...get(),
                messages: newMessages,
                streamingMessageId: null,
                streamingContent: "",
                isStreaming: false,
              };
            }
            return { ...get(), streamingMessageId: null, streamingContent: "", isStreaming: false };
          } else {
            // Start or continue streaming
            if (!get().streamingMessageId || get().streamingMessageId !== event.payload.messageId) {
              // New message
              const newMessage: ConversationMessage = {
                id: event.payload.messageId,
                role: "agent" as const,
                content: "",
                timestamp: event.timestamp,
              };
              return {
                ...get(),
                streamingMessageId: event.payload.messageId,
                streamingContent: event.payload.delta,
                isStreaming: true,
                messages: [...get().messages, newMessage],
              };
            } else {
              // Continue streaming
              return { ...get(), streamingContent: get().streamingContent + event.payload.delta };
            }
          }

        case "clarify_question":
          return {
            ...get(),
            phase: safeTransition(get().phase, "clarify"),
            pendingQuestion: {
              questionId: event.payload.questionId,
              question: event.payload.question,
              options: event.payload.options,
              defaultOption: event.payload.defaultOption,
              allowFreeform: event.payload.allowFreeform,
            },
          };

        case "plan_proposed":
          return {
            ...get(),
            phase: safeTransition(get().phase, "plan"),
            planId: event.payload.planId,
            steps: event.payload.steps.map((step) => ({
              id: step.id,
              label: step.label,
              status: "pending" as const,
            })),
            assumptions: event.payload.assumptions,
          };

        case "error": {
          const currentState = get();
          const ctx = buildTransitionContext(currentState);
          const errorPhase = transition(currentState.phase, "ERROR_OCCURRED", ctx);
          return {
            ...currentState,
            error: {
              code: event.payload.code,
              message: event.payload.message,
              recoverable: event.payload.recoverable,
              suggestions: event.payload.suggestions,
            },
            isStreaming: false,
            phase: errorPhase ?? currentState.phase,
            previousPhase: errorPhase ? currentState.phase : currentState.previousPhase,
          };
        }

        default:
          return get();
      }
    };
    return processEventAsync();
  },

  sendMessage: (content: string) => {
    set((state) => ({
      ...state,
      messages: [
        ...state.messages,
        {
          id: `msg_${Date.now()}`,
          role: "user" as const,
          content,
          timestamp: Date.now(),
        },
      ],
      pendingQuestion: null,
    }));
  },

  selectOption: (optionId: string) => {
    const { pendingQuestion } = get();
    if (!pendingQuestion) return;

    const option = pendingQuestion.options?.find((o) => o.id === optionId);
    if (option) {
      get().sendMessage(option.label);
    }
  },

  approvePlan: () => {
    const transitioned = get().tryTransition("PLAN_APPROVED");
    if (!transitioned) return;
    set((state) => {
      const newSteps: WorkflowStepState[] =
        state.steps.length > 0
          ? state.steps.map((step, idx) =>
              idx === 0 ? { ...step, status: "running" as const, startedAt: Date.now() } : step
            )
          : state.steps;
      return { ...state, steps: newSteps };
    });
  },

  rejectPlan: () => {
    const transitioned = get().tryTransition("PLAN_REJECTED");
    if (!transitioned) return;
    set((state) => ({
      ...state,
      planId: null,
      steps: [],
      assumptions: [],
    }));
  },

  updateAssumption: (id: string, value: string | number) => {
    set((state) => ({
      ...state,
      assumptions: state.assumptions.map((a) => (a.id === id && a.editable ? { ...a, value } : a)),
    }));
  },

  approveArtifact: (artifactId: string) => {
    set((state) => {
      const artifact = state.artifacts[artifactId];
      if (!artifact) return state;
      return {
        ...state,
        artifacts: {
          ...state.artifacts,
          [artifactId]: { ...artifact, status: "approved" as const, updatedAt: Date.now() },
        },
      };
    });
  },

  rejectArtifact: (artifactId: string) => {
    set((state) => {
      const artifact = state.artifacts[artifactId];
      if (!artifact) return state;
      return {
        ...state,
        artifacts: {
          ...state.artifacts,
          [artifactId]: { ...artifact, status: "rejected" as const, updatedAt: Date.now() },
        },
      };
    });
  },

  selectArtifact: (artifactId: string | null) => {
    set({ activeArtifactId: artifactId });
  },

  restoreCheckpoint: (checkpointId: string) => {
    logger.info("Restoring checkpoint:", checkpointId);
  },

  dismissError: () => {
    get().tryTransition("ERROR_DISMISSED");
    set({ error: null });
  },

  retryFromError: () => {
    const transitioned = get().tryTransition("ERROR_RECOVERED");
    if (transitioned) {
      set({ error: null });
    }
  },

  startRun: (runId: string) => {
    set({ runId, isStreaming: true, error: null });
  },

  cancelRun: () => {
    get().tryTransition("CANCEL");
    set({ isStreaming: false });
  },

  reset: () => {
    get().tryTransition("RESET");
    set(initialState);
  },

  // Save current state to history (call before making changes)
  saveSnapshot: () => {
    set((state) => {
      // Don't save if streaming (too many intermediate states)
      if (state.isStreaming) return state;

      // Create snapshot without history to avoid circular reference
      const snapshot: AgentState = {
        phase: state.phase,
        previousPhase: state.previousPhase,
        runId: state.runId,
        isStreaming: state.isStreaming,
        messages: [...state.messages],
        streamingMessageId: state.streamingMessageId,
        streamingContent: state.streamingContent,
        planId: state.planId,
        steps: [...state.steps],
        assumptions: [...state.assumptions],
        pendingQuestion: state.pendingQuestion,
        artifacts: { ...state.artifacts },
        activeArtifactId: state.activeArtifactId,
        checkpoints: [...state.checkpoints],
        history: [], // Don't include history in snapshot
        historyIndex: -1,
        error: state.error,
      };

      // Truncate future history if we're not at the end
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(snapshot);

      // Limit history size
      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
      }

      return {
        ...state,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    });
  },

  undo: () => {
    set((state) => {
      if (state.historyIndex <= 0) return state;

      const newIndex = state.historyIndex - 1;
      const snapshot = state.history[newIndex];

      if (!snapshot) return state;

      return {
        ...snapshot,
        history: state.history,
        historyIndex: newIndex,
      };
    });
  },

  redo: () => {
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) return state;

      const newIndex = state.historyIndex + 1;
      const snapshot = state.history[newIndex];

      if (!snapshot) return state;

      return {
        ...snapshot,
        history: state.history,
        historyIndex: newIndex,
      };
    });
  },

  loadSession: (messages: ConversationMessage[], artifacts?: Record<string, Artifact>) => {
    set((state) => ({
      ...state,
      messages,
      artifacts: artifacts || state.artifacts,
      activeArtifactId: artifacts ? Object.keys(artifacts)[0] || null : state.activeArtifactId,
      phase: messages.length > 0 ? "resume" : "idle",
      previousPhase: state.phase,
      isStreaming: false,
      error: null,
    }));
  },

  getSessionData: () => {
    const state = get();
    return {
      messages: state.messages,
      artifacts: Object.values(state.artifacts),
    };
  },
}));

// Selectors for common derived state
// Note: These return primitives or stable references to avoid infinite loops
export const selectIsProcessing = (state: AgentState): boolean =>
  state.phase === "execute" || state.isStreaming;

export const selectActiveArtifact = (state: AgentState): Artifact | null =>
  state.activeArtifactId ? (state.artifacts[state.activeArtifactId] ?? null) : null;

// This selector returns the artifacts record directly - use useMemo in component to sort
export const selectArtifacts = (state: AgentState): Record<string, Artifact> => state.artifacts;

export const selectCompletedSteps = (state: AgentState): number =>
  state.steps.filter((s) => s.status === "completed").length;

export const selectTotalSteps = (state: AgentState): number => state.steps.length;

export const selectOverallProgress = (state: AgentState): number => {
  if (state.steps.length === 0) return 0;
  const completed = state.steps.filter((s) => s.status === "completed").length;
  const running = state.steps.find((s) => s.status === "running");
  const runningProgress = running?.progress ?? 0;
  return Math.round(((completed + runningProgress / 100) / state.steps.length) * 100);
};

export const selectCanUndo = (state: AgentState): boolean => state.historyIndex > 0;

export const selectCanRedo = (state: AgentState): boolean =>
  state.historyIndex < state.history.length - 1;
