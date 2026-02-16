/**
 * Payment Methods API
 * Manages payment methods for billing
 */

import express, { Request, Response } from 'express';
import StripeService from '../../services/billing/StripeService.js';
import CustomerService from '../../services/billing/CustomerService.js';
import { createLogger } from '@shared/lib/logger';

const router = express.Router();
const logger = createLogger({ component: 'PaymentMethodsAPI' });

const withRequestContext = (req: Request, res: Response, meta?: Record<string, unknown>) => ({
  requestId: (req as any).requestId || res.locals.requestId,
  ...meta,
});

interface CreatePaymentMethodRequest {
  type: 'card' | 'bank_account';
  card?: {
    number: string;
    exp_month: number;
    exp_year: number;
    cvc: string;
  };
  billing_details?: {
    name?: string;
    email?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country: string;
    };
  };
}

interface UpdatePaymentMethodRequest {
  billing_details?: {
    name?: string;
    email?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country: string;
    };
  };
}

/**
 * GET /api/billing/payment-methods
 * List payment methods for tenant
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get customer from tenant
    const customer = await CustomerService.getCustomerByTenantId(tenantId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Get payment methods from Stripe
    const paymentMethods = await StripeService.listPaymentMethods(customer.stripe_customer_id);

    res.json({
      payment_methods: paymentMethods.data.map(pm => ({
        id: pm.id,
        type: pm.type,
        card: pm.type === 'card' ? {
          brand: pm.card?.brand,
          last4: pm.card?.last4,
          exp_month: pm.card?.exp_month,
          exp_year: pm.card?.exp_year,
          country: pm.card?.country
        } : undefined,
        billing_details: pm.billing_details,
        is_default: pm.id === customer.default_payment_method,
        created: pm.created
      }))
    });
  } catch (error) {
    logger.error('Error listing payment methods', error as Error, withRequestContext(req, res));
    res.status(500).json({ error: 'Failed to list payment methods' });
  }
});

/**
 * POST /api/billing/payment-methods
 * Create new payment method
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { type, card, billing_details }: CreatePaymentMethodRequest = req.body;

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!type || (type === 'card' && !card)) {
      return res.status(400).json({ error: 'Payment method details required' });
    }

    // Get customer from tenant
    const customer = await CustomerService.getCustomerByTenantId(tenantId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Create payment method in Stripe
    const paymentMethod = await StripeService.createPaymentMethod({
      type,
      card,
      billing_details: {
        ...billing_details,
        email: billing_details?.email || customer.email,
        name: billing_details?.name || customer.name
      }
    });

    // Attach to customer
    await StripeService.attachPaymentMethod(customer.stripe_customer_id, paymentMethod.id);

    // If this is the first payment method, make it default
    const existingMethods = await StripeService.listPaymentMethods(customer.stripe_customer_id);
    if (existingMethods.data.length === 1) {
      await StripeService.updateCustomer(customer.stripe_customer_id, {
        default_payment_method: paymentMethod.id
      });
    }

    res.status(201).json({
      id: paymentMethod.id,
      type: paymentMethod.type,
      card: paymentMethod.type === 'card' ? {
        brand: paymentMethod.card?.brand,
        last4: paymentMethod.card?.last4,
        exp_month: paymentMethod.card?.exp_month,
        exp_year: paymentMethod.card?.exp_year
      } : undefined,
      billing_details: paymentMethod.billing_details,
      is_default: existingMethods.data.length === 1,
      created: paymentMethod.created
    });
  } catch (error) {
    logger.error('Error creating payment method', error as Error, withRequestContext(req, res));
    res.status(500).json({ error: 'Failed to create payment method' });
  }
});

/**
 * PUT /api/billing/payment-methods/:id
 * Update payment method
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const paymentMethodId = req.params.id;
    const { billing_details }: UpdatePaymentMethodRequest = req.body;

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get customer from tenant
    const customer = await CustomerService.getCustomerByTenantId(tenantId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Update payment method in Stripe
    const paymentMethod = await StripeService.updatePaymentMethod(paymentMethodId, {
      billing_details
    });

    res.json({
      id: paymentMethod.id,
      type: paymentMethod.type,
      billing_details: paymentMethod.billing_details,
      updated: true
    });
  } catch (error) {
    logger.error('Error updating payment method', error as Error, withRequestContext(req, res));
    res.status(500).json({ error: 'Failed to update payment method' });
  }
});

/**
 * DELETE /api/billing/payment-methods/:id
 * Delete payment method
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const paymentMethodId = req.params.id;

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get customer from tenant
    const customer = await CustomerService.getCustomerByTenantId(tenantId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Detach from customer (soft delete)
    await StripeService.detachPaymentMethod(paymentMethodId);

    res.json({ deleted: true });
  } catch (error) {
    logger.error('Error deleting payment method', error as Error, withRequestContext(req, res));
    res.status(500).json({ error: 'Failed to delete payment method' });
  }
});

/**
 * PUT /api/billing/payment-methods/:id/default
 * Set payment method as default
 */
router.put('/:id/default', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const paymentMethodId = req.params.id;

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get customer from tenant
    const customer = await CustomerService.getCustomerByTenantId(tenantId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Update default payment method
    await StripeService.updateCustomer(customer.stripe_customer_id, {
      default_payment_method: paymentMethodId
    });

    res.json({ default_payment_method: paymentMethodId });
  } catch (error) {
    logger.error('Error setting default payment method', error as Error, withRequestContext(req, res));
    res.status(500).json({ error: 'Failed to set default payment method' });
  }
});

export default router;
