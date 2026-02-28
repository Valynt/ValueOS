/**
 * Subscriptions API
 * Endpoints for managing subscriptions
 */

import express, { Request, Response } from "express";
import SubscriptionService from "../../services/billing/SubscriptionService.js";
import { PlanTier } from "../../config/billing.js";
import { createLogger } from "@shared/lib/logger";

const router = express.Router();
const logger = createLogger({ component: "SubscriptionsAPI" });

const withRequestContext = (req: Request, res: Response, meta?: Record<string, unknown>) => ({
  requestId: (req as any).requestId || res.locals.requestId,
  ...meta,
});

/**
 * GET /api/billing/subscription
 * Get current subscription
 */
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).tenantId;

    if (!tenantId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const subscription = await SubscriptionService.getActiveSubscription(tenantId);

    if (!subscription) {
      res.status(404).json({ error: "No active subscription found" });
      return;
    }

    res.json(subscription);
  } catch (error) {
    logger.error("Error fetching subscription", error as Error, withRequestContext(req, res));
    res.status(500).json({ error: "Failed to fetch subscription" });
    return;
  }
});

/**
 * POST /api/billing/subscription
 * Create new subscription
 */
router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).tenantId;
    const { planTier, trialDays } = req.body;
    const idempotencyKey = (req.headers["idempotency-key"] as string) || req.body.idempotencyKey;

    if (!tenantId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!planTier) {
      res.status(400).json({ error: "planTier is required" });
      return;
    }

    const subscription = await SubscriptionService.createSubscription(
      tenantId,
      planTier as PlanTier,
      trialDays,
      idempotencyKey
    );

    res.status(201).json(subscription);
  } catch (error) {
    logger.error("Error creating subscription", error as Error, withRequestContext(req, res));
    res.status(500).json({ error: "Failed to create subscription" });
    return;
  }
});

/**
 * PUT /api/billing/subscription
 * Update subscription (upgrade/downgrade)
 */
router.put("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).tenantId;
    const { planTier } = req.body;

    if (!tenantId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!planTier) {
      res.status(400).json({ error: "planTier is required" });
      return;
    }

    const subscription = await SubscriptionService.updateSubscription(
      tenantId,
      planTier as PlanTier
    );

    res.json(subscription);
  } catch (error) {
    logger.error("Error updating subscription", error as Error, withRequestContext(req, res));
    res.status(500).json({ error: "Failed to update subscription" });
    return;
  }
});

/**
 * DELETE /api/billing/subscription
 * Cancel subscription
 */
router.delete("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).tenantId;
    const { immediately } = req.query;

    if (!tenantId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const subscription = await SubscriptionService.cancelSubscription(
      tenantId,
      immediately === "true"
    );

    res.json(subscription);
  } catch (error) {
    logger.error("Error canceling subscription", error as Error, withRequestContext(req, res));
    res.status(500).json({ error: "Failed to cancel subscription" });
    return;
  }
});

/**
 * POST /api/billing/subscription/preview
 * Preview invoice for plan change
 */
router.post("/preview", async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).tenantId;
    const { planTier } = req.body;

    if (!tenantId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!planTier) {
      res.status(400).json({ error: "planTier is required" });
      return;
    }

    const preview = await SubscriptionService.previewSubscriptionChange(
      tenantId,
      planTier as PlanTier
    );

    res.json(preview);
  } catch (error) {
    logger.error("Error previewing subscription", error as Error, withRequestContext(req, res));
    res.status(500).json({ error: "Failed to preview subscription" });
    return;
  }
});

export default router;
