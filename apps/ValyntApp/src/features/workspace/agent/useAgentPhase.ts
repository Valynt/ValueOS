/**
 * useAgentPhase — React hook for the 7-state agent UI machine.
 *
 * Wraps the state machine with the Zustand agent store so that
 * phase transitions are validated before being applied.
 */

import { useCallback, useMemo } from "react";
import { useAgentStore } from "./store";
import {
  type AgentStateConfig,
  type AgentTransitionEvent,
  canTransition,
  getStateConfig,
  getValidEvents,
  resolveTransition,
} from "./state-machine";
import type { AgentPhase } from "./types";

export interface UseAgentPhaseReturn {
  /** Current phase */
  phase: AgentPhase;
  /** Config (color, label, animation) for the current phase */
  config: AgentStateConfig;
  /** Whether the agent is in an active (non-idle) phase */
  isActive: boolean;
  /** Whether the agent is in a phase that accepts user text input */
  acceptsInput: boolean;
  /** Attempt a phase transition. Returns true if successful. */
  transition: (event: AgentTransitionEvent) => boolean;
  /** Check if a transition event is valid from the current phase */
  canTransition: (event: AgentTransitionEvent) => boolean;
  /** All valid events from the current phase */
  validEvents: AgentTransitionEvent[];
  /** Whether an error overlay is active */
  hasError: boolean;
  /** Previous phase before error (for retry) */
  previousPhase: AgentPhase | null;
}

// Phases where the text input should be enabled
const INPUT_PHASES: Set<AgentPhase> = new Set(["idle", "clarify"]);

export function useAgentPhase(): UseAgentPhaseReturn {
  const phase = useAgentStore((s) => s.phase);
  const error = useAgentStore((s) => s.error);

  // We track the previous phase in a ref-like pattern via the store.
  // For now, derive it from the error state.
  const previousPhase = error?.recoverable ? phase : null;

  const config = useMemo(() => getStateConfig(phase), [phase]);
  const validEvents = useMemo(() => getValidEvents(phase), [phase]);

  const transition = useCallback(
    (event: AgentTransitionEvent): boolean => {
      const target = resolveTransition(phase, event);
      if (!target) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            `[AgentStateMachine] Invalid transition: ${phase} + ${event}`
          );
        }
        return false;
      }

      // Apply the phase change to the Zustand store
      useAgentStore.setState({ phase: target });
      return true;
    },
    [phase]
  );

  const canTransitionFn = useCallback(
    (event: AgentTransitionEvent): boolean => canTransition(phase, event),
    [phase]
  );

  return {
    phase,
    config,
    isActive: phase !== "idle",
    acceptsInput: INPUT_PHASES.has(phase),
    transition,
    canTransition: canTransitionFn,
    validEvents,
    hasError: error !== null,
    previousPhase,
  };
}
