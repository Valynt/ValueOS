/**
 * Billing Plans API
 * Provides available subscription plans
 */

import { createLogger } from '@shared/lib/logger';
import express, { Request, Response } from 'express';

import { PlanTier } from '../../config/billing.js';

const router = express.Router();
const logger = createLogger({ component: 'BillingPlansAPI' });

const withRequestContext = (req: Request, res: Response, meta?: Record<string, unknown>) => ({
  requestId: req.requestId || res.locals.requestId,
  ...meta,
});


interface PlanResponse {
  id: string;
  name: string;
  tier: PlanTier;
  description: string;
  price: number | null;
  currency: string;
  interval: string;
  features: string[];
  limits: {
    users: number;
    ai_tokens: number;
    api_calls: number;
    storage_gb: number;
  };
  custom_pricing?: boolean;
}

function getEligiblePlans(req: Request): PlanResponse[] {
  const roles = Array.isArray(req.user?.roles) ? req.user?.roles : [];
  const canAccessEnterprise = roles.includes('admin') || roles.includes('billing:enterprise');

  return AVAILABLE_PLANS.filter((plan) => {
    if (plan.tier !== 'enterprise') {
      return true;
    }

    return canAccessEnterprise;
  });
}

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
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const eligiblePlans = getEligiblePlans(req);

    res.json({
      plans: eligiblePlans,
      current_tenant_id: tenantId
    });
  } catch (error) {
    logger.error('Error fetching plans', error as Error, withRequestContext(req, res));
    res.status(500).json({ error: 'Failed to fetch plans' });
    return;
  }
});

/**
 * GET /api/billing/plans/:planId
 * Get specific plan details
 */
router.get('/:planId', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId;
    const planId = req.params.planId;

    if (!tenantId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const eligiblePlans = getEligiblePlans(req);
    const plan = eligiblePlans.find(p => p.id === planId);

    if (!plan) {
      logger.warn('Plan not found or not eligible for tenant', withRequestContext(req, res, { planId, tenantId }));
      res.status(404).json({ error: 'Plan not found' });
      return;
    }

    res.json(plan);
  } catch (error) {
    logger.error('Error fetching plan details', error as Error, withRequestContext(req, res));
    res.status(500).json({ error: 'Failed to fetch plan details' });
    return;
  }
});

export default router;
