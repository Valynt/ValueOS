/**
 * Billing Plans API
 * Provides available subscription plans
 */

import express, { Request, Response } from 'express';
import { createLogger } from '@shared/lib/logger';
import { PlanTier } from '../../config/billing.js';

const router = express.Router();
const logger = createLogger({ component: 'BillingPlansAPI' });

const withRequestContext = (req: Request, res: Response, meta?: Record<string, unknown>) => ({
  requestId: (req as any).requestId || res.locals.requestId,
  ...meta,
});

// Available plans configuration
const AVAILABLE_PLANS = [
  {
    id: 'free',
    name: 'Free',
    tier: 'free' as PlanTier,
    description: 'Perfect for getting started',
    price: 0,
    currency: 'usd',
    interval: 'month',
    features: [
      '3 team members',
      '100 AI tokens per month',
      'Basic support',
      'Community access'
    ],
    limits: {
      users: 3,
      ai_tokens: 100,
      api_calls: 1000,
      storage_gb: 1
    }
  },
  {
    id: 'starter',
    name: 'Starter',
    tier: 'starter' as PlanTier,
    description: 'For small teams getting started',
    price: 29,
    currency: 'usd',
    interval: 'month',
    features: [
      '10 team members',
      '10,000 AI tokens per month',
      'Email support',
      'Basic integrations'
    ],
    limits: {
      users: 10,
      ai_tokens: 10000,
      api_calls: 50000,
      storage_gb: 10
    }
  },
  {
    id: 'professional',
    name: 'Professional',
    tier: 'professional' as PlanTier,
    description: 'For growing teams and businesses',
    price: 99,
    currency: 'usd',
    interval: 'month',
    features: [
      '50 team members',
      '100,000 AI tokens per month',
      'Priority support',
      'Advanced integrations',
      'Custom workflows'
    ],
    limits: {
      users: 50,
      ai_tokens: 100000,
      api_calls: 500000,
      storage_gb: 100
    }
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tier: 'enterprise' as PlanTier,
    description: 'For large organizations with custom needs',
    price: null, // Custom pricing
    currency: 'usd',
    interval: 'month',
    features: [
      'Unlimited team members',
      'Unlimited AI tokens',
      'Dedicated support',
      'Custom integrations',
      'Advanced security',
      'SLA guarantees'
    ],
    limits: {
      users: 1000, // Large number for unlimited
      ai_tokens: 1000000, // Large number for unlimited
      api_calls: 5000000, // Large number for unlimited
      storage_gb: 1000
    },
    custom_pricing: true
  }
];

/**
 * GET /api/billing/plans
 * Get available subscription plans
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // TODO: Filter plans based on tenant eligibility (e.g., enterprise plans may require approval)
    // For now, return all plans

    res.json({
      plans: AVAILABLE_PLANS,
      current_tenant_id: tenantId
    });
  } catch (error) {
    logger.error('Error fetching plans', error as Error, withRequestContext(req, res));
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

/**
 * GET /api/billing/plans/:planId
 * Get specific plan details
 */
router.get('/:planId', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const planId = req.params.planId;

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const plan = AVAILABLE_PLANS.find(p => p.id === planId);

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    res.json(plan);
  } catch (error) {
    logger.error('Error fetching plan details', error as Error, withRequestContext(req, res));
    res.status(500).json({ error: 'Failed to fetch plan details' });
  }
});

export default router;
