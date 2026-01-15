/**
 * Agent State Store
 * 
 * Client-side state management for agent interactions.
 * Uses Zustand for reactive state.
 */

import { create } from 'zustand';
import type {
  AgentPhase,
  AgentEvent,
  Artifact,
  ConversationMessage,
  WorkflowStepState,
  PlanAssumption,
  ClarifyOption,
} from './types';

export interface AgentState {
  // Current phase
  phase: AgentPhase;
  
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
  
  // Error state
  error: {
    code: string;
    message: string;
    recoverable: boolean;
    suggestions?: string[];
  } | null;
}

export interface AgentActions {
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
  
  // Control
  startRun: (runId: string) => void;
  cancelRun: () => void;
  reset: () => void;
}

const initialState: AgentState = {
  phase: 'idle',
  runId: null,
  isStreaming: false,
  messages: [],
  streamingMessageId: null,
  streamingContent: '',
  planId: null,
  steps: [],
  assumptions: [],
  pendingQuestion: null,
  artifacts: {},
  activeArtifactId: null,
  checkpoints: [],
  error: null,
};

export const useAgentStore = create<AgentState & AgentActions>()((set, get) => ({
  ...initialState,

  processEvent: (event: AgentEvent) => {
    set((state) => {
      switch (event.type) {
        case 'phase_changed':
          return {
            ...state,
            phase: event.payload.to,
            error: event.payload.to !== 'idle' ? null : state.error,
          };

        case 'checkpoint_created':
          return {
            ...state,
            checkpoints: [...state.checkpoints, {
              id: event.payload.checkpointId,
              label: event.payload.label,
              timestamp: event.timestamp,
              canRestore: event.payload.canRestore,
            }],
          };

        case 'tool_started': {
          const stepIndex = state.steps.findIndex(s => s.id === event.payload.toolId);
          if (stepIndex < 0) return state;
          const newSteps: WorkflowStepState[] = state.steps.map((step, idx) => 
            idx === stepIndex 
              ? { ...step, status: 'running' as const, startedAt: event.timestamp }
              : step
          );
          return { ...state, steps: newSteps };
        }

        case 'tool_finished': {
          const stepIdx = state.steps.findIndex(s => s.id === event.payload.toolId);
          if (stepIdx < 0) return state;
          const newStatus = event.payload.status === 'success' ? 'completed' as const : 
                           event.payload.status === 'error' ? 'error' as const : 'skipped' as const;
          const newSteps: WorkflowStepState[] = state.steps.map((step, idx) => 
            idx === stepIdx 
              ? { ...step, status: newStatus, completedAt: event.timestamp, error: event.payload.error }
              : step
          );
          return { ...state, steps: newSteps };
        }

        case 'artifact_proposed':
          return {
            ...state,
            artifacts: { ...state.artifacts, [event.payload.artifact.id]: event.payload.artifact },
            activeArtifactId: state.activeArtifactId || event.payload.artifact.id,
          };

        case 'artifact_updated': {
          const artifact = state.artifacts[event.payload.artifactId];
          if (!artifact) return state;
          return {
            ...state,
            artifacts: {
              ...state.artifacts,
              [event.payload.artifactId]: { ...artifact, ...event.payload.changes, updatedAt: event.timestamp },
            },
          };
        }

        case 'message_delta':
          if (event.payload.done) {
            // Finalize message
            const msgIndex = state.messages.findIndex(m => m.id === state.streamingMessageId);
            if (msgIndex >= 0) {
              const newMessages: ConversationMessage[] = state.messages.map((msg, idx) =>
                idx === msgIndex ? { ...msg, content: state.streamingContent } : msg
              );
              return {
                ...state,
                messages: newMessages,
                streamingMessageId: null,
                streamingContent: '',
                isStreaming: false,
              };
            }
            return { ...state, streamingMessageId: null, streamingContent: '', isStreaming: false };
          } else {
            // Start or continue streaming
            if (!state.streamingMessageId || state.streamingMessageId !== event.payload.messageId) {
              // New message
              const newMessage: ConversationMessage = {
                id: event.payload.messageId,
                role: 'agent',
                content: '',
                timestamp: event.timestamp,
              };
              return {
                ...state,
                streamingMessageId: event.payload.messageId,
                streamingContent: event.payload.delta,
                isStreaming: true,
                messages: [...state.messages, newMessage],
              };
            } else {
              // Continue streaming
              return { ...state, streamingContent: state.streamingContent + event.payload.delta };
            }
          }

        case 'clarify_question':
          return {
            ...state,
            phase: 'clarify' as const,
            pendingQuestion: {
              questionId: event.payload.questionId,
              question: event.payload.question,
              options: event.payload.options,
              defaultOption: event.payload.defaultOption,
              allowFreeform: event.payload.allowFreeform,
            },
          };

        case 'plan_proposed':
          return {
            ...state,
            phase: 'plan' as const,
            planId: event.payload.planId,
            steps: event.payload.steps.map(step => ({
              id: step.id,
              label: step.label,
              status: 'pending' as const,
            })),
            assumptions: event.payload.assumptions,
          };

        case 'error':
          return {
            ...state,
            error: {
              code: event.payload.code,
              message: event.payload.message,
              recoverable: event.payload.recoverable,
              suggestions: event.payload.suggestions,
            },
            isStreaming: event.payload.recoverable ? state.isStreaming : false,
            phase: event.payload.recoverable ? state.phase : 'idle',
          };

        default:
          return state;
      }
    });
  },

  sendMessage: (content: string) => {
    set((state) => ({
      ...state,
      messages: [...state.messages, {
        id: `msg_${Date.now()}`,
        role: 'user' as const,
        content,
        timestamp: Date.now(),
      }],
      pendingQuestion: null,
    }));
  },

  selectOption: (optionId: string) => {
    const { pendingQuestion } = get();
    if (!pendingQuestion) return;
    
    const option = pendingQuestion.options?.find(o => o.id === optionId);
    if (option) {
      get().sendMessage(option.label);
    }
  },

  approvePlan: () => {
    set((state) => {
      const newSteps: WorkflowStepState[] = state.steps.length > 0 
        ? state.steps.map((step, idx) => 
            idx === 0 ? { ...step, status: 'running' as const, startedAt: Date.now() } : step
          )
        : state.steps;
      return { ...state, phase: 'execute' as const, steps: newSteps };
    });
  },

  rejectPlan: () => {
    set((state) => ({
      ...state,
      phase: 'idle' as const,
      planId: null,
      steps: [],
      assumptions: [],
    }));
  },

  updateAssumption: (id: string, value: string | number) => {
    set((state) => ({
      ...state,
      assumptions: state.assumptions.map(a => 
        a.id === id && a.editable ? { ...a, value } : a
      ),
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
          [artifactId]: { ...artifact, status: 'approved' as const, updatedAt: Date.now() },
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
          [artifactId]: { ...artifact, status: 'rejected' as const, updatedAt: Date.now() },
        },
      };
    });
  },

  selectArtifact: (artifactId: string | null) => {
    set({ activeArtifactId: artifactId });
  },

  restoreCheckpoint: (checkpointId: string) => {
    console.log('Restoring checkpoint:', checkpointId);
  },

  startRun: (runId: string) => {
    set({ runId, isStreaming: true, error: null });
  },

  cancelRun: () => {
    set({ isStreaming: false, phase: 'idle' });
  },

  reset: () => {
    set(initialState);
  },
}));

// Selectors for common derived state
// Note: These return primitives or stable references to avoid infinite loops
export const selectIsProcessing = (state: AgentState): boolean => 
  state.phase === 'execute' || state.isStreaming;

export const selectActiveArtifact = (state: AgentState): Artifact | null =>
  state.activeArtifactId ? state.artifacts[state.activeArtifactId] ?? null : null;

// This selector returns the artifacts record directly - use useMemo in component to sort
export const selectArtifacts = (state: AgentState): Record<string, Artifact> =>
  state.artifacts;

export const selectCompletedSteps = (state: AgentState): number =>
  state.steps.filter(s => s.status === 'completed').length;

export const selectTotalSteps = (state: AgentState): number =>
  state.steps.length;

export const selectOverallProgress = (state: AgentState): number => {
  if (state.steps.length === 0) return 0;
  const completed = state.steps.filter(s => s.status === 'completed').length;
  const running = state.steps.find(s => s.status === 'running');
  const runningProgress = running?.progress ?? 0;
  return Math.round(((completed + runningProgress / 100) / state.steps.length) * 100);
};
