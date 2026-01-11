/**
 * Agent State Machine
 *
 * Manages the 7-state agent workflow with type-safe transitions.
 * States: Idle → Clarify → Plan → Execute → Review → Finalize → Resume
 */

import { createLogger } from "../logger";
import { analyticsClient } from "../analyticsClient";
import type {
  AgentState,
  AgentEvent,
  AgentSessionState,
  AgentStateMachineContext,
  Artifact,
  FinalizeResult,
} from "./types";
import { isValidTransition } from "./types";

const logger = createLogger({ component: "AgentStateMachine" });

/**
 * State machine listener callback
 */
export type StateListener = (state: AgentState, context: AgentStateMachineContext) => void;

/**
 * Agent State Machine
 */
export class AgentStateMachine {
  private context: AgentStateMachineContext;
  private listeners: Set<StateListener> = new Set();

  constructor(initialSession?: Partial<AgentSessionState>) {
    const now = new Date().toISOString();

    this.context = {
      session: {
        sessionId: initialSession?.sessionId || this.generateSessionId(),
        state: initialSession?.state || "idle",
        startedAt: initialSession?.startedAt || now,
        updatedAt: now,
        tenantId: initialSession?.tenantId || "",
        userId: initialSession?.userId || "",
        canResume: false,
        ...initialSession,
      },
      isPaused: false,
      isConnected: false,
    };

    logger.info("Agent state machine initialized", {
      sessionId: this.context.session.sessionId,
      state: this.context.session.state,
    });
  }

  /**
   * Get current state
   */
  get state(): AgentState {
    return this.context.session.state;
  }

  /**
   * Get full session state
   */
  get session(): AgentSessionState {
    return { ...this.context.session };
  }

