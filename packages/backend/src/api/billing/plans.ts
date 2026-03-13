/**
 * Billing Plans API
 * Returns plans the requesting tenant is eligible to see and upgrade to.
 */

import { createLogger } from '@shared/lib/logger';
import express, { Request, Response } from 'express';

import { PLANS, PlanTier } from '../../config/billing.js';
import { subscriptionService as SubscriptionService } from '../../services/billing/SubscriptionService.js';

const router = express.Router();
const logger = createLogger({ component: 'BillingPlansAPI' });

const withRequestContext = (req: Request, res: Response) => ({
  requestId: req.requestId || res.locals.requestId,
});

// Canonical tier ordering — used to determine upgrade eligibility.
const TIER_ORDER: PlanTier[] = ['free', 'standard', 'enterprise'];

/** Coerces an untrusted DB value to a valid PlanTier, defaulting to 'free'. */
function resolveTier(raw: string | null | undefined): PlanTier {
  return TIER_ORDER.includes(raw as PlanTier) ? (raw as PlanTier) : 'free';
}

/**
 * Returns plans the tenant is eligible to see:
 * - their current plan (always included)
 * - any plan at a higher tier
 * Enterprise is excluded unless the tenant already holds it or is on standard
 * (i.e. a free tenant cannot trigger an enterprise plan action).
 */
function eligiblePlans(currentTier: PlanTier) {
  const currentIndex = TIER_ORDER.indexOf(currentTier);
  return TIER_ORDER
    .filter((tier) => TIER_ORDER.indexOf(tier) >= currentIndex)
    .map((tier) => {
      const plan = PLANS[tier];
      return {
        id: tier,
        name: plan.name,
        tier,
        description: plan.description,
        price: plan.price,
        currency: 'usd',
        interval: plan.billingPeriod === 'monthly' ? 'month' : 'year',
        features: plan.features,
        limits: {
          user_seats: plan.quotas.user_seats,
          llm_tokens: plan.quotas.llm_tokens,
          agent_executions: plan.quotas.agent_executions,
          api_calls: plan.quotas.api_calls,
          storage_gb: plan.quotas.storage_gb,
        },
        is_current: tier === currentTier,
      };
    });
}

/**
 * GET /api/billing/plans
 * Returns plans available to the requesting tenant based on their current tier.
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const subscription = await SubscriptionService.getActiveSubscription(tenantId);
    const currentTier = resolveTier(subscription?.plan_tier);

    res.json({
      plans: eligiblePlans(currentTier),
      current_tier: currentTier,
    });
  } catch (error) {
    logger.error('Error fetching plans', error as Error, withRequestContext(req, res));
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

/**
 * GET /api/billing/plans/:planId
 * Returns a specific plan only if the tenant is eligible to see it.
 */
router.get('/:planId', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId;
    const planId = req.params.planId as PlanTier;

    if (!tenantId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!TIER_ORDER.includes(planId)) {
      res.status(404).json({ error: 'Plan not found' });
      return;
    }

    const subscription = await SubscriptionService.getActiveSubscription(tenantId);
    const currentTier = resolveTier(subscription?.plan_tier);
    const currentIndex = TIER_ORDER.indexOf(currentTier);
    const requestedIndex = TIER_ORDER.indexOf(planId);

    if (requestedIndex < currentIndex) {
      // Tenant is on a higher tier — do not expose lower-tier plan details
      // to avoid confusion or accidental downgrades via this endpoint.
      res.status(403).json({ error: 'Plan not available for your current tier' });
      return;
    }

    const plan = PLANS[planId];
    res.json({
      id: planId,
      name: plan.name,
      tier: planId,
      description: plan.description,
      price: plan.price,
      currency: 'usd',
      interval: plan.billingPeriod === 'monthly' ? 'month' : 'year',
      features: plan.features,
      limits: {
        user_seats: plan.quotas.user_seats,
        llm_tokens: plan.quotas.llm_tokens,
        agent_executions: plan.quotas.agent_executions,
        api_calls: plan.quotas.api_calls,
        storage_gb: plan.quotas.storage_gb,
      },
      is_current: planId === currentTier,
    });
  } catch (error) {
    logger.error('Error fetching plan details', error as Error, withRequestContext(req, res));
    res.status(500).json({ error: 'Failed to fetch plan details' });
  }
});

export default router;
