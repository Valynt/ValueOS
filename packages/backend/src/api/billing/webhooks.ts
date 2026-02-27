/**
 * Webhooks API
 * Stripe webhook endpoint with security hardening
 */

import express, { Request, Response } from 'express';
import WebhookService from '../../services/billing/WebhookService.js';
import { createLogger } from '@shared/lib/logger';
import { recordStripeWebhook } from '../../metrics/billingMetrics.js';
import { getSupabaseServerConfig } from '@shared/lib/env';

const router = express.Router();
const logger = createLogger({ component: 'WebhooksAPI' });

const WEBHOOK_PAYLOAD_LIMIT = '256kb';

const withRequestContext = (req: Request, res: Response, meta?: Record<string, unknown>) => ({
  requestId: (req as Record<string, unknown>).requestId || res.locals.requestId,
  ...meta,
});

/**
 * POST /api/billing/webhooks/stripe
 * Stripe webhook handler
 */
router.post(
  '/stripe',
  express.raw({ type: 'application/json', limit: WEBHOOK_PAYLOAD_LIMIT }),
  async (req: Request, res: Response) => {
    try {
      const { url, serviceRoleKey } = getSupabaseServerConfig();
      if (!url || !serviceRoleKey) {
        logger.warn(
          'Webhook processing unavailable: server credentials not configured',
          withRequestContext(req, res)
        );
        return res.status(503).json({ error: 'Service temporarily unavailable' });
      }

      const signature = req.headers['stripe-signature'] as string;

      if (!signature) {
        return res.status(400).json({ error: 'Bad request' });
      }

      let event;
      try {
        event = WebhookService.verifySignature(req.body, signature);
      } catch {
        return res.status(400).json({ error: 'Bad request' });
      }

      recordStripeWebhook(event.type, 'received');

      logger.info(
        'Webhook received',
        withRequestContext(req, res, {
          eventId: event.id,
          type: event.type,
        })
      );

      try {
        await WebhookService.processEvent(event);
      } catch (processingError) {
        logger.error(
          'Webhook processing failed',
          processingError instanceof Error ? processingError : undefined,
          withRequestContext(req, res, { eventId: event.id })
        );
        return res.status(503).json({ error: 'Service temporarily unavailable. Please retry.' });
      }

      res.json({ received: true, eventId: event.id });
    } catch (error: unknown) {
      logger.error(
        'Webhook unexpected error',
        error instanceof Error ? error : undefined,
        withRequestContext(req, res)
      );
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
