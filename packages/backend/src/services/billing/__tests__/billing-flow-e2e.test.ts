/**
 * Billing flow end-to-end test (spec 4.2 — blocking)
 *
 * Validates the critical path: webhook received → event recorded idempotently
 * → duplicate detection → metric emission.
 *
 * Classified as BLOCKING in docs/testing/release-gates.md.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../WebhookPayloadStore.js", () => ({
  storeWebhookPayload: vi.fn().mockResolvedValue({ mode: "inline", rawPayload: {}, payloadRef: null }),
}));

vi.mock("../../../metrics/billingMetrics", () => {
  const mc = () => ({ labels: vi.fn().mockReturnValue({ inc: vi.fn() }), inc: vi.fn() });
  const mg = () => ({ labels: vi.fn().mockReturnValue({ set: vi.fn(), inc: vi.fn(), dec: vi.fn() }), set: vi.fn(), inc: vi.fn(), dec: vi.fn() });
  return {
    recordStripeWebhook: vi.fn(),
    recordInvoiceEvent: vi.fn(),
    recordBillingJobFailure: vi.fn(),
    recordWebhookUnresolvedTenant: vi.fn(),
    webhooksReceivedTotal: mc(),
    webhooksProcessedTotal: mc(),
    webhookProcessingFailuresTotal: mc(),
    webhookDlqSize: mg(),
    webhookReconciliationRunsTotal: mc(),
    webhookReconciliationFailuresTotal: mc(),
    webhookReconciliationDriftCount: mg(),
    billingWebhookExhaustedTotal: mc(),
    billingUsageRecordsUnaggregated: mg(),
    billingStripeSubmissionTotal: mc(),
  };
});

vi.mock("../../../config/billing.js", () => ({
  STRIPE_CONFIG: { secretKey: "sk_test_mock", webhookSecret: "whsec_mock", apiVersion: "2023-10-16" },
  getBillingSupabase: vi.fn().mockReturnValue(null),
}));

vi.mock("../StripeService.js", () => ({ default: { getInstance: vi.fn().mockReturnValue(null) } }));
vi.mock("../InvoiceService.js", () => ({
  default: {
    storeInvoice: vi.fn().mockResolvedValue(undefined),
    updateInvoiceWithCustomerStatus: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("../../../services/post-v1/SecurityAuditService.js", () => ({
  securityAuditService: { logRequestEvent: vi.fn().mockResolvedValue(undefined) },
}));

// Supabase mock: first upsert succeeds, subsequent ones simulate ON CONFLICT DO NOTHING
let _upsertCallCount = 0;
vi.mock("../../../lib/supabase.js", () => ({
  assertNotTestEnv: vi.fn(),
  supabase: {
    from: vi.fn().mockImplementation(() => ({
      upsert: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockImplementation(() => {
            _upsertCallCount++;
            if (_upsertCallCount === 1) {
              return Promise.resolve({ data: { id: "row-1", processed: false, status: "pending" }, error: null });
            }
            return Promise.resolve({ data: null, error: { code: "PGRST116", message: "no rows" } });
          }),
        }),
      })),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: "row-1", processed: true, status: "processed" }, error: null }),
        }),
      }),
    })),
  },
}));

// Use an unhandled event type so the default case fires (no DB queries beyond
// the idempotency insert and markEventProcessed update).
function makeEvent(id: string, type = "customer.updated") {
  return {
    id, type, object: "event" as const, api_version: "2023-10-16" as const,
    created: Math.floor(Date.now() / 1000),
    data: { object: { id: `obj_${id}`, object: "invoice", customer: "cus_test", amount_paid: 5000, currency: "usd", subscription: "sub_test", status: "paid", lines: { data: [] } } },
    livemode: false, pending_webhooks: 0, request: null,
  };
}

describe("Billing flow E2E — webhook idempotency and metric emission", () => {
  beforeEach(() => { _upsertCallCount = 0; });

  it("processes a new webhook event and returns isDuplicate=false", async () => {
    const { WebhookService } = await import("../WebhookService.js");
    const result = await new WebhookService().processWebhook(makeEvent("evt_e2e_001") as never);
    expect(result.isDuplicate).toBe(false);
    expect(result.processed).toBe(true);
  });

  it("detects duplicate webhook and returns isDuplicate=true", async () => {
    const { WebhookService } = await import("../WebhookService.js");
    const svc = new WebhookService();
    await svc.processWebhook(makeEvent("evt_e2e_002") as never);
    const second = await svc.processWebhook(makeEvent("evt_e2e_002") as never);
    expect(second.isDuplicate).toBe(true);
  });

  it("emits webhooks_received_total on every inbound event", async () => {
    const { webhooksReceivedTotal } = await import("../../../metrics/billingMetrics.js");
    const { WebhookService } = await import("../WebhookService.js");
    await new WebhookService().processWebhook(makeEvent("evt_e2e_003") as never);
    // event type is "customer.updated" (the default in makeEvent)
    expect((webhooksReceivedTotal as { labels: ReturnType<typeof vi.fn> }).labels)
      .toHaveBeenCalledWith({ event_type: "customer.updated" });
  });

  it("emits duplicate metric when same event received twice", async () => {
    const { recordStripeWebhook } = await import("../../../metrics/billingMetrics.js");
    const { WebhookService } = await import("../WebhookService.js");
    const svc = new WebhookService();
    await svc.processWebhook(makeEvent("evt_e2e_004") as never);
    await svc.processWebhook(makeEvent("evt_e2e_004") as never);
    expect(recordStripeWebhook).toHaveBeenCalledWith("customer.updated", "duplicate");
  });
});
