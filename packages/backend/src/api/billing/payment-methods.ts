/**
 * Payment Methods API
 * Manages payment methods for billing
 */

import { createLogger } from '@shared/lib/logger';
import express, { Request, Response } from 'express';

import { customerService as CustomerService } from '../../services/billing/CustomerService.js';
import { StripeService } from '../../services/billing/StripeService.js';

const router = express.Router();
const logger = createLogger({ component: 'PaymentMethodsAPI' });

const withRequestContext = (req: Request, res: Response, meta?: Record<string, unknown>) => ({
  requestId: (req as any).requestId || res.locals.requestId,
  ...meta,
});

function getStripeClient() {
  return StripeService.getInstance().getClient();
}

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
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).tenantId;

    if (!tenantId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const customer = await CustomerService.getCustomerByTenantId(tenantId);
    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    const stripe = getStripeClient();
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customer.stripe_customer_id,
      type: 'card',
    });

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
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).tenantId;
    const { type, card, billing_details }: CreatePaymentMethodRequest = req.body;

    if (!tenantId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!type || (type === 'card' && !card)) {
      res.status(400).json({ error: 'Payment method details required' });
      return;
    }

    const customer = await CustomerService.getCustomerByTenantId(tenantId);
    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    const stripe = getStripeClient();

    const paymentMethod = await stripe.paymentMethods.create({
      type: type === 'bank_account' ? 'us_bank_account' : type,
      card,
      billing_details: {
        ...billing_details,
        email: billing_details?.email || customer.email,
        name: billing_details?.name || customer.name
      }
    });

    await stripe.paymentMethods.attach(paymentMethod.id, {
      customer: customer.stripe_customer_id,
    });

    const existingMethods = await stripe.paymentMethods.list({
      customer: customer.stripe_customer_id,
      type: 'card',
    });
    if (existingMethods.data.length === 1) {
      await stripe.customers.update(customer.stripe_customer_id, {
        invoice_settings: { default_payment_method: paymentMethod.id },
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
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).tenantId;
    const paymentMethodId = req.params.id ?? "";
    const { billing_details }: UpdatePaymentMethodRequest = req.body;

    if (!tenantId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const customer = await CustomerService.getCustomerByTenantId(tenantId);
    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    const stripe = getStripeClient();
    const paymentMethod = await stripe.paymentMethods.update(paymentMethodId, {
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
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).tenantId;
    const paymentMethodId = req.params.id ?? "";

    if (!tenantId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const customer = await CustomerService.getCustomerByTenantId(tenantId);
    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    const stripe = getStripeClient();
    await stripe.paymentMethods.detach(paymentMethodId);

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
router.put('/:id/default', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).tenantId;
    const paymentMethodId = req.params.id ?? "";

    if (!tenantId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const customer = await CustomerService.getCustomerByTenantId(tenantId);
    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    const stripe = getStripeClient();
    await stripe.customers.update(customer.stripe_customer_id, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    res.json({ default_payment_method: paymentMethodId });
  } catch (error) {
    logger.error('Error setting default payment method', error as Error, withRequestContext(req, res));
    res.status(500).json({ error: 'Failed to set default payment method' });
  }
});

export default router;
