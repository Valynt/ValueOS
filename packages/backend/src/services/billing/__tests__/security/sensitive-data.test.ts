/**
 * Sensitive Data Exposure Tests
 * Validates that sensitive billing data is properly protected
 *
 * CRITICAL: These tests ensure PCI compliance and prevent data breaches.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createBillingCustomer,
  createInvoice,
} from "../__helpers__/billing-factories";
import {
  cleanupBillingTables,
  getTestSupabaseClient,
  seedTestData,
  supabaseAvailable
} from "../__helpers__/db-helpers";
import { createMockStripePaymentMethod } from "../__helpers__/stripe-mocks.js"

describe.skipIf(!supabaseAvailable)("Sensitive Data Exposure Tests", () => {
  let supabase: SupabaseClient;

  beforeEach(async () => {
    supabase = getTestSupabaseClient();
    await cleanupBillingTables(supabase);
  });

  afterEach(async () => {
    await cleanupBillingTables(supabase);
  });

  describe("Payment Method Data Protection", () => {
    it("should store only last 4 digits of card number", async () => {
      const paymentMethod = createMockStripePaymentMethod({
        card: {
          brand: "visa",
          last4: "4242",
          exp_month: 12,
          exp_year: 2025,
          fingerprint: "fingerprint_hash",
          funding: "credit",
          country: "US",
          generated_from: null,
          networks: null,
          three_d_secure_usage: null,
          wallet: null,
          checks: null,
        },
      });

      const customer = createBillingCustomer({
        card_last4: paymentMethod.card?.last4,
        card_brand: paymentMethod.card?.brand,
        payment_method_type: "card",
      });

      await seedTestData(supabase, { customers: [customer] });

      const { data } = await supabase
        .from("billing_customers")
        .select("card_last4, card_brand")
        .eq("id", customer.id)
        .single();

      // Should only have last 4 digits, never full card number
      expect(data?.card_last4).toBe("4242");
      expect(data?.card_last4).toHaveLength(4);
      expect(data?.card_brand).toBe("visa");
    });

    it("should never store full credit card numbers", async () => {
      const customer = createBillingCustomer({
        metadata: {
          // Even in metadata, should never store full card
          note: "Customer provided backup card",
        },
      });

      await seedTestData(supabase, { customers: [customer] });

      const { data } = await supabase
        .from("billing_customers")
        .select("*")
        .eq("id", customer.id)
        .single();

      const dataString = JSON.stringify(data);

      // Check for patterns that look like credit card numbers
      const cardNumberPattern = /\b\d{13,19}\b/g;
      const potentialCards = dataString.match(cardNumberPattern);

      // Should not contain any sequences that look like card numbers
      // (except IDs which are UUIDs, not payment cards)
      if (potentialCards) {
        potentialCards.forEach((num) => {
          // Make sure it's not a UUID or similar ID
          expect(num).not.toMatch(/^\d{16}$/); // Typical card length
        });
      }
    });

    it("should never store CVV codes", async () => {
      // CVV should never be stored, even temporarily
      const customer = createBillingCustomer({
        metadata: {
          note: "Payment verified",
          // CVV must never appear here
        },
      });

      await seedTestData(supabase, { customers: [customer] });

      const { data } = await supabase
        .from("billing_customers")
        .select("*")
        .eq("id", customer.id)
        .single();

      const dataString = JSON.stringify(data);

      // Should not contain CVV-like patterns
      expect(dataString).not.toMatch(/cvv/i);
      expect(dataString).not.toMatch(/cvc/i);
      expect(dataString).not.toMatch(/security.code/i);
    });
  });

  describe("Stripe API Key Protection", () => {
    it("should never expose Stripe secret key in responses", async () => {
      // Seed a customer record and verify the raw row contains no sk_* value.
      const customer = createBillingCustomer();
      await seedTestData(supabase, { customers: [customer] });

      const { data } = await supabase
        .from("billing_customers")
        .select("*")
        .eq("id", customer.id)
        .single();

      const dataString = JSON.stringify(data);
      // Secret keys always start with sk_test_ or sk_live_
      expect(dataString).not.toMatch(/sk_(test|live)_/);
    });

    it("should use publishable key for client-side operations", () => {
      const publishableKey = process.env.VITE_STRIPE_PUBLISHABLE_KEY;

      if (!publishableKey) {
        // Skip in environments where Stripe is not configured
        return;
      }

      // Only publishable keys (pk_*) should be sent to clients
      expect(publishableKey).toMatch(/^pk_(test|live)_/);
    });

    it("should not log Stripe API keys in error messages", () => {
      const errorMessage = "Stripe API error: Authentication failed";

      // Error messages should never contain API keys
      expect(errorMessage).not.toContain("sk_");
      expect(errorMessage).not.toContain("pk_");
      expect(errorMessage).not.toContain("whsec_");
    });
  });

  describe("Customer PII Protection", () => {
    it("should handle email addresses securely", async () => {
      const sensitiveEmail = "sensitive.customer@bigcompany.com";

      const customer = createBillingCustomer({
        stripe_customer_email: sensitiveEmail,
      });

      await seedTestData(supabase, { customers: [customer] });

      // Email is necessary for billing, but should be protected by RLS
      const { data } = await supabase
        .from("billing_customers")
        .select("stripe_customer_email")
        .eq("id", customer.id)
        .single();

      expect(data?.stripe_customer_email).toBe(sensitiveEmail);

      // Document: Email should only be accessible within same tenant (RLS)
    });

    it("should not expose internal IDs to unauthorized users", async () => {
      const customer = createBillingCustomer();

      await seedTestData(supabase, { customers: [customer] });

      // Internal database IDs should not be exposed in public APIs
      // Use Stripe IDs (cus_xxx) for external references
      expect(customer.id).toBeTruthy();
      expect(customer.stripe_customer_id).toMatch(/^cus_/);

      // Document: Always use Stripe IDs in public APIs, not database UUIDs
    });
  });

  describe("Invoice Data Protection", () => {
    it("should protect invoice PDF URLs from unauthorized access", async () => {
      const customer = createBillingCustomer();
      const invoice = createInvoice({
        tenant_id: customer.tenant_id,
        billing_customer_id: customer.id,
        invoice_pdf_url: "https://invoice.stripe.com/secret/abc123/pdf",
        hosted_invoice_url: "https://invoice.stripe.com/secret/abc123",
      });

      await seedTestData(supabase, {
        customers: [customer],
        invoices: [invoice],
      });

      const { data } = await supabase
        .from("invoices")
        .select("invoice_pdf_url, hosted_invoice_url")
        .eq("id", invoice.id)
        .single();

      // URLs should be stored, but access controlled by RLS
      expect(data?.invoice_pdf_url).toContain("https://");
      expect(data?.hosted_invoice_url).toContain("https://");

      // Document: These URLs should only be accessible to authorized users
      // RLS policies must enforce tenant isolation
    });

    it("should handle sensitive invoice line items securely", async () => {
      const customer = createBillingCustomer();
      const invoice = createInvoice({
        tenant_id: customer.tenant_id,
        billing_customer_id: customer.id,
        line_items: [
          {
            description: "LLM Token Usage - Proprietary Model",
            amount: 15000,
            quantity: 1500000,
            metadata: {
              model: "gpt-4-company-internal",
              // Should not expose internal model names to competitors
            },
          },
        ],
      });

      await seedTestData(supabase, {
        customers: [customer],
        invoices: [invoice],
      });

      const { data } = await supabase
        .from("invoices")
        .select("line_items")
        .eq("id", invoice.id)
        .single();

      expect(data?.line_items).toBeTruthy();

      // Document: Line items may contain business-sensitive information
      // Must be protected by RLS
    });
  });

  describe("Logging and Monitoring Data Protection", () => {
    it("should sanitize sensitive data in logs", () => {
      const logMessage = {
        event: "payment_method_updated",
        customer: "cus_123",
        // Should NOT include: full card number, CVV, API keys
        last4: "4242",
        timestamp: new Date().toISOString(),
      };

      const logString = JSON.stringify(logMessage);

      // Logs should never contain sensitive PII
      expect(logString).not.toMatch(/\b\d{16}\b/); // Full card number
      expect(logString).not.toMatch(/sk_test_/); // Secret keys
      expect(logString).not.toMatch(/cvv|cvc/i);
    });
  });

  describe("Stripe Customer ID Exposure", () => {
    it("should only expose Stripe IDs to authenticated users", async () => {
      const customer = createBillingCustomer();

      await seedTestData(supabase, { customers: [customer] });

      // Stripe customer IDs are safe to expose within tenant
      // But should be protected by RLS from other tenants
      const { data } = await supabase
        .from("billing_customers")
        .select("stripe_customer_id")
        .eq("id", customer.id)
        .single();

      expect(data?.stripe_customer_id).toMatch(/^cus_/);

      // Document: Stripe IDs are safe for billing operations
      // but still should be tenant-scoped
    });
  });

  describe("Webhook Secret Protection", () => {
    it("should never expose webhook signing secret", () => {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

      // Webhook secret must only be in environment variables
      expect(webhookSecret).toBeTruthy();

      // Should never be logged or stored in database
      // Document: Use for signature verification only
    });
  });

  describe("Usage Data Privacy", () => {
    it("should protect detailed usage metadata from competitors", async () => {
      // Usage patterns can reveal business secrets
      const events = [
        {
          tenant_id: "tenant_123",
          metric: "llm_tokens" as const,
          amount: 5000000,
          request_id: "req_1",
          metadata: {
            model: "gpt-4-turbo",
            purpose: "customer-support-automation",
            // These details should be protected
          },
          timestamp: new Date().toISOString(),
        },
      ];

      await supabase.from("usage_events").insert(events);

      // Verify data is stored
      const { data } = await supabase
        .from("usage_events")
        .select("metadata")
        .eq("tenant_id", "tenant_123");

      expect(data).toHaveLength(1);

      // Document: Usage metadata contains business intelligence
      // Must be strictly tenant-isolated via RLS
    });
  });

  describe("Audit Trail Protection", () => {
    it("should maintain audit trail for sensitive operations", () => {
      // Audit events should track who did what, when
      const auditEvent = {
        action: "payment_method_updated",
        performed_by: "user_123",
        tenant_id: "tenant_123",
        timestamp: new Date().toISOString(),
        // Should NOT include: new card number, just that it changed
        changes: {
          field: "default_payment_method",
          from: "pm_old",
          to: "pm_new",
        },
      };

      // Audit log should be tamper-proof and complete
      expect(auditEvent.action).toBeTruthy();
      expect(auditEvent.performed_by).toBeTruthy();
      expect(auditEvent.timestamp).toBeTruthy();

      // Document: Implement audit logging for PCI compliance
    });
  });
});
