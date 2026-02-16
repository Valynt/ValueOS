/**
 * Plan Change API
 * Handles plan change preview and submission
 */

import express, { Request, Response } from 'express';
import SubscriptionService from '../../services/billing/SubscriptionService.js';
import BillingApprovalService from '../../services/billing/BillingApprovalService.js';
import { createLogger } from '@shared/lib/logger';
import { PlanTier } from '../../config/billing.js';

const router = express.Router();
const logger = createLogger({ component: 'PlanChangeAPI' });

const withRequestContext = (req: Request, res: Response, meta?: Record<string, unknown>) => ({
  requestId: (req as any).requestId || res.locals.requestId,
  ...meta,
});

interface PlanChangeRequest {
  new_plan_tier: PlanTier;
  effective_date?: string; // Optional, defaults to end of current period
  justification?: string;
}

/**
 * POST /api/billing/plan-change/preview
 * Preview plan change impact
 */
router.post('/preview', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { new_plan_tier, effective_date }: PlanChangeRequest = req.body;

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!new_plan_tier) {
      return res.status(400).json({ error: 'new_plan_tier is required' });
    }

    // Validate plan tier
    const validTiers: PlanTier[] = ['free', 'starter', 'professional', 'enterprise'];
    if (!validTiers.includes(new_plan_tier)) {
      return res.status(400).json({ error: 'Invalid plan tier' });
    }

    // Get current subscription
    const currentSubscription = await SubscriptionService.getActiveSubscription(tenantId);
    if (!currentSubscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    // If no change, return current state
    if (currentSubscription.plan_tier === new_plan_tier) {
      return res.json({
        current_plan: currentSubscription,
        new_plan: currentSubscription,
        changes: [],
        proration_amount: 0,
        effective_date: effective_date || currentSubscription.current_period_end,
        requires_approval: false
      });
    }

    // Simulate plan change
    const preview = await SubscriptionService.previewPlanChange(
      tenantId,
      new_plan_tier,
      effective_date
    );

    // Check if approval is required (enterprise plans)
    const requiresApproval = new_plan_tier === 'enterprise' ||
      (currentSubscription.plan_tier !== 'enterprise' && new_plan_tier === 'enterprise');

    res.json({
      ...preview,
      requires_approval: requiresApproval,
      approval_required_for: requiresApproval ? 'Enterprise tier changes require approval' : null
    });
  } catch (error) {
    logger.error('Error previewing plan change', error as Error, withRequestContext(req, res));
    res.status(500).json({ error: 'Failed to preview plan change' });
  }
});

/**
 * POST /api/billing/plan-change/submit
 * Submit plan change request
 */
router.post('/submit', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const userId = (req as any).userId;
    const { new_plan_tier, effective_date, justification }: PlanChangeRequest = req.body;

    if (!tenantId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!new_plan_tier) {
      return res.status(400).json({ error: 'new_plan_tier is required' });
    }

    // Get current subscription
    const currentSubscription = await SubscriptionService.getActiveSubscription(tenantId);
    if (!currentSubscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    // Check if change requires approval
    const requiresApproval = new_plan_tier === 'enterprise' ||
      (currentSubscription.plan_tier !== 'enterprise' && new_plan_tier === 'enterprise');

    if (requiresApproval) {
      // Create approval request
      const approvalRequest = await BillingApprovalService.createApprovalRequest(
        tenantId,
        'plan_upgrade',
        {
          current_plan: currentSubscription.plan_tier,
          new_plan: new_plan_tier,
          effective_date: effective_date || currentSubscription.current_period_end
        },
        userId,
        justification,
        0 // Estimated cost - could be calculated based on proration
      );

      return res.json({
        status: 'approval_required',
        approval_request_id: approvalRequest.id,
        message: 'Plan change requires approval. Request submitted for review.',
        approval_request: approvalRequest
      });
    } else {
      // Execute plan change directly
      const result = await SubscriptionService.changePlan(
        tenantId,
        new_plan_tier,
        effective_date
      );

      return res.json({
        status: 'completed',
        message: 'Plan change completed successfully',
        subscription: result
      });
    }
  } catch (error) {
    logger.error('Error submitting plan change', error as Error, withRequestContext(req, res));
    res.status(500).json({ error: 'Failed to submit plan change' });
  }
});

export default router;
