/**
 * Plan Change API
 * Handles plan change preview and submission
 */

import { createLogger } from '@shared/lib/logger';
import express, { Request, Response } from 'express';

import { PlanTier } from '../../config/billing.js';
import { BillingApprovalService } from '../../services/billing/BillingApprovalService.js';
import SubscriptionService from '../../services/billing/SubscriptionService.js';
const billingApprovalService = new BillingApprovalService();

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
router.post('/preview', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).tenantId;
    const { new_plan_tier, effective_date }: PlanChangeRequest = req.body;

    if (!tenantId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!new_plan_tier) {
      res.status(400).json({ error: 'new_plan_tier is required' });
      return;
    }

    const validTiers: PlanTier[] = ['free', 'standard', 'enterprise'];
    if (!validTiers.includes(new_plan_tier)) {
      res.status(400).json({ error: 'Invalid plan tier' });
      return;
    }

    const currentSubscription = await SubscriptionService.getActiveSubscription(tenantId);
    if (!currentSubscription) {
      res.status(404).json({ error: 'No active subscription found' });
      return;
    }

    if (currentSubscription.plan_tier === new_plan_tier) {
      res.json({
        current_plan: currentSubscription,
        new_plan: currentSubscription,
        changes: [],
        proration_amount: 0,
        effective_date: effective_date || currentSubscription.current_period_end,
        requires_approval: false
      });
      return;
    }

    const requiresApproval = new_plan_tier === 'enterprise';

    res.json({
      current_plan: currentSubscription.plan_tier,
      new_plan: new_plan_tier,
      effective_date: effective_date || currentSubscription.current_period_end,
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
router.post('/submit', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).tenantId;
    const userId = (req as any).userId;
    const { new_plan_tier, effective_date, justification }: PlanChangeRequest = req.body;

    if (!tenantId || !userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!new_plan_tier) {
      res.status(400).json({ error: 'new_plan_tier is required' });
      return;
    }

    const currentSubscription = await SubscriptionService.getActiveSubscription(tenantId);
    if (!currentSubscription) {
      res.status(404).json({ error: 'No active subscription found' });
      return;
    }

    const requiresApproval = new_plan_tier === 'enterprise';

    if (requiresApproval) {
      const approvalRequest = await billingApprovalService.createApprovalRequest(
        tenantId,
        'plan_change',
        {
          current_plan: currentSubscription.plan_tier,
          new_plan: new_plan_tier,
          effective_date: effective_date || currentSubscription.current_period_end,
          justification,
        },
        userId,
        { estimatedCost: 0 }
      );

      res.json({
        status: 'approval_required',
        approval_request_id: approvalRequest.approval_id,
        message: 'Plan change requires approval. Request submitted for review.',
        approval_request: approvalRequest
      });
    } else {
      const updated = await SubscriptionService.changePlan(tenantId, new_plan_tier, {
        effectiveDate: effective_date,
        justification,
      });

      res.json({
        status: 'completed',
        message: 'Plan change completed successfully',
        subscription: updated,
        new_plan_tier: updated.plan_tier,
        effective_date: updated.current_period_start,
      });
    }
  } catch (error) {
    logger.error('Error submitting plan change', error as Error, withRequestContext(req, res));
    res.status(500).json({ error: 'Failed to submit plan change' });
  }
});

export default router;
