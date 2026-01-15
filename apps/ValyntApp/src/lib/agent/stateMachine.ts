import type { AgentState, AgentEvent } from "./types";

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

export class AgentStateMachine {
  private state: AgentState = "idle";
  private history: AgentEvent[] = [];
  private listeners: ((state: AgentState, event: AgentEvent) => void)[] = [];

  getState(): AgentState {
    return this.state;
  }

  getHistory(): AgentEvent[] {
    return [...this.history];
  }

  canTransition(event: string): boolean {
    return validTransitions.some(
      (t) => t.from === this.state && t.event === event
    );
  }

  transition(event: string, data?: unknown): boolean {
    const transition = validTransitions.find(
      (t) => t.from === this.state && t.event === event
    );

    if (!transition) {
      console.warn(`Invalid transition: ${this.state} -> ${event}`);
      return false;
    }

    const agentEvent: AgentEvent = {
      type: "state_change",
      timestamp: new Date().toISOString(),
      data: { from: this.state, to: transition.to, event, payload: data },
    };

    this.state = transition.to;
    this.history.push(agentEvent);
    this.notifyListeners(agentEvent);

    return true;
  }

  subscribe(listener: (state: AgentState, event: AgentEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(event: AgentEvent): void {
    this.listeners.forEach((listener) => listener(this.state, event));
  }

  reset(): void {
    this.state = "idle";
    this.history = [];
  }
}

export function createAgentStateMachine(): AgentStateMachine {
  return new AgentStateMachine();
}
