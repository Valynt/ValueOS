/**
 * Customer Service
 * Manages Stripe customer creation and mapping to tenants
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import StripeService from './StripeService';
import { BillingCustomer } from '../../types/billing';
import { createLogger } from '../../lib/logger';

const logger = createLogger({ component: 'CustomerService' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseServiceRoleKey) {
  supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
} else {
  logger.warn('Supabase billing not configured: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing');
}

class CustomerService {
  private stripe = StripeService.getInstance().getClient();
  private stripeService = StripeService.getInstance();

  /**
   * Create Stripe customer and store mapping
   */
  async createCustomer(
    tenantId: string,
    organizationName: string,
    email: string,
    metadata?: Record<string, any>
  ): Promise<BillingCustomer> {
    try {
      if (!supabase) {
        throw new Error('Billing storage is not configured (Supabase env vars missing)');
      }
      logger.info('Creating Stripe customer', { tenantId, organizationName });

      // Check if customer already exists
      const existing = await this.getCustomerByTenantId(tenantId);
      if (existing) {
        logger.warn('Customer already exists', { tenantId });
        return existing;
      }

      // Create in Stripe
      const stripeCustomer = await this.stripe.customers.create({
        email,
        name: organizationName,
        metadata: {
          tenant_id: tenantId,
          ...metadata,
        },
      });

      // Store in database
      const { data, error } = await supabase
        .from('billing_customers')
        .insert({
          tenant_id: tenantId,
          organization_name: organizationName,
          stripe_customer_id: stripeCustomer.id,
          stripe_customer_email: email,
          status: 'active',
          metadata,
        })
        .select()
        .single();

      if (error) throw error;

      logger.info('Customer created successfully', { 
        tenantId, 
        stripeCustomerId: stripeCustomer.id 
      });

      return data;
    } catch (error) {
      return this.stripeService.handleError(error, 'createCustomer');
    }
  }

  /**
   * Get customer by tenant ID
   */
  async getCustomerByTenantId(tenantId: string): Promise<BillingCustomer | null> {
    if (!supabase) {
      throw new Error('Billing storage is not configured (Supabase env vars missing)');
    }
    const { data, error } = await supabase
      .from('billing_customers')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('Error fetching customer', error);
      throw error;
    }

    return data;
  }

  /**
   * Get customer by Stripe customer ID
   */
  async getCustomerByStripeId(stripeCustomerId: string): Promise<BillingCustomer | null> {
    if (!supabase) {
      throw new Error('Billing storage is not configured (Supabase env vars missing)');
    }
    const { data, error } = await supabase
      .from('billing_customers')
      .select('*')
      .eq('stripe_customer_id', stripeCustomerId)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('Error fetching customer', error);
      throw error;
    }

    return data;
  }

  /**
   * Update customer payment method
   */
  async updatePaymentMethod(
    tenantId: string,
    paymentMethodId: string
  ): Promise<BillingCustomer> {
    try {
      const customer = await this.getCustomerByTenantId(tenantId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Update in Stripe
      await this.stripe.customers.update(customer.stripe_customer_id, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      // Get payment method details
      const paymentMethod = await this.stripe.paymentMethods.retrieve(paymentMethodId);

      // Update in database
      const { data, error } = await supabase
        .from('billing_customers')
        .update({
          default_payment_method: paymentMethodId,
          payment_method_type: paymentMethod.type,
          card_last4: paymentMethod.card?.last4,
          card_brand: paymentMethod.card?.brand,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) throw error;

      logger.info('Payment method updated', { tenantId, paymentMethodId });

      return data;
    } catch (error) {
      return this.stripeService.handleError(error, 'updatePaymentMethod');
    }
  }

  /**
   * Update customer status
   */
  async updateCustomerStatus(
    tenantId: string,
    status: 'active' | 'suspended' | 'cancelled'
  ): Promise<BillingCustomer> {
    const { data, error } = await supabase
      .from('billing_customers')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    logger.info('Customer status updated', { tenantId, status });

    return data;
  }
}

export default new CustomerService();
