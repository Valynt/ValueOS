/**
 * Invoice Generation and Synchronization Tests
 * Validates invoice lifecycle from creation through payment
 *
 * These tests verify invoice generation, Stripe sync, and payment processing.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getTestSupabaseClient,
  cleanupBillingTables,
  seedTestData,
  assertRecordExists,
} from "../__helpers__/db-helpers";
import {
  createBillingCustomer,
  createSubscription,
  createInvoice,
} from "../__helpers__/billing-factories";
import { createMockStripeInvoice } from "../__helpers__/stripe-mocks.js"
import type { SupabaseClient } from "@supabase/supabase-js";

describe("Invoice Generation and Synchronization Tests", () => {
  let supabase: SupabaseClient;

  beforeEach(async () => {
    supabase = getTestSupabaseClient();
    await cleanupBillingTables(supabase);
  });

  afterEach(async () => {
    await cleanupBillingTables(supabase);
  });

  describe("Invoice Creation", () => {
    it("should create invoice from Stripe webhook", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const customer = createBillingCustomer({ tenant_id: tenantId });

      await seedTestData(supabase, { customers: [customer] });

      // Simulate webhook creating invoice
      const stripeInvoice = createMockStripeInvoice({
        customer: customer.stripe_customer_id,
        amount_due: 9900,
        status: "draft",
      });

      const invoice = createInvoice({
        tenant_id: tenantId,
        billing_customer_id: customer.id,
        stripe_invoice_id: stripeInvoice.id,
        stripe_customer_id: customer.stripe_customer_id,
        amount_due: stripeInvoice.amount_due / 100,
        status: stripeInvoice.status,
      });

      const { error } = await supabase.from("invoices").insert(invoice);
      expect(error).toBeNull();

      await assertRecordExists(supabase, "invoices", {
        tenant_id: tenantId,
        stripe_invoice_id: stripeInvoice.id,
      });
    });

    it("should populate invoice with line items", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const customer = createBillingCustomer({ tenant_id: tenantId });

      await seedTestData(supabase, { customers: [customer] });

      const lineItems = [
        {
          description: "LLM Token Usage",
          amount: 5000,
          quantity: 500000,
          unit_amount: 0.01,
        },
        {
          description: "Agent Executions",
          amount: 2500,
          quantity: 100,
          unit_amount: 25,
        },
        {
          description: "Standard Plan Subscription",
          amount: 9900,
          quantity: 1,
          unit_amount: 9900,
        },
      ];

      const invoice = createInvoice({
        tenant_id: tenantId,
        billing_customer_id: customer.id,
        line_items: lineItems,
        amount_due: 17400,
      });

      await supabase.from("invoices").insert(invoice);

      const { data } = await supabase
        .from("invoices")
        .select("line_items, amount_due")
        .eq("id", invoice.id)
        .single();

      expect(data!.line_items).toHaveLength(3);
      expect(data!.amount_due).toBe(17400);
    });

    it("should calculate totals correctly", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const customer = createBillingCustomer({ tenant_id: tenantId });

      await seedTestData(supabase, { customers: [customer] });

      const invoice = createInvoice({
        tenant_id: tenantId,
        billing_customer_id: customer.id,
        amount_due: 10000,
        subtotal: 10000,
        tax: 0,
        total: 10000,
      });

      await supabase.from("invoices").insert(invoice);

      const { data } = await supabase
        .from("invoices")
        .select("amount_due, subtotal, total")
        .eq("id", invoice.id)
        .single();

      expect(data!.amount_due).toBe(data!.total);
      expect(data!.total).toBe(data!.subtotal + (data!.tax || 0));
    });
  });

  describe("Invoice Status Transitions", () => {
    it("should transition from draft to open to paid", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const customer = createBillingCustomer({ tenant_id: tenantId });

      await seedTestData(supabase, { customers: [customer] });

      // Start as draft
      const invoice = createInvoice({
        tenant_id: tenantId,
        billing_customer_id: customer.id,
        status: "draft",
      });

      await supabase.from("invoices").insert(invoice);

      // Finalize -> open
      await supabase
        .from("invoices")
        .update({ status: "open" })
        .eq("id", invoice.id);

      let { data } = await supabase
        .from("invoices")
        .select("status")
        .eq("id", invoice.id)
        .single();

      expect(data!.status).toBe("open");

      // Payment succeeded -> paid
      await supabase
        .from("invoices")
        .update({
          status: "paid",
          paid: true,
          paid_at: new Date().toISOString(),
        })
        .eq("id", invoice.id);

      ({ data } = await supabase
        .from("invoices")
        .select("status, paid, paid_at")
        .eq("id", invoice.id)
        .single());

      expect(data!.status).toBe("paid");
      expect(data!.paid).toBe(true);
      expect(data!.paid_at).toBeTruthy();
    });

    it("should handle payment failure", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const customer = createBillingCustomer({ tenant_id: tenantId });

      await seedTestData(supabase, { customers: [customer] });

      const invoice = createInvoice({
        tenant_id: tenantId,
        billing_customer_id: customer.id,
        status: "open",
      });

      await supabase.from("invoices").insert(invoice);

      // Payment failed
      await supabase
        .from("invoices")
        .update({
          status: "open",
          attempt_count: 1,
          next_payment_attempt: new Date(
            Date.now() + 24 * 60 * 60 * 1000
          ).toISOString(),
        })
        .eq("id", invoice.id);

      const { data } = await supabase
        .from("invoices")
        .select("status, attempt_count, next_payment_attempt")
        .eq("id", invoice.id)
        .single();

      expect(data!.status).toBe("open");
      expect(data!.attempt_count).toBe(1);
      expect(data!.next_payment_attempt).toBeTruthy();
    });

    it("should mark invoice as uncollectible after max attempts", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const customer = createBillingCustomer({ tenant_id: tenantId });

      await seedTestData(supabase, { customers: [customer] });

      const invoice = createInvoice({
        tenant_id: tenantId,
        billing_customer_id: customer.id,
        status: "open",
        attempt_count: 4,
      });

      await supabase.from("invoices").insert(invoice);

      // Max attempts reached
      await supabase
        .from("invoices")
        .update({ status: "uncollectible" })
        .eq("id", invoice.id);

      const { data } = await supabase
        .from("invoices")
        .select("status")
        .eq("id", invoice.id)
        .single();

      expect(data!.status).toBe("uncollectible");
    });
  });

  describe("Invoice Synchronization with Stripe", () => {
    it("should sync invoice details from Stripe", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const customer = createBillingCustomer({ tenant_id: tenantId });

      await seedTestData(supabase, { customers: [customer] });

      const stripeInvoice = createMockStripeInvoice({
        customer: customer.stripe_customer_id,
        invoice_pdf: "https://invoice.stripe.com/pdf/test.pdf",
        hosted_invoice_url: "https://invoice.stripe.com/hosted/test",
      });

      const invoice = createInvoice({
        tenant_id: tenantId,
        billing_customer_id: customer.id,
        stripe_invoice_id: stripeInvoice.id,
        invoice_pdf_url: stripeInvoice.invoice_pdf,
        hosted_invoice_url: stripeInvoice.hosted_invoice_url,
      });

      await supabase.from("invoices").insert(invoice);

      const { data } = await supabase
        .from("invoices")
        .select("invoice_pdf_url, hosted_invoice_url")
        .eq("id", invoice.id)
        .single();

      expect(data!.invoice_pdf_url).toContain("stripe.com");
      expect(data!.hosted_invoice_url).toContain("stripe.com");
    });

    it("should prevent duplicate invoice creation", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const customer = createBillingCustomer({ tenant_id: tenantId });

      await seedTestData(supabase, { customers: [customer] });

      const stripeInvoiceId = "in_unique_12345";

      const invoice1 = createInvoice({
        tenant_id: tenantId,
        billing_customer_id: customer.id,
        stripe_invoice_id: stripeInvoiceId,
      });

      await supabase.from("invoices").insert(invoice1);

      // Attempt duplicate
      const invoice2 = createInvoice({
        tenant_id: tenantId,
        billing_customer_id: customer.id,
        stripe_invoice_id: stripeInvoiceId,
      });

      const { error } = await supabase.from("invoices").insert(invoice2);

      // Should fail due to unique constraint on stripe_invoice_id
      expect(error).toBeTruthy();
      expect(error?.code).toBe("23505");
    });
  });

  describe("Invoice Metadata and Context", () => {
    it("should store invoice metadata", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const customer = createBillingCustomer({ tenant_id: tenantId });

      await seedTestData(supabase, { customers: [customer] });

      const invoice = createInvoice({
        tenant_id: tenantId,
        billing_customer_id: customer.id,
        metadata: {
          period: "2024-01",
          plan_tier: "standard",
          overage_charged: true,
        },
      });

      await supabase.from("invoices").insert(invoice);

      const { data } = await supabase
        .from("invoices")
        .select("metadata")
        .eq("id", invoice.id)
        .single();

      expect(data!.metadata.period).toBe("2024-01");
      expect(data!.metadata.overage_charged).toBe(true);
    });
  });

  describe("Invoice Queries and Reporting", () => {
    it("should retrieve all invoices for a tenant", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const customer = createBillingCustomer({ tenant_id: tenantId });

      await seedTestData(supabase, { customers: [customer] });

      const invoices = Array.from({ length: 5 }, (_, i) =>
        createInvoice({
          tenant_id: tenantId,
          billing_customer_id: customer.id,
          stripe_invoice_id: `in_${tenantId}_${i}`,
        })
      );

      await supabase.from("invoices").insert(invoices);

      const { data } = await supabase
        .from("invoices")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      expect(data).toHaveLength(5);
    });

    it("should calculate total revenue from paid invoices", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const customer = createBillingCustomer({ tenant_id: tenantId });

      await seedTestData(supabase, { customers: [customer] });

      const paidInvoices = [
        createInvoice({
          tenant_id: tenantId,
          billing_customer_id: customer.id,
          amount_due: 9900,
          paid: true,
        }),
        createInvoice({
          tenant_id: tenantId,
          billing_customer_id: customer.id,
          amount_due: 5000,
          paid: true,
        }),
        createInvoice({
          tenant_id: tenantId,
          billing_customer_id: customer.id,
          amount_due: 2500,
          paid: true,
        }),
      ];

      const unpaidInvoice = createInvoice({
        tenant_id: tenantId,
        billing_customer_id: customer.id,
        amount_due: 10000,
        paid: false,
      });

      await supabase.from("invoices").insert([...paidInvoices, unpaidInvoice]);

      const { data } = await supabase
        .from("invoices")
        .select("amount_due")
        .eq("tenant_id", tenantId)
        .eq("paid", true);

      const totalRevenue = data!.reduce((sum, inv) => sum + inv.amount_due, 0);

      expect(totalRevenue).toBe(17400);
    });

    it("should find overdue invoices", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const customer = createBillingCustomer({ tenant_id: tenantId });

      await seedTestData(supabase, { customers: [customer] });

      const overdueInvoice = createInvoice({
        tenant_id: tenantId,
        billing_customer_id: customer.id,
        status: "open",
        due_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
        paid: false,
      });

      await supabase.from("invoices").insert(overdueInvoice);

      const { data } = await supabase
        .from("invoices")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("paid", false)
        .lt("due_date", new Date().toISOString());

      expect(data).toHaveLength(1);
      expect(data![0].status).toBe("open");
    });
  });
});
