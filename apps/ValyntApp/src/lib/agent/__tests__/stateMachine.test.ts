/**
 * AgentStateMachine — P1 transition tests
 *
 * Covers:
 * - All 11 valid transitions succeed from the correct from-state
 * - Invalid transitions return false and leave state unchanged
 * - Each successful transition appends an AgentEvent to history
 * - Subscribers are notified with the new state and event
 * - reset() returns state to idle and clears history
 * - createAgentStateMachine() factory produces a fresh idle machine
 */

import { describe, expect, it, vi } from "vitest";

import { AgentStateMachine, createAgentStateMachine } from "../stateMachine";

// ---------------------------------------------------------------------------
// Valid transitions (mirrors the validTransitions array in stateMachine.ts)
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS = [
  { from: "idle", event: "START", to: "planning" },
  { from: "planning", event: "PLAN_APPROVED", to: "executing" },
  { from: "planning", event: "NEED_INPUT", to: "waiting" },
  { from: "planning", event: "ERROR", to: "error" },
  { from: "executing", event: "DONE", to: "completed" },
  { from: "executing", event: "NEED_INPUT", to: "waiting" },
  { from: "executing", event: "ERROR", to: "error" },
  { from: "waiting", event: "INPUT_RECEIVED", to: "planning" },
  { from: "waiting", event: "CONTINUE", to: "executing" },
  { from: "error", event: "RESET", to: "idle" },
  { from: "completed", event: "RESET", to: "idle" },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Drive the machine from idle to the given state by replaying the shortest
 * known path through VALID_TRANSITIONS.
 */
function driveToState(machine: AgentStateMachine, target: string): void {
  const paths: Record<string, string[]> = {
    idle: [],
    planning: ["START"],
    executing: ["START", "PLAN_APPROVED"],
    waiting: ["START", "NEED_INPUT"],
    completed: ["START", "PLAN_APPROVED", "DONE"],
    error: ["START", "ERROR"],
  };
  const events = paths[target];
  if (!events) throw new Error(`No known path to state: ${target}`);
  for (const event of events) {
    machine.transition(event);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AgentStateMachine — valid transitions", () => {
  it.each(VALID_TRANSITIONS)(
    "transitions from $from on $event to $to",
    ({ from, event, to }) => {
      const machine = new AgentStateMachine();
      driveToState(machine, from);

      const result = machine.transition(event);

      expect(result).toBe(true);
      expect(machine.getState()).toBe(to);
    },
  );
});

describe("AgentStateMachine — invalid transition rejection", () => {
  it("returns false for an event that has no transition from the current state", () => {
    const machine = new AgentStateMachine();
    // idle → DONE is not a valid transition
    const result = machine.transition("DONE");

    expect(result).toBe(false);
    expect(machine.getState()).toBe("idle");
  });

  it("does not change state on an invalid transition", () => {
    const machine = new AgentStateMachine();
    machine.transition("START"); // → planning

    // DONE is only valid from executing, not planning
    machine.transition("DONE");

    expect(machine.getState()).toBe("planning");
  });

  it("returns false for an unknown event name", () => {
    const machine = new AgentStateMachine();
    const result = machine.transition("NONEXISTENT_EVENT");

    expect(result).toBe(false);
    expect(machine.getState()).toBe("idle");
  });

  it("returns false when trying to START from completed", () => {
    const machine = new AgentStateMachine();
    driveToState(machine, "completed");

    const result = machine.transition("START");

    expect(result).toBe(false);
    expect(machine.getState()).toBe("completed");
  });
});

describe("AgentStateMachine — history recording", () => {
  it("starts with an empty history", () => {
    const machine = new AgentStateMachine();
    expect(machine.getHistory()).toHaveLength(0);
  });

  it("appends one AgentEvent per successful transition", () => {
    const machine = new AgentStateMachine();
    machine.transition("START");
    machine.transition("PLAN_APPROVED");

    const history = machine.getHistory();
    expect(history).toHaveLength(2);
  });

  it("does not append to history on invalid transitions", () => {
    const machine = new AgentStateMachine();
    machine.transition("DONE"); // invalid from idle

    expect(machine.getHistory()).toHaveLength(0);
  });

  it("each history entry has type state_change with from/to/event data", () => {
    const machine = new AgentStateMachine();
    machine.transition("START");

    const [entry] = machine.getHistory();
    expect(entry.type).toBe("state_change");
    expect(entry.timestamp).toBeTruthy();
    expect((entry.data as Record<string, unknown>).from).toBe("idle");
    expect((entry.data as Record<string, unknown>).to).toBe("planning");
    expect((entry.data as Record<string, unknown>).event).toBe("START");
  });

  it("getHistory returns a copy — mutations do not affect internal state", () => {
    const machine = new AgentStateMachine();
    machine.transition("START");

    const history = machine.getHistory();
    history.pop(); // mutate the returned array

    expect(machine.getHistory()).toHaveLength(1);
  });
});

describe("AgentStateMachine — subscriber notification", () => {
  it("calls subscriber with new state and event on each transition", () => {
    const machine = new AgentStateMachine();
    const listener = vi.fn();
    machine.subscribe(listener);

    machine.transition("START");

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(
      "planning",
      expect.objectContaining({ type: "state_change" }),
    );
  });

  it("calls multiple subscribers", () => {
    const machine = new AgentStateMachine();
    const listenerA = vi.fn();
    const listenerB = vi.fn();
    machine.subscribe(listenerA);
    machine.subscribe(listenerB);

    machine.transition("START");

    expect(listenerA).toHaveBeenCalledOnce();
    expect(listenerB).toHaveBeenCalledOnce();
  });

  it("does not call subscriber on invalid transitions", () => {
    const machine = new AgentStateMachine();
    const listener = vi.fn();
    machine.subscribe(listener);

    machine.transition("DONE"); // invalid from idle

    expect(listener).not.toHaveBeenCalled();
  });

  it("unsubscribe stops future notifications", () => {
    const machine = new AgentStateMachine();
    const listener = vi.fn();
    const unsubscribe = machine.subscribe(listener);

    unsubscribe();
    machine.transition("START");

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("AgentStateMachine — reset", () => {
  it("returns state to idle after reset from completed", () => {
    const machine = new AgentStateMachine();
    driveToState(machine, "completed");

    machine.reset();

    expect(machine.getState()).toBe("idle");
  });

  it("clears history on reset", () => {
    const machine = new AgentStateMachine();
    machine.transition("START");
    machine.transition("PLAN_APPROVED");

    machine.reset();

    expect(machine.getHistory()).toHaveLength(0);
  });

  it("allows transitions from idle after reset", () => {
    const machine = new AgentStateMachine();
    driveToState(machine, "error");
    machine.transition("RESET"); // → idle via valid transition
    machine.reset(); // explicit reset

    const result = machine.transition("START");
    expect(result).toBe(true);
    expect(machine.getState()).toBe("planning");
  });
});

describe("createAgentStateMachine factory", () => {
  it("creates a machine in idle state", () => {
    const machine = createAgentStateMachine();
    expect(machine.getState()).toBe("idle");
  });

  it("creates independent instances", () => {
    const a = createAgentStateMachine();
    const b = createAgentStateMachine();

    a.transition("START");

    expect(a.getState()).toBe("planning");
    expect(b.getState()).toBe("idle");
  });
});
