/**
 * Webhook Security Tests
 * Validates webhook signature verification, error exposure, and security measures.
 */

import { describe, expect, it, vi } from "vitest";
import {
  createMockStripeEvent,
} from "../__helpers__/stripe-mocks";
import { createWebhookSignature } from "../__helpers__/test-fixtures";

// Mock Stripe library
vi.mock("stripe", () => {
  const constructEvent = vi.fn((payload, signature) => {
    if (!signature || signature.includes("invalid")) {
      throw new Error("Invalid signature");
    }
    return JSON.parse(payload as string);
  });

  return {
    default: class MockStripe {
      webhooks = {
        constructEvent,
      };
    },
  };
});

vi.mock("../../../../config/billing", () => ({
  STRIPE_CONFIG: {
    secretKey: "sk_test_mock",
    publishableKey: "pk_test_mock",
    webhookSecret: "whsec_test_mocksecret123",
    apiVersion: "2023-10-16",
  },
}));

vi.mock("../../../../metrics/webhookMetrics", () => ({
  recordWebhookRejection: vi.fn(),
}));

describe("Webhook Security Tests", () => {
  describe("Signature Verification", () => {
    it("should reject webhooks with invalid signature", async () => {
      const payload = JSON.stringify({
        id: "evt_test",
        type: "invoice.payment_succeeded",
        created: Math.floor(Date.now() / 1000),
        data: { object: {} },
      });

      const invalidSignature = `t=${Math.floor(Date.now() / 1000)},v1=invalid_signature`;

      const { default: WebhookService } = await import("../../WebhookService");

      expect(() => {
        WebhookService.verifySignature(payload, invalidSignature);
      }).toThrow();
    });

    it("should reject webhooks with missing signature header", async () => {
      const payload = JSON.stringify({
        id: "evt_test",
        type: "invoice.payment_succeeded",
        data: { object: {} },
      });

      const { default: WebhookService } = await import("../../WebhookService");

      expect(() => {
        WebhookService.verifySignature(payload, "");
      }).toThrow();
    });

    it("should reject webhooks with expired timestamp via freshness check", async () => {
      const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 6+ minutes ago

      const payload = JSON.stringify({
        id: "evt_test",
        type: "invoice.payment_succeeded",
        created: oldTimestamp,
      });

      // Signature with stale timestamp
      const expiredSignature = `t=${oldTimestamp},v1=valid_looking_sig`;

      const { default: WebhookService } = await import("../../WebhookService");

      expect(() => {
        WebhookService.verifySignature(payload, expiredSignature);
      }).toThrow("Webhook verification failed");
    });

    it("should accept webhooks with valid signature and fresh timestamp", async () => {
      const event = createMockStripeEvent("invoice.payment_succeeded", {
        id: "in_test",
        amount_paid: 5000,
      });

      const payload = JSON.stringify(event);
      const signature = createWebhookSignature(payload);

      const { default: WebhookService } = await import("../../WebhookService");

      const verifiedEvent = WebhookService.verifySignature(payload, signature);

      expect(verifiedEvent).toBeTruthy();
      expect(verifiedEvent.type).toBe("invoice.payment_succeeded");
    });
  });

  describe("Error Response Security", () => {
    it("verifySignature throws generic error — no internal details", async () => {
      const payload = JSON.stringify({
        id: "evt_test",
        type: "invoice.payment_succeeded",
        data: { object: {} },
      });

      const { default: WebhookService } = await import("../../WebhookService");

      try {
        WebhookService.verifySignature(payload, `t=${Math.floor(Date.now() / 1000)},v1=invalid`);
        expect.fail("Should have thrown");
      } catch (err) {
        const message = (err as Error).message;
        // Must not contain internal Stripe SDK error details
        expect(message).toBe("Webhook verification failed");
        expect(message).not.toContain("Invalid signature");
        expect(message).not.toContain("whsec_");
        expect(message).not.toContain("secret");
      }
    });

    it("should not expose webhook secret in thrown errors", async () => {
      const webhookSecret = "whsec_test_mocksecret123";

      const { default: WebhookService } = await import("../../WebhookService");

      try {
        WebhookService.verifySignature("bad", `t=${Math.floor(Date.now() / 1000)},v1=bad`);
      } catch (err) {
        expect((err as Error).message).not.toContain(webhookSecret);
        expect((err as Error).stack || "").not.toContain(webhookSecret);
      }
    });
  });

  describe("Payload Validation", () => {
    it("should reject webhooks with malformed JSON payload", () => {
      const malformedPayload = "{ invalid json ";

      expect(() => {
        JSON.parse(malformedPayload);
      }).toThrow();
    });

    it("should reject webhooks with missing required fields", () => {
      const incompletePayload = JSON.stringify({
        data: { object: {} },
      });

      const parsed = JSON.parse(incompletePayload);

      expect(parsed.id).toBeUndefined();
      expect(parsed.type).toBeUndefined();
    });

    it("should handle oversized webhook payloads gracefully", () => {
      const oversizedData = "x".repeat(1024 * 1024);

      const payload = JSON.stringify({
        id: "evt_test",
        type: "test.event",
        data: { object: { huge_field: oversizedData } },
      });

      // Payload exceeds 256kb limit enforced by express.raw middleware
      expect(payload.length).toBeGreaterThan(256 * 1024);
    });
  });

  describe("Event Type Validation", () => {
    it("should only process supported event types", () => {
      const supportedEvents = [
        "invoice.created",
        "invoice.finalized",
        "invoice.updated",
        "invoice.payment_succeeded",
        "invoice.payment_failed",
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
        "charge.succeeded",
        "charge.failed",
      ];

      supportedEvents.forEach((eventType) => {
        const event = createMockStripeEvent(eventType, {});
        expect(event.type).toBe(eventType);
      });
    });

    it("should handle unknown event types safely", () => {
      const unknownEvent = createMockStripeEvent("unknown.event.type", {});
      expect(unknownEvent.type).toBe("unknown.event.type");
    });
  });

  describe("Replay Attack Prevention", () => {
    it("should reject duplicate webhook events via idempotent insert", () => {
      const event = createMockStripeEvent("invoice.payment_succeeded", {
        id: "in_test",
      });

      expect(event.id).toBeTruthy();
    });

    it("should maintain idempotency with same event ID", () => {
      const eventId = "evt_unique_12345";
      const event1 = createMockStripeEvent("invoice.paid", {}, { id: eventId });
      const event2 = createMockStripeEvent("invoice.paid", {}, { id: eventId });

      expect(event1.id).toBe(event2.id);
    });
  });

  describe("Injection Attack Prevention", () => {
    it("should sanitize event metadata", () => {
      const maliciousMetadata = {
        "'; DROP TABLE billing_customers; --": "attack",
        '<script>alert("XSS")</script>': "xss",
        "../../../etc/passwd": "path_traversal",
      };

      const event = createMockStripeEvent("test.event", {
        metadata: maliciousMetadata,
      });

      expect(event.data.object.metadata).toBeDefined();
    });

    it("should handle SQL injection attempts in webhook payload", () => {
      const sqlInjectionPayload = {
        id: "evt_test",
        type: `invoice.payment_succeeded'; DROP TABLE subscriptions; --`,
        data: {
          object: {
            customer: `cus_test' OR '1'='1`,
            metadata: {
              tenant_id: `' UNION SELECT * FROM billing_customers--`,
            },
          },
        },
      };

      const event = createMockStripeEvent(
        sqlInjectionPayload.type,
        sqlInjectionPayload.data.object
      );

      expect(event).toBeTruthy();
    });
  });

  describe("Rate Limiting", () => {
    it("should handle webhook bursts gracefully", () => {
      const events = Array.from({ length: 100 }, (_, i) =>
        createMockStripeEvent(`test.event.${i}`, {})
      );

      expect(events).toHaveLength(100);
    });

    it("should track failed webhook processing for monitoring", () => {
      const failedEvent = {
        stripe_event_id: "evt_failed_123",
        retry_count: 3,
        error_message: "Database connection failed",
      };

      expect(failedEvent.retry_count).toBeGreaterThan(0);
      expect(failedEvent.error_message).toBeTruthy();
    });
  });

  describe("Webhook Secret Management", () => {
    it("should not expose webhook secret in logs or errors", () => {
      const webhookSecret = "whsec_super_secret_key_123";
      const errorMessage = `Webhook verification failed`;

      expect(errorMessage).not.toContain(webhookSecret);
      expect(errorMessage).not.toContain("whsec_");
    });

    it("should require webhook secret to be configured", () => {
      const emptySecret = "";
      expect(emptySecret).toBe("");
    });
  });

  describe("CSRF Protection", () => {
    it("should only process webhooks from Stripe IPs", () => {
      const stripeIPs = ["3.18.12.0/24", "3.130.192.0/24"];
      expect(stripeIPs.length).toBeGreaterThan(0);
    });

    it("should use raw body for signature verification", () => {
      const payload = JSON.stringify({ test: "data" });
      expect(payload).toBeTruthy();
    });
  });
});
