import type { AgentState, AgentEvent } from "./types";
import { workflowExecutionStore } from "../../services/WorkflowExecutionStore";

class PersistentAgentStateMachine {
  private id: string;
  private listeners: ((state: AgentState, event: AgentEvent) => void)[] = [];
  private currentState: AgentState = "idle";

  constructor(agentId: string) {
    this.id = agentId;
  }

  async initialize(): Promise<void> {
    // Load persisted state on startup
    const { state, events } = await workflowExecutionStore.loadAgentState(this.id);
    this.currentState = state as AgentState;

    // Replay events to listeners for state recovery
    for (const event of events) {
      this.notifyListeners(this.currentState, event);
    }
  }

  async getState(): Promise<AgentState> {
    return this.currentState;
  }

  async getHistory(): Promise<AgentEvent[]> {
    return await workflowExecutionStore.getAgentEvents(this.id);
  }

  async canTransition(event: string): Promise<boolean> {
    // Basic validation - can be extended with state transition rules
    const validStates: Record<AgentState, string[]> = {
      idle: ["planning", "executing"],
      planning: ["executing", "error"],
      executing: ["waiting", "completed", "error"],
      waiting: ["executing", "completed", "error"],
      completed: [],
      error: ["idle"],
    };

    return validStates[this.currentState]?.includes(event) ?? false;
  }

  async transition(event: string, data?: unknown): Promise<boolean> {
    if (!(await this.canTransition(event))) {
      throw new Error(`Invalid transition from ${this.currentState} to ${event}`);
    }

    const fromState = this.currentState;
    const result = await workflowExecutionStore.persistTransition(this.id, fromState, event, data);

    if (!result.success) {
      throw new Error(`State transition failed: ${result.error}`);
    }

    this.currentState = event as AgentState;

    // Create and notify event
    const transitionEvent: AgentEvent = {
      type: "state_change",
      timestamp: new Date().toISOString(),
      data: { fromState, toState: event, transitionData: data },
    };

    this.notifyListeners(this.currentState, transitionEvent);
    return true;
  }

  subscribe(listener: (state: AgentState, event: AgentEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(state: AgentState, event: AgentEvent): void {
    this.listeners.forEach((listener) => listener(state, event));
  }

  async reset(): Promise<void> {
    await workflowExecutionStore.resetState(this.id);
    this.currentState = "idle";
  }

  async loadFromStore(): Promise<void> {
    await this.initialize();
  }
}

export function createPersistentAgentStateMachine(agentId: string): PersistentAgentStateMachine {
  return new PersistentAgentStateMachine(agentId);
}
