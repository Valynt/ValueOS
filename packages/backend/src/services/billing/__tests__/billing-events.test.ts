/**
 * Billing Events Type Tests
 *
 * Validates that billing event types are correctly structured
 * and can be used in discriminated union switches.
 */

import type {
  BillingEvent,
  BillingEventPayload,
  BillingEventType,
  MeterKey,
} from "@shared/types/billing-events";
import { describe, expect, it } from "vitest";

describe("Billing Event Types", () => {
  it("all event types are distinct strings", () => {
    const types: BillingEventType[] = [
      "billing.usage.recorded",
      "billing.subscription.changed",
      "billing.invoice.drafted",
      "billing.invoice.finalized",
      "billing.payment.status_updated",
      "billing.approval.requested",
      "billing.approval.decided",
      "billing.entitlement.snapshot_created",
      "billing.usage.cap_reached",
    ];

    const unique = new Set(types);
    expect(unique.size).toBe(types.length);
  });

  it("UsageRecorded event has correct shape", () => {
    const event: BillingEvent = {
      type: "billing.usage.recorded",
      payload: {
        tenantId: "t1",
        occurredAt: new Date().toISOString(),
        meterKey: "ai_tokens",
        quantity: 1000,
        idempotencyKey: "idem-1",
        dimensions: { model: "gpt-4" },
        sourceRef: "req-123",
      },
    };

    expect(event.type).toBe("billing.usage.recorded");
    expect(event.payload.meterKey).toBe("ai_tokens");
  });

  it("SubscriptionChanged event has before/after", () => {
    const event: BillingEvent = {
      type: "billing.subscription.changed",
      payload: {
        tenantId: "t1",
        before: { status: "active", priceVersionId: "pv1", planTier: "standard" },
        after: { status: "canceled", priceVersionId: "pv1", planTier: "standard" },
        effectiveAt: new Date().toISOString(),
        reason: "user_requested",
      },
    };

    expect(event.payload.before.status).toBe("active");
    expect(event.payload.after.status).toBe("canceled");
  });

  it("MeterKey type covers expected values", () => {
    const keys: MeterKey[] = [
      "ai_tokens",
      "api_calls",
      "llm_tokens",
      "agent_executions",
      "storage_gb",
      "user_seats",
    ];
    expect(keys).toHaveLength(6);
  });

  it("discriminated union switch is exhaustive for key types", () => {
    function handleEvent(event: BillingEvent): string {
      switch (event.type) {
        case "billing.usage.recorded":
          return `usage:${event.payload.meterKey}`;
        case "billing.subscription.changed":
          return `sub:${event.payload.after.status}`;
        case "billing.invoice.drafted":
          return `invoice:drafted`;
        case "billing.invoice.finalized":
          return `invoice:finalized`;
        case "billing.payment.status_updated":
          return `payment:${event.payload.status}`;
        case "billing.approval.requested":
          return `approval:requested`;
        case "billing.approval.decided":
          return `approval:${event.payload.status}`;
        case "billing.entitlement.snapshot_created":
          return `entitlement:created`;
        case "billing.usage.cap_reached":
          return `cap:${event.payload.meterKey}`;
        default: {
          // Exhaustiveness check — if this compiles, all cases are handled
          const _exhaustive: never = event;
          return _exhaustive;
        }
      }
    }

    const result = handleEvent({
      type: "billing.usage.recorded",
      payload: {
        tenantId: "t1",
        occurredAt: new Date().toISOString(),
        meterKey: "ai_tokens",
        quantity: 500,
        idempotencyKey: "k1",
      },
    });

    expect(result).toBe("usage:ai_tokens");
  });
});
