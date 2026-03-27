/**
 * WebhookService unit tests.
 *
 * Exercises the real WebhookService class: signature verification,
 * event routing, idempotency via Supabase upsert, and error handling.
 * All external I/O (Stripe SDK, Supabase, metrics, audit) is mocked.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted state shared between mock factories and test bodies
// ---------------------------------------------------------------------------
const _db = vi.hoisted(() => ({
  webhookEvents: new Map<string, { id: string; processed: boolean }>(),
  billingCustomers: new Map<string, { tenant_id: string }>(),
}));

const _stripe = vi.hoisted(() => ({
  constructEvent: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks — declared before any import of the module under test
// ---------------------------------------------------------------------------

vi.mock("../../../lib/supabase", () => ({
  supabase: {
    from: vi.fn().mockImplementation((table: string) => {
      // Simulate INSERT ... ON CONFLICT DO NOTHING (ignoreDuplicates: true).
      // When the stripe_event_id already exists the real DB returns zero rows,
      // which Supabase surfaces as data: null from .single().
      const upsert = vi
        .fn()
        .mockImplementation((data: Record<string, unknown>) => {
          const eventId = data?.stripe_event_id as string | undefined;
          if (!eventId) {
            return {
              select: () => ({
                single: () => Promise.resolve({ data: null, error: null }),
              }),
            };
          }
          const existing = _db.webhookEvents.get(eventId);
          if (existing) {
            // Conflict — ON CONFLICT DO NOTHING returns no rows
            return {
              select: () => ({
                single: () => Promise.resolve({ data: null, error: null }),
              }),
            };
          }
          const row = { id: `row-${eventId}`, processed: false };
          _db.webhookEvents.set(eventId, row);
          return {
            select: () => ({
              single: () => Promise.resolve({ data: row, error: null }),
            }),
          };
        });

      const update = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      const select = vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation((_col: string, val: string) => ({
          single: vi.fn().mockImplementation(() => {
            if (table === "billing_customers") {
              const row = _db.billingCustomers.get(val);
              return Promise.resolve({ data: row ?? null, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          }),
        })),
      });

      const insert = vi.fn().mockResolvedValue({ error: null });

      return { upsert, update, select, insert };
    }),
  },
}));

vi.mock("../../../config/billing", () => ({
  STRIPE_CONFIG: {
    secretKey: "sk_test_mock",
    publishableKey: "pk_test_mock",
    webhookSecret: "whsec_test_mock",
    apiVersion: "2023-10-16",
  },
  GRACE_PERIOD_MS: 7 * 24 * 60 * 60 * 1000,
}));

vi.mock("../../StripeService", () => ({
  default: {
    getInstance: vi.fn(() => ({
      getClient: () => ({
        webhooks: { constructEvent: _stripe.constructEvent },
      }),
    })),
  },
}));

vi.mock("../../../lib/logger", () => ({
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
    recordWebhookUnresolvedTenant: vi.fn(),
    webhooksReceivedTotal: mc(),
    webhooksProcessedTotal: mc(),
    webhookProcessingFailuresTotal: mc(),
    webhookDlqSize: mg(),
    webhookReconciliationRunsTotal: mc(),
    webhookReconciliationFailuresTotal: mc(),
    webhookReconciliationDriftCount: mg(),
  };
});

vi.mock("../../post-v1/SecurityAuditService", () => ({
  securityAuditService: {
    logRequestEvent: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../WebhookPayloadStore.js", () => ({
  storeWebhookPayload: vi.fn().mockResolvedValue({ mode: "inline", rawPayload: {}, payloadRef: null }),
}));

vi.mock("../InvoiceService", () => ({
  default: {
    storeInvoice: vi.fn().mockResolvedValue(undefined),
    updateInvoice: vi.fn().mockResolvedValue(undefined),
    updateInvoiceWithCustomerStatus: vi.fn().mockResolvedValue(undefined),
  },
}));

// ---------------------------------------------------------------------------
// Import module under test — after all mocks are registered
// ---------------------------------------------------------------------------
import { WebhookService } from "../WebhookService.js";
import {
  recordStripeWebhook,
  recordBillingJobFailure,
} from "../../../metrics/billingMetrics.js";
import InvoiceService from "../InvoiceService.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeEvent(
  type: string,
  opts: { id?: string; data?: Record<string, unknown> } = {}
) {
  return {
    id: opts.id ?? `evt_${Math.random().toString(36).slice(2, 9)}`,
    object: "event" as const,
    api_version: "2023-10-16" as const,
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type,
    data: {
      object: opts.data ?? {
        id: "in_test",
        customer: "cus_test",
        payment_intent: "pi_test",
      },
      previous_attributes: undefined,
    },
  } as import("stripe").default.Event;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("WebhookService", () => {
  let service: WebhookService;

  beforeEach(() => {
    _db.webhookEvents.clear();
    _db.billingCustomers.clear();
    vi.clearAllMocks();
    service = new WebhookService();
  });

  // -------------------------------------------------------------------------
  describe("verifySignature", () => {
    it("returns the Stripe.Event when the signature is valid", () => {
      const payload = '{"id":"evt_ok","type":"invoice.created"}';
      const sig = "t=1234,v1=abc";
      const fakeEvent = makeEvent("invoice.created", { id: "evt_ok" });
      _stripe.constructEvent.mockReturnValueOnce(fakeEvent);

      const result = service.verifySignature(payload, sig);

      expect(_stripe.constructEvent).toHaveBeenCalledWith(
        payload,
        sig,
        "whsec_test_mock"
      );
      expect(result).toBe(fakeEvent);
    });

    it("throws when the Stripe SDK rejects the signature", () => {
      _stripe.constructEvent.mockImplementationOnce(() => {
        throw new Error(
          "No signatures found matching the expected signature for payload"
        );
      });

      expect(() => service.verifySignature("payload", "bad-sig")).toThrow(
        "Webhook verification failed"
      );
    });
  });

  // -------------------------------------------------------------------------
  describe("processEvent — idempotency", () => {
    it("processes a new event and records success metric", async () => {
      const event = makeEvent("invoice.created");
      await service.processEvent(event);
      expect(recordStripeWebhook).toHaveBeenCalledWith(
        "invoice.created",
        "processed"
      );
    });

    it("skips processing when the event is already marked processed", async () => {
      const event = makeEvent("invoice.created", { id: "evt_dup" });
      _db.webhookEvents.set("evt_dup", { id: "row-evt_dup", processed: true });

      const isDuplicate = await service.processEvent(event);

      // Handler must not be called for a duplicate
      expect(InvoiceService.storeInvoice).not.toHaveBeenCalled();
      expect(isDuplicate).toBe(true);
      // Duplicate is explicitly recorded (not silently dropped)
      expect(recordStripeWebhook).toHaveBeenCalledWith(event.type, "duplicate");
    });
  });

  // -------------------------------------------------------------------------
  describe("processEvent — event routing", () => {
    it("routes invoice.created to InvoiceService.storeInvoice", async () => {
      const event = makeEvent("invoice.created", {
        data: { id: "in_1", customer: "cus_1" },
      });
      await service.processEvent(event);
      expect(InvoiceService.storeInvoice).toHaveBeenCalledWith(
        event.data.object
      );
    });

    it("routes invoice.finalized to InvoiceService.storeInvoice", async () => {
      const event = makeEvent("invoice.finalized", {
        data: { id: "in_2", customer: "cus_1" },
      });
      await service.processEvent(event);
      expect(InvoiceService.storeInvoice).toHaveBeenCalledWith(
        event.data.object
      );
    });

    it("routes invoice.payment_succeeded to InvoiceService.updateInvoiceWithCustomerStatus", async () => {
      const event = makeEvent("invoice.payment_succeeded", {
        data: { id: "in_3", customer: "cus_1", payment_intent: "pi_1" },
      });
      await service.processEvent(event);
      expect(
        InvoiceService.updateInvoiceWithCustomerStatus
      ).toHaveBeenCalledWith(event.data.object, "active");
    });

    it("routes invoice.payment_failed to InvoiceService.updateInvoice", async () => {
      const event = makeEvent("invoice.payment_failed", {
        data: { id: "in_4", customer: "cus_known" },
      });
      _db.billingCustomers.set("cus_known", { tenant_id: "tenant_abc" });
      await service.processEvent(event);
      expect(InvoiceService.updateInvoice).toHaveBeenCalledWith(
        event.data.object
      );
    });

    it("handles unknown event types without throwing", async () => {
      const event = makeEvent("some.unknown.event");
      await expect(service.processEvent(event)).resolves.not.toThrow();
      expect(recordStripeWebhook).toHaveBeenCalledWith(
        "some.unknown.event",
        "processed"
      );
    });
  });

  // -------------------------------------------------------------------------
  describe("processEvent — billing domain events", () => {
    it("emits billing.payment.status_updated with status succeeded on payment success", async () => {
      _db.billingCustomers.set("cus_emit", { tenant_id: "tenant_emit" });
      const received: unknown[] = [];
      service.onBillingEvent(e => received.push(e));

      const event = makeEvent("invoice.payment_succeeded", {
        data: { id: "in_6", customer: "cus_emit", payment_intent: "pi_4" },
      });
      await service.processEvent(event);

      expect(received).toHaveLength(1);
      const emitted = received[0] as {
        type: string;
        payload: { status: string };
      };
      expect(emitted.type).toBe("billing.payment.status_updated");
      expect(emitted.payload.status).toBe("succeeded");
    });

    it("emits billing.payment.status_updated with status failed on payment failure", async () => {
      _db.billingCustomers.set("cus_fail2", { tenant_id: "tenant_fail2" });
      const received: unknown[] = [];
      service.onBillingEvent(e => received.push(e));

      const event = makeEvent("invoice.payment_failed", {
        data: { id: "in_8", customer: "cus_fail2" },
      });
      await service.processEvent(event);

      const emitted = received.find(
        e => (e as { type: string }).type === "billing.payment.status_updated"
      ) as { payload: { status: string } } | undefined;
      expect(emitted?.payload.status).toBe("failed");
    });

    it("calls all registered listeners", async () => {
      _db.billingCustomers.set("cus_multi", { tenant_id: "tenant_multi" });
      const calls: string[] = [];
      service.onBillingEvent(() => calls.push("a"));
      service.onBillingEvent(() => calls.push("b"));

      const event = makeEvent("invoice.payment_succeeded", {
        data: {
          id: "in_multi",
          customer: "cus_multi",
          payment_intent: "pi_multi",
        },
      });
      await service.processEvent(event);

      expect(calls).toEqual(["a", "b"]);
    });

    it("continues emitting to remaining listeners if one throws", async () => {
      _db.billingCustomers.set("cus_err", { tenant_id: "tenant_err" });
      const calls: string[] = [];
      service.onBillingEvent(() => {
        throw new Error("listener error");
      });
      service.onBillingEvent(() => calls.push("reached"));

      const event = makeEvent("invoice.payment_succeeded", {
        data: { id: "in_err", customer: "cus_err", payment_intent: "pi_err" },
      });
      await service.processEvent(event);

      expect(calls).toContain("reached");
    });
  });

  // -------------------------------------------------------------------------
  describe("processEvent — error handling", () => {
    it("records failure metric and rethrows when a handler throws", async () => {
      vi.mocked(InvoiceService.storeInvoice).mockRejectedValueOnce(
        new Error("DB write failed")
      );
      const event = makeEvent("invoice.created");

      await expect(service.processEvent(event)).rejects.toThrow(
        "DB write failed"
      );
      expect(recordBillingJobFailure).toHaveBeenCalledWith(
        "stripe_webhook",
        "DB write failed"
      );
      expect(recordStripeWebhook).toHaveBeenCalledWith(
        "invoice.created",
        "failed"
      );
    });
  });

  // -------------------------------------------------------------------------
  describe("processWebhook (idempotency wrapper)", () => {
    it("returns isDuplicate: false for a new event", async () => {
      const event = makeEvent("invoice.created");
      const result = await service.processWebhook(event);
      expect(result.isDuplicate).toBe(false);
      expect(result.processed).toBe(true);
    });

    it("returns isDuplicate: true when the same event is submitted twice", async () => {
      const event = makeEvent("invoice.created", { id: "evt_idem" });
      await service.processWebhook(event);
      const second = await service.processWebhook(event);
      expect(second.isDuplicate).toBe(true);
    });
  });
});
