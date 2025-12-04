/**
 * Webhooks API
 * Stripe webhook endpoint
 */

import express, { Request, Response } from 'express';
import WebhookService from '../../services/billing/WebhookService';
import { createLogger } from '../../lib/logger';

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
router.post('/stripe', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    // Verify and construct event
    const event = WebhookService.verifySignature(req.body, signature);
    
    logger.info(
      'Webhook received',
      withRequestContext(req, res, {
        eventId: event.id,
        type: event.type,
      })
    );

    // Process event (async)
    WebhookService.processEvent(event)
      .catch(error => {
        logger.error('Webhook processing failed', error, withRequestContext(req, res));
      });

    // Respond immediately
    res.json({ received: true, eventId: event.id });
  } catch (error: any) {
    logger.error('Webhook error', error, withRequestContext(req, res));
    res.status(400).json({ error: error.message });
  }
});

export default router;
