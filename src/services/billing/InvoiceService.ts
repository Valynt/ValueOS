/**
 * Invoice Service
 * Manages invoice storage and retrieval
 */

import { createClient } from '@supabase/supabase-js';
import StripeService from './StripeService';
import { Invoice } from '../../types/billing';
import { createLogger } from '../../lib/logger';

const logger = createLogger({ component: 'InvoiceService' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

class InvoiceService {
  private stripe = StripeService.getInstance().getClient();
  private stripeService = StripeService.getInstance();

  /**
   * Store invoice from Stripe
   */
  async storeInvoice(stripeInvoice: any): Promise<Invoice> {
    try {
      logger.info('Storing invoice', { invoiceId: stripeInvoice.id });

      // Get customer
      const { data: customer } = await supabase
        .from('billing_customers')
        .select('*')
        .eq('stripe_customer_id', stripeInvoice.customer)
        .single();

      if (!customer) {
        throw new Error(`Customer not found: ${stripeInvoice.customer}`);
      }

      // Check if invoice already exists
      const { data: existing } = await supabase
        .from('invoices')
        .select('id')
        .eq('stripe_invoice_id', stripeInvoice.id)
        .single();

      if (existing) {
        // Update existing
        return this.updateInvoice(stripeInvoice);
      }

      // Get subscription
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('stripe_subscription_id', stripeInvoice.subscription)
        .single();

      // Insert new invoice
      const { data, error } = await supabase
        .from('invoices')
        .insert({
          billing_customer_id: customer.id,
          tenant_id: customer.tenant_id,
          subscription_id: subscription?.id,
          stripe_invoice_id: stripeInvoice.id,
          stripe_customer_id: stripeInvoice.customer,
          invoice_number: stripeInvoice.number,
          invoice_pdf_url: stripeInvoice.invoice_pdf,
          hosted_invoice_url: stripeInvoice.hosted_invoice_url,
          amount_due: stripeInvoice.amount_due / 100,
          amount_paid: stripeInvoice.amount_paid / 100,
          amount_remaining: stripeInvoice.amount_remaining / 100,
          subtotal: stripeInvoice.subtotal / 100,
          tax: stripeInvoice.tax / 100,
          total: stripeInvoice.total / 100,
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
            ? new Date(stripeInvoice.status_transitions.paid_at * 1000).toISOString()
            : null,
          line_items: stripeInvoice.lines?.data || [],
          metadata: stripeInvoice.metadata || {},
        })
        .select()
        .single();

      if (error) throw error;

      logger.info('Invoice stored', { invoiceId: stripeInvoice.id });

      return data;
    } catch (error) {
      logger.error('Error storing invoice', error);
      throw error;
    }
  }

  /**
   * Update existing invoice
   */
  async updateInvoice(stripeInvoice: any): Promise<Invoice> {
    const { data, error } = await supabase
      .from('invoices')
      .update({
        invoice_number: stripeInvoice.number,
        invoice_pdf_url: stripeInvoice.invoice_pdf,
        hosted_invoice_url: stripeInvoice.hosted_invoice_url,
        amount_due: stripeInvoice.amount_due / 100,
        amount_paid: stripeInvoice.amount_paid / 100,
        amount_remaining: stripeInvoice.amount_remaining / 100,
        subtotal: stripeInvoice.subtotal / 100,
        tax: stripeInvoice.tax / 100,
        total: stripeInvoice.total / 100,
        status: stripeInvoice.status,
        paid_at: stripeInvoice.status_transitions?.paid_at 
          ? new Date(stripeInvoice.status_transitions.paid_at * 1000).toISOString()
          : null,
        line_items: stripeInvoice.lines?.data || [],
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_invoice_id', stripeInvoice.id)
      .select()
      .single();

    if (error) throw error;

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
      .from('invoices')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return data || [];
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(invoiceId: string): Promise<Invoice | null> {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('Error fetching invoice', error);
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
        .from('billing_customers')
        .select('stripe_customer_id')
        .eq('tenant_id', tenantId)
        .single();

      if (!customer) {
        throw new Error('Customer not found');
      }

      const upcomingInvoice = await this.stripe.invoices.retrieveUpcoming({
        customer: customer.stripe_customer_id,
      });

      return upcomingInvoice;
    } catch (error) {
      return this.stripeService.handleError(error, 'getUpcomingInvoice');
    }
  }

  /**
   * Download invoice PDF
   */
  async downloadInvoicePDF(invoiceId: string): Promise<string> {
    const invoice = await this.getInvoiceById(invoiceId);
    if (!invoice || !invoice.invoice_pdf_url) {
      throw new Error('Invoice PDF not available');
    }

    return invoice.invoice_pdf_url;
  }
}

export default new InvoiceService();
