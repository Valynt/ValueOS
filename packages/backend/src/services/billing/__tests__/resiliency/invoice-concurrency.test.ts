import { describe, expect, it } from "vitest";

import {
  createBillingCustomer,
  createInvoice,
} from "../__helpers__/billing-factories";
import { setupTestDatabase } from "../__helpers__/db-helpers.js"

describe.skipIf(!supabaseAvailable)("Invoice concurrency safety", () => {
  const getSupabase = setupTestDatabase();

  it("prevents double inserts for the same Stripe invoice ID", async () => {
    const supabase = getSupabase();
    const customer = createBillingCustomer();

    await supabase.from("billing_customers").insert(customer);

    const invoiceA = createInvoice({
      billing_customer_id: customer.id,
      tenant_id: customer.tenant_id,
      stripe_customer_id: customer.stripe_customer_id,
      stripe_invoice_id: "in_conflict_1",
    });
    const invoiceB = createInvoice({
      billing_customer_id: customer.id,
      tenant_id: customer.tenant_id,
      stripe_customer_id: customer.stripe_customer_id,
      stripe_invoice_id: "in_conflict_1",
    });

    const [first, second] = await Promise.all([
      supabase.from("invoices").insert(invoiceA),
      supabase.from("invoices").insert(invoiceB),
    ]);

    const errors = [first.error, second.error].filter(Boolean);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.code).toBe("23505");
  });

  it("detects lost updates with optimistic concurrency control", async () => {
    const supabase = getSupabase();
    const customer = createBillingCustomer();

    await supabase.from("billing_customers").insert(customer);

    const invoice = createInvoice({
      billing_customer_id: customer.id,
      tenant_id: customer.tenant_id,
      stripe_customer_id: customer.stripe_customer_id,
      stripe_invoice_id: "in_conflict_2",
      status: "open",
    });

    await supabase.from("invoices").insert(invoice);

    const { data: stored } = await supabase
      .from("invoices")
      .select("version")
      .eq("stripe_invoice_id", invoice.stripe_invoice_id)
      .single();

    const updatePayload = {
      p_stripe_invoice_id: invoice.stripe_invoice_id,
      p_invoice_number: invoice.invoice_number,
      p_invoice_pdf_url: invoice.invoice_pdf_url,
      p_hosted_invoice_url: invoice.hosted_invoice_url,
      p_amount_due: invoice.amount_due,
      p_amount_paid: 100,
      p_amount_remaining: invoice.amount_remaining ?? 0,
      p_subtotal: invoice.subtotal ?? 0,
      p_tax: invoice.tax ?? 0,
      p_total: invoice.total ?? 0,
      p_status: "paid",
      p_paid_at: new Date().toISOString(),
      p_line_items: invoice.line_items ?? [],
      p_expected_version: stored?.version,
      p_customer_status: "active",
      p_stripe_customer_id: invoice.stripe_customer_id,
    };

    const [firstUpdate, secondUpdate] = await Promise.all([
      supabase.rpc("update_invoice_and_customer_status", updatePayload),
      supabase.rpc("update_invoice_and_customer_status", updatePayload),
    ]);

    const updateErrors = [firstUpdate.error, secondUpdate.error].filter(Boolean);
    expect(updateErrors).toHaveLength(1);
    expect(updateErrors[0]?.code).toBe("40001");

    const { data: refreshed } = await supabase
      .from("invoices")
      .select("version, status")
      .eq("stripe_invoice_id", invoice.stripe_invoice_id)
      .single();

    expect(refreshed?.version).toBe(2);
    expect(refreshed?.status).toBe("paid");
  });
});
