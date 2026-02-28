/**
 * Invoice Service
 * Manages invoice storage and retrieval
 */

import { createLogger } from "../../lib/logger.js"
import { supabase } from '../../lib/supabase.js';
import { Invoice } from "../../types/billing";

import StripeService from "./StripeService.js"

const logger = createLogger({ component: "InvoiceService" });

class InvoiceService {
  private stripe: any;
  private stripeService: any;

  constructor() {
    // Initialize Stripe service only if billing is configured
    try {
      this.stripeService = StripeService.getInstance();
      this.stripe = this.stripeService.getClient();
    } catch (error) {
      logger.warn("Stripe service not available, billing features disabled");
      this.stripe = null;
      this.stripeService = null;
    }
  }

  /**
   * Store invoice from Stripe
   */
  async storeInvoice(stripeInvoice: any): Promise<Invoice> {
    if (!this.stripe || !supabase) {
      throw new Error("Billing service not configured");
    }
    try {
      logger.info("Storing invoice", { invoiceId: stripeInvoice.id });

      // Get customer
      const { data: customer } = await supabase
        .from("billing_customers")
        .select("*")
        .eq("stripe_customer_id", stripeInvoice.customer)
        .single();

      if (!customer) {
        throw new Error(`Customer not found: ${stripeInvoice.customer}`);
      }

      // Get subscription
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("stripe_subscription_id", stripeInvoice.subscription)
        .single();

      // Insert new invoice
      const { data, error } = await supabase
        .from("invoices")
        .insert({
          billing_customer_id: customer.id,
          tenant_id: customer.tenant_id,
          subscription_id: subscription?.id,
          stripe_invoice_id: stripeInvoice.id,
          stripe_customer_id: stripeInvoice.customer,
          invoice_number: stripeInvoice.number,
          invoice_pdf_url: stripeInvoice.invoice_pdf,
          hosted_invoice_url: stripeInvoice.hosted_invoice_url,
          amount_due: (stripeInvoice.amount_due ?? 0) / 100,
          amount_paid: (stripeInvoice.amount_paid ?? 0) / 100,
          amount_remaining: (stripeInvoice.amount_remaining ?? 0) / 100,
          subtotal: (stripeInvoice.subtotal ?? 0) / 100,
          tax: (stripeInvoice.tax ?? 0) / 100,
          total: (stripeInvoice.total ?? 0) / 100,
          currency: stripeInvoice.currency,
          status: stripeInvoice.status,
          period_start: stripeInvoice.period_start
            ? new Date(stripeInvoice.period_start * 1000).toISOString()
            : null,
          period_end: stripeInvoice.period_end
            ? new Date(stripeInvoice.period_end * 1000).toISOString()
            : null,
          due_date: stripeInvoice.due_date
            ? new Date(stripeInvoice.due_date * 1000).toISOString()
            : null,
          paid_at: stripeInvoice.status_transitions?.paid_at
            ? new Date(
                stripeInvoice.status_transitions.paid_at * 1000
              ).toISOString()
            : null,
          line_items: stripeInvoice.lines?.data || [],
          metadata: stripeInvoice.metadata || {},
        })
        .select()
        .single();

      if (error) {
        if ((error as any).code === "23505") {
          return this.updateInvoice(stripeInvoice);
        }
        throw error;
      }

      logger.info("Invoice stored", { invoiceId: stripeInvoice.id });

      return data;
    } catch (error) {
      logger.error(
        "Error storing invoice",
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  /**
   * Update existing invoice
   */
  async updateInvoice(stripeInvoice: any): Promise<Invoice> {
    return this.updateInvoiceWithCustomerStatus(stripeInvoice, null);
  }

  /**
   * Update existing invoice with optimistic concurrency control
   */
  async updateInvoiceWithCustomerStatus(
    stripeInvoice: any,
    customerStatus: string | null
  ): Promise<Invoice> {
    // Transaction boundary: RPC function runs in a single database transaction
    const { data: existing, error: fetchError } = await supabase
      .from("invoices")
      .select("version")
      .eq("stripe_invoice_id", stripeInvoice.id)
      .single();

    if (fetchError) {
      if ((fetchError as any).code !== "PGRST116") {
        throw fetchError;
      }
    }

    if (!existing) {
      throw new Error(`Invoice not found: ${stripeInvoice.id}`);
    }

    const { data, error } = await supabase.rpc(
      "update_invoice_and_customer_status",
      {
        p_stripe_invoice_id: stripeInvoice.id,
        p_invoice_number: stripeInvoice.number,
        p_invoice_pdf_url: stripeInvoice.invoice_pdf,
        p_hosted_invoice_url: stripeInvoice.hosted_invoice_url,
        p_amount_due: (stripeInvoice.amount_due ?? 0) / 100,
        p_amount_paid: (stripeInvoice.amount_paid ?? 0) / 100,
        p_amount_remaining: (stripeInvoice.amount_remaining ?? 0) / 100,
        p_subtotal: (stripeInvoice.subtotal ?? 0) / 100,
        p_tax: (stripeInvoice.tax ?? 0) / 100,
        p_total: (stripeInvoice.total ?? 0) / 100,
        p_status: stripeInvoice.status,
        p_paid_at: stripeInvoice.status_transitions?.paid_at
          ? new Date(
              stripeInvoice.status_transitions.paid_at * 1000
            ).toISOString()
          : null,
        p_line_items: stripeInvoice.lines?.data || [],
        p_expected_version: existing.version,
        p_customer_status: customerStatus,
        p_stripe_customer_id: stripeInvoice.customer,
      }
    );

    if (error) {
      if ((error as any).code === "40001") {
        throw new Error(
          `Invoice update conflict for stripe invoice ${stripeInvoice.id}`
        );
      }
      throw error;
    }

    if (!data) {
      throw new Error(`Invoice update failed for ${stripeInvoice.id}`);
    }

    return data;
  }

  /**
   * Get invoices for tenant
   */
  async getInvoices(
    tenantId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<Invoice[]> {
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return data || [];
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(invoiceId: string): Promise<Invoice | null> {
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (error && error.code !== "PGRST116") {
      logger.error("Error fetching invoice", error);
      throw error;
    }

    return data;
  }

  /**
   * Get upcoming invoice preview from Stripe
   */
  async getUpcomingInvoice(tenantId: string): Promise<any> {
    try {
      const { data: customer } = await supabase
        .from("billing_customers")
        .select("stripe_customer_id")
        .eq("tenant_id", tenantId)
        .single();

      if (!customer) {
        throw new Error("Customer not found");
      }

      const upcomingInvoice = await this.stripe.invoices.retrieveUpcoming({
        customer: customer.stripe_customer_id,
      });

      return upcomingInvoice;
    } catch (error) {
      return this.stripeService.handleError(error, "getUpcomingInvoice");
    }
  }

  /**
   * Download invoice PDF
   */
  async downloadInvoicePDF(invoiceId: string): Promise<string> {
    const invoice = await this.getInvoiceById(invoiceId);
    if (!invoice || !invoice.invoice_pdf) {
      throw new Error("Invoice PDF not available");
    }

    return invoice.invoice_pdf;
  }
}

export default new InvoiceService();
