import type { AgentState, AgentEvent } from "./types";
import { agentStateStore } from "../../services/AgentStateStore";

type StateTransition = {
  from: AgentState;
  to: AgentState;
  event: string;
};

const validTransitions: StateTransition[] = [
  { from: "idle", to: "planning", event: "START" },
  { from: "planning", to: "executing", event: "PLAN_APPROVED" },
  { from: "planning", to: "waiting", event: "NEED_INPUT" },
  { from: "planning", to: "error", event: "ERROR" },
  { from: "executing", to: "completed", event: "DONE" },
  { from: "executing", to: "waiting", event: "NEED_INPUT" },
  { from: "executing", to: "error", event: "ERROR" },
  { from: "waiting", to: "planning", event: "INPUT_RECEIVED" },
  { from: "waiting", to: "executing", event: "CONTINUE" },
  { from: "error", to: "idle", event: "RESET" },
  { from: "completed", to: "idle", event: "RESET" },
];

export class PersistentAgentStateMachine {
  private id: string;
  private listeners: ((state: AgentState, event: AgentEvent) => void)[] = [];

  constructor(agentId: string) {
    this.id = agentId;
  }

  async getState(): Promise<AgentState> {
    return await agentStateStore.getState(this.id);
  }

  async getHistory(): Promise<AgentEvent[]> {
    return await agentStateStore.getHistory(this.id);
  }

  async canTransition(event: string): Promise<boolean> {
    const currentState = await this.getState();
    return validTransitions.some((t) => t.from === currentState && t.event === event);
  }

  async transition(event: string, data?: unknown): Promise<boolean> {
    const currentState = await this.getState();
    const transition = validTransitions.find((t) => t.from === currentState && t.event === event);

    if (!transition) {
      console.warn(`Invalid transition: ${currentState} -> ${event}`);
      return false;
    }

    const agentEvent: AgentEvent = {
      type: "state_change",
      timestamp: new Date().toISOString(),
      data: { from: currentState, to: transition.to, event, payload: data },
    };

    // Persist the new state and event
    await agentStateStore.setState(this.id, transition.to);
    await agentStateStore.addEvent(this.id, agentEvent);

    // Notify listeners
    this.notifyListeners(transition.to, agentEvent);

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
    await agentStateStore.setState(this.id, "idle");
    // Clear history by setting empty history
    await agentStateStore.setFullState({ id: this.id, state: "idle", history: [] });
  }

  async loadFromStore(): Promise<void> {
    // State is already loaded on demand, but we can preload if needed
    // For now, this is a no-op since getState() fetches from store
  }
}

export function createPersistentAgentStateMachine(agentId: string): PersistentAgentStateMachine {
  return new PersistentAgentStateMachine(agentId);
}