  /**
   * Get full context
   */
  get fullContext(): AgentStateMachineContext {
    return { ...this.context };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Dispatch an event to the state machine
   */
  dispatch(event: AgentEvent): void {
    const previousState = this.context.session.state;

    logger.debug("Dispatching event", {
      type: event.type,
      currentState: previousState,
    });

    try {
      this.handleEvent(event);

      const newState = this.context.session.state;
      if (newState !== previousState) {
        this.notifyListeners();
        this.trackStateChange(previousState, newState, event.type);
      }
    } catch (error) {
      logger.error("Error handling event", error as Error, {
        eventType: event.type,
        state: previousState,
      });
      throw error;
    }
  }

  /**
   * Handle state machine events
   */
  private handleEvent(event: AgentEvent): void {
    const { session } = this.context;

    switch (event.type) {
      case "START":
        this.transitionTo("plan");
        session.prompt = event.payload.prompt;
        break;

      case "CLARIFY_NEEDED":
        this.transitionTo("clarify");
        session.clarifyQuestion = event.payload;
        break;

      case "CLARIFY_RESPONSE":
        this.transitionTo("plan");
        session.clarifyQuestion = undefined;
        break;

      case "PLAN_READY":
        this.transitionTo("plan");
        session.plan = event.payload.plan;
        break;

      case "PLAN_APPROVED":
        this.transitionTo("execute");
        if (event.payload.approvedSteps) {
          session.plan = session.plan?.map((step) => ({
            ...step,
            status: event.payload.approvedSteps!.includes(step.id) ? "approved" : "rejected",
          }));
        } else {
          session.plan = session.plan?.map((step) => ({
            ...step,
            status: "approved",
          }));
        }
        break;

      case "PLAN_MODIFIED":
        // Stay in plan state, update plan
        for (const mod of event.payload.modifications) {
          const step = session.plan?.find((s) => s.id === mod.stepId);
          if (step) {
            if (mod.action === "modify") {
              step.title = mod.newTitle || step.title;
              step.description = mod.newDescription || step.description;
              step.status = "modified";
            } else if (mod.action === "remove") {
              step.status = "rejected";
            }
          }
        }
        break;

      case "PLAN_REJECTED":
        this.transitionTo("idle");
        session.plan = undefined;
        break;

      case "EXECUTE_PROGRESS":
        session.progress = event.payload;
        session.canResume = true;
        session.resumePoint = {
          state: "execute",
          stepId: event.payload.currentStepId,
        };
        break;

      case "EXECUTE_COMPLETE":
        this.transitionTo("review");
        session.results = event.payload.results;
        session.progress = undefined;
        break;

      case "EXECUTE_ERROR":
        session.error = event.payload;
        if (!event.payload.recoverable) {
          this.transitionTo("idle");
        }
        break;

      case "EXECUTE_PAUSE":
        this.context.isPaused = true;
        break;

      case "EXECUTE_RESUME":
        this.context.isPaused = false;
        break;

      case "REVIEW_APPROVE":
        this.transitionTo("finalize");
        break;

      case "REVIEW_REJECT":
        this.transitionTo("idle");
        session.results = undefined;
        session.artifacts = undefined;
        break;

      case "REVIEW_REVISE":
        this.transitionTo("execute");
        // Keep results but mark for revision
        break;

      case "FINALIZE_COMPLETE":
        this.handleFinalizeComplete(event.payload);
        break;

      case "FINALIZE_ERROR":
        session.error = event.payload;
        // Stay in finalize state for retry
        break;

      case "SESSION_RESTORE":
        this.transitionTo("resume");
        break;

      case "CANCEL":
        this.transitionTo("idle");
        this.resetSessionData();
        break;

      case "RESET":
        this.transitionTo("idle");
        this.resetSessionData();
        session.sessionId = this.generateSessionId();
        break;

      default:
        logger.warn("Unknown event type", { event });
    }

    session.updatedAt = new Date().toISOString();
  }

  /**
   * Transition to a new state with validation
   */
  private transitionTo(newState: AgentState): void {
    const currentState = this.context.session.state;

    if (currentState === newState) {
      return;
    }

    if (!isValidTransition(currentState, newState)) {
      throw new Error(`Invalid state transition: ${currentState} → ${newState}`);
    }

    logger.info("State transition", {
      from: currentState,
      to: newState,
      sessionId: this.context.session.sessionId,
    });

    this.context.session.state = newState;
  }

  /**
   * Handle finalize complete
   */
  private handleFinalizeComplete(result: FinalizeResult): void {
    const { session } = this.context;

    session.artifacts = session.artifacts?.map((artifact) => {
      const saved = result.savedArtifacts.find((s) => s.artifactId === artifact.id);
      return saved ? { ...artifact, saved: true } : artifact;
    });

    this.transitionTo("idle");
    session.canResume = false;
    session.resumePoint = undefined;
  }

  /**
   * Reset session data (keep session ID and metadata)
   */
  private resetSessionData(): void {
    const { session } = this.context;
    session.prompt = undefined;
    session.clarifyQuestion = undefined;
    session.plan = undefined;
    session.progress = undefined;
    session.results = undefined;
    session.artifacts = undefined;
    session.error = undefined;
    session.canResume = false;
    session.resumePoint = undefined;
    this.context.isPaused = false;
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    const state = this.context.session.state;
    const context = { ...this.context };

    this.listeners.forEach((listener) => {
      try {
        listener(state, context);
      } catch (error) {
        logger.error("Error in state listener", error as Error);
      }
    });
  }

  /**
   * Track state change for analytics
   */
  private trackStateChange(from: AgentState, to: AgentState, eventType: string): void {
    analyticsClient.track("agent_state_change", {
      sessionId: this.context.session.sessionId,
      fromState: from,
      toState: to,
      trigger: eventType,
      tenantId: this.context.session.tenantId,
    });
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set connection status
   */
  setConnected(connected: boolean): void {
    this.context.isConnected = connected;
    this.notifyListeners();
  }

  /**
   * Update artifacts
   */
  updateArtifacts(artifacts: Artifact[]): void {
    this.context.session.artifacts = artifacts;
    this.context.session.updatedAt = new Date().toISOString();
    this.notifyListeners();
  }

  /**
   * Get serializable state for persistence
   */
  toJSON(): AgentSessionState {
    return { ...this.context.session };
  }

  /**
   * Restore from serialized state
   */
  static fromJSON(data: AgentSessionState): AgentStateMachine {
    return new AgentStateMachine(data);
  }
}

/**
 * Create a new agent state machine
 */
export function createAgentStateMachine(options: {
  tenantId: string;
  userId: string;
  workspaceId?: string;
  sessionId?: string;
}): AgentStateMachine {
  return new AgentStateMachine({
    tenantId: options.tenantId,
    userId: options.userId,
    workspaceId: options.workspaceId,
    sessionId: options.sessionId,
  });
}

export default AgentStateMachine;
