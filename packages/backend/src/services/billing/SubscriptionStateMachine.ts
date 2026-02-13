/**
 * Subscription State Machine
 *
 * Enforces valid subscription status transitions. Every transition
 * is validated before being applied. Invalid transitions throw.
 */

import type { SubscriptionStatus } from "@shared/types/billing-events";

// ============================================================================
// Events that trigger transitions
// ============================================================================

export type SubscriptionEvent =
  | "payment_succeeded"
  | "payment_failed"
  | "trial_ended"
  | "canceled"
  | "reactivated"
  | "expired"
  | "setup_completed";

// ============================================================================
// Transition table
// ============================================================================

/**
 * Maps (currentStatus, event) → nextStatus.
 * If a combination is not in the table, the transition is invalid.
 */
const TRANSITIONS: Record<string, Record<string, SubscriptionStatus>> = {
  incomplete: {
    setup_completed: "active",
    expired: "incomplete_expired",
    canceled: "canceled",
  },
  incomplete_expired: {
    // Terminal state — no valid transitions
  },
  trialing: {
    trial_ended: "active",
    payment_failed: "past_due",
    canceled: "canceled",
  },
  active: {
    payment_failed: "past_due",
    canceled: "canceled",
  },
  past_due: {
    payment_succeeded: "active",
    canceled: "canceled",
    payment_failed: "unpaid",
  },
  unpaid: {
    payment_succeeded: "active",
    canceled: "canceled",
  },
  canceled: {
    // Terminal state — no valid transitions
  },
};

// ============================================================================
// State machine
// ============================================================================

export class SubscriptionStateMachine {
  /**
   * Compute the next status given a current status and event.
   * Throws if the transition is invalid.
   */
  static transition(current: SubscriptionStatus, event: SubscriptionEvent): SubscriptionStatus {
    const stateTransitions = TRANSITIONS[current];
    if (!stateTransitions) {
      throw new InvalidTransitionError(current, event, `Unknown status '${current}'`);
    }

    const next = stateTransitions[event];
    if (!next) {
      throw new InvalidTransitionError(
        current,
        event,
        `No valid transition from '${current}' on event '${event}'`
      );
    }

    return next;
  }

  /**
   * Check if a transition is valid without throwing.
   */
  static canTransition(current: SubscriptionStatus, event: SubscriptionEvent): boolean {
    const stateTransitions = TRANSITIONS[current];
    if (!stateTransitions) return false;
    return event in stateTransitions;
  }

  /**
   * Get all valid events for a given status.
   */
  static validEvents(current: SubscriptionStatus): SubscriptionEvent[] {
    const stateTransitions = TRANSITIONS[current];
    if (!stateTransitions) return [];
    return Object.keys(stateTransitions) as SubscriptionEvent[];
  }

  /**
   * Check if a status is terminal (no outgoing transitions).
   */
  static isTerminal(status: SubscriptionStatus): boolean {
    return this.validEvents(status).length === 0;
  }
}

// ============================================================================
// Error
// ============================================================================

export class InvalidTransitionError extends Error {
  constructor(
    public readonly currentStatus: SubscriptionStatus,
    public readonly event: SubscriptionEvent,
    message: string
  ) {
    super(message);
    this.name = "InvalidTransitionError";
  }
}

export default SubscriptionStateMachine;
