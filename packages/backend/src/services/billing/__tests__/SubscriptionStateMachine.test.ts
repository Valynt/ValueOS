/**
 * Subscription State Machine Tests
 *
 * Validates all valid transitions, terminal states, and invalid transition rejection.
 */

import { describe, expect, it } from "vitest";
import {
  InvalidTransitionError,
  SubscriptionStateMachine,
} from "../SubscriptionStateMachine";
import type { SubscriptionEvent } from "../SubscriptionStateMachine";
import type { SubscriptionStatus } from "@shared/types/billing-events";

describe("SubscriptionStateMachine", () => {
  // ========================================================================
  // Valid transitions
  // ========================================================================

  describe("valid transitions", () => {
    const cases: Array<[SubscriptionStatus, SubscriptionEvent, SubscriptionStatus]> = [
      // incomplete
      ["incomplete", "setup_completed", "active"],
      ["incomplete", "expired", "incomplete_expired"],
      ["incomplete", "canceled", "canceled"],

      // trialing
      ["trialing", "trial_ended", "active"],
      ["trialing", "payment_failed", "past_due"],
      ["trialing", "canceled", "canceled"],

      // active
      ["active", "payment_failed", "past_due"],
      ["active", "canceled", "canceled"],

      // past_due
      ["past_due", "payment_succeeded", "active"],
      ["past_due", "canceled", "canceled"],
      ["past_due", "payment_failed", "unpaid"],

      // unpaid
      ["unpaid", "payment_succeeded", "active"],
      ["unpaid", "canceled", "canceled"],
    ];

    it.each(cases)(
      "%s + %s → %s",
      (current, event, expected) => {
        expect(SubscriptionStateMachine.transition(current, event)).toBe(expected);
      }
    );
  });

  // ========================================================================
  // Terminal states
  // ========================================================================

  describe("terminal states", () => {
    it("canceled is terminal", () => {
      expect(SubscriptionStateMachine.isTerminal("canceled")).toBe(true);
      expect(SubscriptionStateMachine.validEvents("canceled")).toEqual([]);
    });

    it("incomplete_expired is terminal", () => {
      expect(SubscriptionStateMachine.isTerminal("incomplete_expired")).toBe(true);
      expect(SubscriptionStateMachine.validEvents("incomplete_expired")).toEqual([]);
    });

    it("active is not terminal", () => {
      expect(SubscriptionStateMachine.isTerminal("active")).toBe(false);
    });
  });

  // ========================================================================
  // Invalid transitions
  // ========================================================================

  describe("invalid transitions", () => {
    it("throws InvalidTransitionError for canceled + payment_succeeded", () => {
      expect(() =>
        SubscriptionStateMachine.transition("canceled", "payment_succeeded")
      ).toThrow(InvalidTransitionError);
    });

    it("throws for active + setup_completed (not a valid event for active)", () => {
      expect(() =>
        SubscriptionStateMachine.transition("active", "setup_completed")
      ).toThrow(InvalidTransitionError);
    });

    it("throws for incomplete_expired + any event", () => {
      const events: SubscriptionEvent[] = [
        "payment_succeeded",
        "payment_failed",
        "trial_ended",
        "canceled",
        "reactivated",
        "expired",
        "setup_completed",
      ];
      for (const event of events) {
        expect(() =>
          SubscriptionStateMachine.transition("incomplete_expired", event)
        ).toThrow(InvalidTransitionError);
      }
    });
  });

  // ========================================================================
  // canTransition
  // ========================================================================

  describe("canTransition", () => {
    it("returns true for valid transitions", () => {
      expect(SubscriptionStateMachine.canTransition("active", "canceled")).toBe(true);
    });

    it("returns false for invalid transitions", () => {
      expect(SubscriptionStateMachine.canTransition("canceled", "payment_succeeded")).toBe(false);
    });
  });

  // ========================================================================
  // validEvents
  // ========================================================================

  describe("validEvents", () => {
    it("returns correct events for active", () => {
      const events = SubscriptionStateMachine.validEvents("active");
      expect(events).toContain("payment_failed");
      expect(events).toContain("canceled");
      expect(events).not.toContain("setup_completed");
    });

    it("returns correct events for past_due", () => {
      const events = SubscriptionStateMachine.validEvents("past_due");
      expect(events).toContain("payment_succeeded");
      expect(events).toContain("canceled");
      expect(events).toContain("payment_failed");
    });
  });
});
