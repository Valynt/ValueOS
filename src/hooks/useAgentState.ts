/**
 * useAgentState Hook
 *
 * React hook for managing agent state machine in components.
 * Provides reactive state updates and action dispatchers.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { AgentStateMachine, createAgentStateMachine } from "../lib/agent/AgentStateMachine";
import {
  AgentState,
  AgentEvent,
  AgentSessionState,
  AgentStateMachineContext,
  PlanStep,
  ClarifyQuestion,
  ExecutionProgress,
  Artifact,
  AgentError,
} from "../lib/agent/types";
import { useTenant } from "../contexts/TenantContext";
import { useAuth } from "../contexts/AuthContext";
import { createLogger } from "../lib/logger";

const logger = createLogger({ component: "useAgentState" });

export interface UseAgentStateOptions {
  sessionId?: string;
  workspaceId?: string;
  autoConnect?: boolean;
  onStateChange?: (state: AgentState, context: AgentStateMachineContext) => void;
  onError?: (error: AgentError) => void;
}

export interface UseAgentStateReturn {
  // State
  state: AgentState;
  session: AgentSessionState;
  isIdle: boolean;
  isWorking: boolean;
  isPaused: boolean;
  isConnected: boolean;

  // State-specific data
  clarifyQuestion: ClarifyQuestion | null;
  plan: PlanStep[] | null;
  progress: ExecutionProgress | null;
  artifacts: Artifact[];
  error: AgentError | null;

  // Actions
  start: (prompt: string, context?: Record<string, unknown>) => void;
  submitClarification: (answer: string) => void;
  approvePlan: (approvedSteps?: string[]) => void;
  modifyPlan: (stepId: string, changes: { title?: string; description?: string }) => void;
  rejectPlan: () => void;
  pause: () => void;
  resume: () => void;
  approveReview: (approvedItems?: string[]) => void;
  rejectReview: (reason: string) => void;
  requestRevision: (artifactId: string, change: string) => void;
  cancel: () => void;
  reset: () => void;

  // Session management
  canResume: boolean;
  restoreSession: (sessionId: string) => void;

  // Raw dispatch for advanced use
  dispatch: (event: AgentEvent) => void;
}

export function useAgentState(options: UseAgentStateOptions = {}): UseAgentStateReturn {
  const { sessionId, workspaceId, onStateChange, onError } = options;

  const { currentTenant } = useTenant();
  const { user } = useAuth();

  const machineRef = useRef<AgentStateMachine | null>(null);
  const [, forceUpdate] = useState({});

  // Initialize state machine
  useEffect(() => {
    if (!currentTenant?.id || !user?.id) {
      return;
    }

    machineRef.current = createAgentStateMachine({
      tenantId: currentTenant.id,
      userId: user.id,
      workspaceId,
      sessionId,
    });

    const unsubscribe = machineRef.current.subscribe((state, context) => {
      forceUpdate({});
      onStateChange?.(state, context);

      if (context.session.error) {
        onError?.(context.session.error);
      }
    });

    logger.info("Agent state machine initialized", {
      sessionId: machineRef.current.session.sessionId,
      tenantId: currentTenant.id,
    });

    return () => {
      unsubscribe();
      machineRef.current = null;
    };
  }, [currentTenant?.id, user?.id, workspaceId, sessionId, onStateChange, onError]);

  // Dispatch helper
  const dispatch = useCallback((event: AgentEvent) => {
    if (!machineRef.current) {
      logger.warn("Cannot dispatch - state machine not initialized");
      return;
    }
    machineRef.current.dispatch(event);
  }, []);

  // Action creators
  const start = useCallback(
    (prompt: string, context?: Record<string, unknown>) => {
      dispatch({ type: "START", payload: { prompt, context } });
    },
    [dispatch]
  );

  const submitClarification = useCallback(
    (answer: string) => {
      dispatch({ type: "CLARIFY_RESPONSE", payload: { answer } });
    },
    [dispatch]
  );

  const approvePlan = useCallback(
    (approvedSteps?: string[]) => {
      dispatch({ type: "PLAN_APPROVED", payload: { approvedSteps } });
    },
    [dispatch]
  );

  const modifyPlan = useCallback(
    (stepId: string, changes: { title?: string; description?: string }) => {
      dispatch({
        type: "PLAN_MODIFIED",
        payload: {
          modifications: [
            {
              stepId,
              action: "modify",
              newTitle: changes.title,
              newDescription: changes.description,
            },
          ],
        },
      });
    },
    [dispatch]
  );

  const rejectPlan = useCallback(() => {
    dispatch({ type: "PLAN_REJECTED" });
  }, [dispatch]);

  const pause = useCallback(() => {
    dispatch({ type: "EXECUTE_PAUSE" });
  }, [dispatch]);

  const resume = useCallback(() => {
    dispatch({ type: "EXECUTE_RESUME" });
  }, [dispatch]);

  const approveReview = useCallback(
    (approvedItems?: string[]) => {
      dispatch({ type: "REVIEW_APPROVE", payload: { approvedItems } });
    },
    [dispatch]
  );

  const rejectReview = useCallback(
    (reason: string) => {
      dispatch({ type: "REVIEW_REJECT", payload: { reason } });
    },
    [dispatch]
  );

  const requestRevision = useCallback(
    (artifactId: string, change: string) => {
      dispatch({
        type: "REVIEW_REVISE",
        payload: {
          revisions: [
            {
              artifactId,
              requestedChange: change,
              priority: "medium",
            },
          ],
        },
      });
    },
    [dispatch]
  );

  const cancel = useCallback(() => {
    dispatch({ type: "CANCEL" });
  }, [dispatch]);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, [dispatch]);

  const restoreSession = useCallback(
    (restoredSessionId: string) => {
      dispatch({ type: "SESSION_RESTORE", payload: { sessionId: restoredSessionId } });
    },
    [dispatch]
  );

  // Derived state
  const machine = machineRef.current;
  const session = machine?.session ?? createEmptySession();
  const context = machine?.fullContext ?? createEmptyContext();

  const state = session.state;
  const isIdle = state === "idle";
  const isWorking = ["clarify", "plan", "execute", "review", "finalize"].includes(state);
  const isPaused = context.isPaused;
  const isConnected = context.isConnected;

  return useMemo(
    () => ({
      // State
      state,
      session,
      isIdle,
      isWorking,
      isPaused,
      isConnected,

      // State-specific data
      clarifyQuestion: session.clarifyQuestion ?? null,
      plan: session.plan ?? null,
      progress: session.progress ?? null,
      artifacts: session.artifacts ?? [],
      error: session.error ?? null,

      // Actions
      start,
      submitClarification,
      approvePlan,
      modifyPlan,
      rejectPlan,
      pause,
      resume,
      approveReview,
      rejectReview,
      requestRevision,
      cancel,
      reset,

      // Session management
      canResume: session.canResume,
      restoreSession,

      // Raw dispatch
      dispatch,
    }),
    [
      state,
      session,
      isIdle,
      isWorking,
      isPaused,
      isConnected,
      start,
      submitClarification,
      approvePlan,
      modifyPlan,
      rejectPlan,
      pause,
      resume,
      approveReview,
      rejectReview,
      requestRevision,
      cancel,
      reset,
      restoreSession,
      dispatch,
    ]
  );
}

function createEmptySession(): AgentSessionState {
  return {
    sessionId: "",
    state: "idle",
    startedAt: "",
    updatedAt: "",
    tenantId: "",
    userId: "",
    canResume: false,
  };
}

function createEmptyContext(): AgentStateMachineContext {
  return {
    session: createEmptySession(),
    isPaused: false,
    isConnected: false,
  };
}

export default useAgentState;
