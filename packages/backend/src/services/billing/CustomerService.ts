/**
 * Customer Service
 * Manages Stripe customer creation and mapping to tenants
 */

import { SupabaseClient } from '@supabase/supabase-js';
import StripeService from './StripeService.js'
import { BillingCustomer } from '../../types/billing';
import { createLogger } from '../../lib/logger.js'
import { supabase as supabaseClient } from '../../lib/supabase.js';

const logger = createLogger({ component: 'CustomerService' });

const supabase: SupabaseClient | null = supabaseClient ?? null;

class CustomerService {
  private stripe: Stripe;
  private stripeService: StripeService;

  constructor() {
    // Initialize Stripe service only if billing is configured
    try {
      this.stripeService = StripeService.getInstance();
      this.stripe = this.stripeService.getClient();
    } catch (error) {
      logger.warn('Stripe service not available, billing features disabled');
      this.stripe = null as any;
      this.stripeService = null as any;
    }
  }

  /**
   * Create Stripe customer and store mapping
   */
  async createCustomer(
    tenantId: string,
    organizationName: string,
    email: string,
    metadata?: Record<string, any>
  ): Promise<BillingCustomer> {
    if (!this.stripe || !supabase) {
      throw new Error('Billing service not configured');
    }
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

  /**
   * Create a Stripe SetupIntent for collecting a payment method.
   * Returns the client_secret for frontend confirmation.
   */
  async createSetupIntent(tenantId: string): Promise<{ clientSecret: string; setupIntentId: string }> {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    const customer = await this.getCustomerByTenantId(tenantId);
    if (!customer) {
      throw new Error('Customer not found. Create customer first.');
    }

    const setupIntent = await this.stripe.setupIntents.create({
      customer: customer.stripe_customer_id,
      payment_method_types: ['card'],
      metadata: { tenant_id: tenantId },
    });

    logger.info('SetupIntent created', { tenantId, setupIntentId: setupIntent.id });

    return {
      clientSecret: setupIntent.client_secret!,
      setupIntentId: setupIntent.id,
    };
  }

  /**
   * List payment methods for a tenant from Stripe.
   */
  async listPaymentMethods(tenantId: string): Promise<Array<{
    id: string;
    type: string;
    card?: { brand: string; last4: string; exp_month: number; exp_year: number };
    is_default: boolean;
  }>> {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    const customer = await this.getCustomerByTenantId(tenantId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const methods = await this.stripe.paymentMethods.list({
      customer: customer.stripe_customer_id,
      type: 'card',
    });

    return methods.data.map((pm) => ({
      id: pm.id,
      type: pm.type,
      card: pm.card ? {
        brand: pm.card.brand,
        last4: pm.card.last4,
        exp_month: pm.card.exp_month,
        exp_year: pm.card.exp_year,
      } : undefined,
      is_default: pm.id === customer.default_payment_method,
    }));
  }
}

export default new CustomerService();
