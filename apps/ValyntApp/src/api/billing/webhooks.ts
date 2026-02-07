/**
 * Webhooks API
 * Stripe webhook endpoint
 */

import express, { Request, Response } from 'express';
import WebhookService from '../../services/billing/WebhookService';
import { createLogger } from '../../lib/logger';
import { recordStripeWebhook } from '../../metrics/billingMetrics';
import { getSupabaseConfig } from '../../lib/env';
import { requestSanitizationMiddleware } from '../../middleware/requestSanitizationMiddleware';

const router = express.Router();
const logger = createLogger({ component: 'WebhooksAPI' });

const withRequestContext = (req: Request, res: Response, meta?: Record<string, unknown>) => ({
  requestId: (req as any).requestId || res.locals.requestId,
  ...meta,
});

/**
 * POST /api/billing/webhooks/stripe
 * Stripe webhook handler
 */
router.post(
  '/stripe',
  requestSanitizationMiddleware({ skipBody: true }),
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    try {
      const { url, serviceRoleKey } = getSupabaseConfig();
      if (!url || !serviceRoleKey) {
        logger.warn(
          'Billing database configuration missing for webhook processing',
          withRequestContext(req, res)
        );
        return res.status(503).json({
          error: 'Billing database configuration is missing. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
        });
      }

      const signature = req.headers['stripe-signature'] as string;

      if (!signature) {
        return res.status(400).json({ error: 'Missing stripe-signature header' });
      }

      // Verify and construct event
      const event = WebhookService.verifySignature(req.body, signature);
      recordStripeWebhook(event.type, 'received');

      logger.info(
        'Webhook received',
        withRequestContext(req, res, {
          eventId: event.id,
          type: event.type,
        })
      );

      // Process event (async)
      WebhookService.processEvent(event).catch(error => {
        logger.error('Webhook processing failed', error, withRequestContext(req, res));
      });

      // Respond immediately
      res.json({ received: true, eventId: event.id });
    } catch (error: any) {
      logger.error('Webhook error', error, withRequestContext(req, res));
      res.status(400).json({ error: error.message });
    }
  }
);

export default router;
