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
  webhookEvents: new Map<
    string,
    {
      id: string;
      processed: boolean;
      status: string;
      retry_count?: number;
      next_retry_at?: string | null;
      idempotency_key?: string | null;
    }
  >(),
  billingCustomers: new Map<string, { tenant_id: string }>(),
  dlqInserts: [] as Array<Record<string, unknown>>,
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
          const row = { id: `row-${eventId}`, processed: false, status: "pending", retry_count: 0 };
          _db.webhookEvents.set(eventId, row);
          return {
            select: () => ({
              single: () => Promise.resolve({ data: row, error: null }),
            }),
          };
        });

      const update = vi.fn().mockImplementation((payload: Record<string, unknown>) => ({
        eq: vi.fn().mockImplementation((col: string, val: string) => {
          if (table === "webhook_events" && col === "stripe_event_id") {
            const existing = _db.webhookEvents.get(val) ?? {
              id: `row-${val}`,
              processed: false,
              status: "pending",
              retry_count: 0,
            };
            _db.webhookEvents.set(val, {
              ...existing,
              ...payload,
            });
          }
          return {
            eq: vi.fn().mockResolvedValue({ error: null }),
          };
        }),
      }));

      const select = vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation((_col: string, val: string) => ({
          single: vi.fn().mockImplementation(() => {
            if (table === "billing_customers") {
              const row = _db.billingCustomers.get(val);
              return Promise.resolve({ data: row ?? null, error: null });
            }
            if (table === "webhook_events") {
              return Promise.resolve({ data: _db.webhookEvents.get(val) ?? null, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          }),
        })),
      });

      const insert = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
        if (table === "webhook_dead_letter_queue") {
          _db.dlqInserts.push(payload);
        }
        return Promise.resolve({ error: null });
      });

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

vi.mock("../StripeService.js", () => ({
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
import { securityAuditService } from "../../post-v1/SecurityAuditService.js";

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
    _db.dlqInserts.length = 0;
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

  describe("tenant resolution retry and DLQ handling", () => {
    it("persists unresolved payment_succeeded events for retry with idempotency key and next attempt", async () => {
      const event = makeEvent("invoice.payment_succeeded", {
        id: "evt_pending_retry",
        data: { id: "in_pending", customer: "cus_missing", payment_intent: "pi_pending" },
      });
      event.request = { id: "req_1", idempotency_key: "idem_retry_1" };

      await expect(service.processEvent(event)).resolves.toBe(false);

      const stored = _db.webhookEvents.get("evt_pending_retry");
      expect(stored?.status).toBe("pending_retry");
      expect(stored?.retry_count).toBe(1);
      expect(stored?.idempotency_key).toBe("idem_retry_1");
      expect(typeof stored?.next_retry_at).toBe("string");
      expect(_db.dlqInserts).toHaveLength(0);
    });

    it("eventually transitions access mode after delayed tenant mapping becomes available", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-04-02T00:00:00.000Z"));
      const event = makeEvent("invoice.payment_succeeded", {
        id: "evt_delayed_mapping",
        data: { id: "in_delayed", customer: "cus_delayed", payment_intent: "pi_delayed" },
      });

      await expect(service.processEvent(event)).resolves.toBe(false);
      expect(_db.webhookEvents.get("evt_delayed_mapping")?.status).toBe("pending_retry");

      _db.billingCustomers.set("cus_delayed", { tenant_id: "tenant_delayed" });
      vi.advanceTimersByTime(70_000);

      await expect(service.processEvent(event)).resolves.toBe(false);

      const stored = _db.webhookEvents.get("evt_delayed_mapping");
      expect(stored?.status).toBe("processed");
      expect(stored?.processed).toBe(true);
      vi.useRealTimers();
    });

    it("moves event to DLQ and raises audit alert when retry threshold is exceeded", async () => {
      const event = makeEvent("invoice.payment_succeeded", {
        id: "evt_exhausted_retry",
        data: { id: "in_exhausted", customer: "cus_never_found", payment_intent: "pi_exhausted" },
      });

      _db.webhookEvents.set("evt_exhausted_retry", {
        id: "row-evt_exhausted_retry",
        processed: false,
        status: "pending_retry",
        retry_count: 5,
      });

      await expect(service.processEvent(event)).resolves.toBe(false);

      const stored = _db.webhookEvents.get("evt_exhausted_retry");
      expect(stored?.status).toBe("failed");
      expect(stored?.retry_count).toBe(6);
      expect(_db.dlqInserts).toHaveLength(1);
      expect(securityAuditService.logRequestEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "billing_webhook_retry_exhausted",
          eventType: "billing.webhook.retry_exhausted",
          severity: "high",
        })
      );
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
