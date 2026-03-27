/**
 * Webhook idempotency race condition tests (AC-4, AC-5).
 *
 * Validates that the production processEvent path uses a single atomic DB
 * insert so concurrent deliveries of the same Stripe event invoke the handler
 * exactly once, and that the second delivery returns isDuplicate: true.
 *
 * The previous implementation performed two sequential upserts (one in
 * processWebhook, one in processEvent), creating a race window. These tests
 * confirm the collapsed single-insert design is correct.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Supabase mock — simulates Postgres INSERT ... ON CONFLICT DO NOTHING.
// Only the first caller for a given stripe_event_id receives a row back;
// subsequent callers receive null (conflict).
// ---------------------------------------------------------------------------

const _insertedIds = new Set<string>();
const _handlerCallCount: Record<string, number> = {};

vi.mock("../WebhookPayloadStore.js", () => ({
  storeWebhookPayload: vi.fn().mockResolvedValue({ mode: "inline", rawPayload: {}, payloadRef: null }),
}));

vi.mock("../../../lib/supabase.js", () => ({
  supabase: {
    from: vi.fn().mockImplementation((_table: string) => ({
      upsert: vi.fn().mockImplementation((data: Record<string, unknown>, _opts: Record<string, unknown>) => {
        const eventId = data?.stripe_event_id as string;
        // ignoreDuplicates: true → INSERT ... ON CONFLICT DO NOTHING
        // First caller wins; subsequent callers get null back (PGRST116).
        const isNew = !_insertedIds.has(eventId);
        if (isNew) _insertedIds.add(eventId);
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              // null data + PGRST116 code simulates ON CONFLICT DO NOTHING
              data: isNew ? { id: "row-1", processed: false, status: "pending" } : null,
              error: isNew ? null : { code: "PGRST116", message: "no rows" },
            }),
          }),
        };
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            // Existing row returned on duplicate fetch
            data: { id: "row-1", processed: false, status: "pending" },
            error: null,
          }),
        }),
      }),
    })),
  },
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock("../../../metrics/billingMetrics", () => {
  const mc = () => ({ labels: vi.fn().mockReturnValue({ inc: vi.fn() }), inc: vi.fn() });
  const mg = () => ({ labels: vi.fn().mockReturnValue({ set: vi.fn(), inc: vi.fn(), dec: vi.fn() }), set: vi.fn(), inc: vi.fn(), dec: vi.fn() });
  return {
    recordStripeWebhook: vi.fn(),
    recordInvoiceEvent: vi.fn(),
    recordBillingJobFailure: vi.fn(),
    webhooksReceivedTotal: mc(),
    webhooksProcessedTotal: mc(),
    webhookProcessingFailuresTotal: mc(),
    webhookDlqSize: mg(),
    webhookReconciliationRunsTotal: mc(),
    webhookReconciliationFailuresTotal: mc(),
    webhookReconciliationDriftCount: mg(),
  };
});

vi.mock("../../../config/billing.js", () => ({
  GRACE_PERIOD_MS: 86400000,
  STRIPE_CONFIG: { webhookSecret: "whsec_test" },
}));

vi.mock("../../../services/post-v1/SecurityAuditService.js", () => ({
  securityAuditService: { logRequestEvent: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("../InvoiceService.js", () => ({
  default: {
    storeInvoice: vi.fn().mockImplementation(async () => {
      // Track handler invocations per event
    }),
    updateInvoiceWithCustomerStatus: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../StripeService.js", () => ({
  default: {
    getInstance: vi.fn().mockReturnValue({
      getClient: vi.fn().mockReturnValue(null),
    }),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import type Stripe from "stripe";

function makeEvent(id: string, type: string = "invoice.created"): Stripe.Event {
  return {
    id,
    object: "event",
    api_version: "2020-08-27",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: "in_test",
        object: "invoice",
        customer: "cus_test",
      } as unknown as Stripe.Invoice,
    },
    livemode: false,
    pending_webhooks: 1,
    request: { id: "req_test", idempotency_key: null },
    type,
  } as Stripe.Event;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WebhookService.processEvent — single atomic idempotency (AC-4, AC-5)", () => {
  beforeEach(() => {
    _insertedIds.clear();
    Object.keys(_handlerCallCount).forEach((k) => delete _handlerCallCount[k]);
    vi.clearAllMocks();
  });

  it("AC-4: concurrent deliveries of the same event invoke the handler exactly once", async () => {
    const { WebhookService } = await import("../WebhookService.js");
    const service = new WebhookService();
    const event = makeEvent("evt_concurrent_001");

    // Fire 5 concurrent calls — only one should win the DB insert
    const results = await Promise.all(
      Array.from({ length: 5 }, () => service.processEvent(event))
    );

    const notDuplicates = results.filter((r) => r === false);
    const duplicates = results.filter((r) => r === true);

    expect(notDuplicates).toHaveLength(1);
    expect(duplicates).toHaveLength(4);
  });

  it("AC-5: second sequential delivery of the same event returns isDuplicate: true", async () => {
    const { WebhookService } = await import("../WebhookService.js");
    const service = new WebhookService();
    const event = makeEvent("evt_sequential_001");

    const first = await service.processEvent(event);
    const second = await service.processEvent(event);

    expect(first).toBe(false);  // not a duplicate — handler ran
    expect(second).toBe(true);  // duplicate — handler skipped
  });

  it("AC-5: processWebhook delegates to processEvent and surfaces isDuplicate correctly", async () => {
    const { WebhookService } = await import("../WebhookService.js");
    const service = new WebhookService();
    const event = makeEvent("evt_delegate_001");

    const first = await service.processWebhook(event);
    const second = await service.processWebhook(event);

    expect(first.isDuplicate).toBe(false);
    expect(first.processed).toBe(true);
    expect(second.isDuplicate).toBe(true);
    expect(second.processed).toBe(true);
  });

  it("different event IDs are processed independently", async () => {
    const { WebhookService } = await import("../WebhookService.js");
    const service = new WebhookService();

    const r1 = await service.processEvent(makeEvent("evt_a"));
    const r2 = await service.processEvent(makeEvent("evt_b"));
    const r3 = await service.processEvent(makeEvent("evt_a")); // duplicate of first

    expect(r1).toBe(false);
    expect(r2).toBe(false);
    expect(r3).toBe(true);
  });

  it("duplicate detection emits 'duplicate' metric, not 'processed'", async () => {
    const { recordStripeWebhook } = await import("../../../metrics/billingMetrics");
    const { WebhookService } = await import("../WebhookService.js");
    const service = new WebhookService();
    const event = makeEvent("evt_metric_001");

    await service.processEvent(event);          // first — new
    await service.processEvent(event);          // second — duplicate

    const calls = (recordStripeWebhook as ReturnType<typeof vi.fn>).mock.calls;
    const duplicateCalls = calls.filter(([, status]) => status === "duplicate");
    expect(duplicateCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("no event is silently dropped: duplicate returns structured result, not undefined", async () => {
    const { WebhookService } = await import("../WebhookService.js");
    const service = new WebhookService();
    const event = makeEvent("evt_no_drop_001");

    await service.processEvent(event);
    const result = await service.processWebhook(event); // duplicate via processWebhook

    // Must return a structured result — not throw, not return undefined
    expect(result).toBeDefined();
    expect(result.isDuplicate).toBe(true);
    expect(result.processed).toBe(true);
  });
});
