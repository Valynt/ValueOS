/**
 * Workflow State Machine
 *
 * Provides explicit workflow state management with validation
 * to prevent invalid state transitions and ensure workflow consistency.
 */

import { logger } from "../lib/logger";

export class WorkflowStateMachine {
  private validTransitions: Map<string, string[]> = new Map([
    ["created", ["started", "cancelled"]],
    ["started", ["completed", "failed", "paused"]],
    ["paused", ["resumed", "cancelled"]],
    ["resumed", ["completed", "failed", "paused"]],
    ["failed", ["retrying", "cancelled"]],
    ["retrying", ["completed", "failed"]],
    ["cancelled", []],
    ["completed", []],
  ]);

  /**
   * Check if a state transition is valid
   * @param currentState Current workflow state
   * @param nextState Proposed next state
   * @returns True if transition is valid, false otherwise
   */
  isValidTransition(currentState: string, nextState: string): boolean {
    if (currentState === nextState) {
      return true; // Allow no-op transitions
    }

    const validNextStates = this.validTransitions.get(currentState);
    return validNextStates?.includes(nextState) || false;
  }

  /**
   * Get all valid transitions from a given state
   * @param currentState Current workflow state
   * @returns Array of valid next states
   */
  getValidTransitions(currentState: string): string[] {
    return this.validTransitions.get(currentState) || [];
  }

  /**
   * Add a custom transition rule
   * @param fromState Source state
   * @param toState Destination state
   */
  addTransitionRule(fromState: string, toState: string): void {
    if (!this.validTransitions.has(fromState)) {
      this.validTransitions.set(fromState, []);
    }
    const currentTransitions = this.validTransitions.get(fromState) || [];
    if (!currentTransitions.includes(toState)) {
      currentTransitions.push(toState);
      this.validTransitions.set(fromState, currentTransitions);
    }
  }

  /**
   * Validate and execute a state transition
   * @param currentState Current workflow state
   * @param nextState Proposed next state
   * @param context Additional context for logging
   * @throws Error if transition is invalid
   */
  transitionWorkflow(currentState: string, nextState: string, context?: Record<string, unknown>): void {
    if (!this.isValidTransition(currentState, nextState)) {
      logger.error("Invalid workflow transition attempted", undefined, {
        currentState,
        nextState,
        validTransitions: this.getValidTransitions(currentState),
        ...context,
      });
      throw new Error(`Invalid workflow transition from ${currentState} to ${nextState}`);
    }

    logger.info("Workflow state transition", {
      currentState,
      nextState,
      ...context,
    });
  }

  /**
   * Get all defined states
   * @returns Array of all defined states
   */
  getAllStates(): string[] {
    return Array.from(this.validTransitions.keys());
  }
}

// Singleton instance
let workflowStateMachineInstance: WorkflowStateMachine | null = null;

/**
 * Get singleton instance of WorkflowStateMachine
 */
export function getWorkflowStateMachine(): WorkflowStateMachine {
  if (!workflowStateMachineInstance) {
    workflowStateMachineInstance = new WorkflowStateMachine();
  }
  return workflowStateMachineInstance;
}

/**
 * Reset singleton (for testing)
 */
export function resetWorkflowStateMachine(): void {
  workflowStateMachineInstance = null;
}

// Default export
export const workflowStateMachine = getWorkflowStateMachine();
