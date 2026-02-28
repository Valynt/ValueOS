/**
 * Webhooks API
 * Stripe webhook endpoint with security hardening
 */

import { getSupabaseConfig } from '@shared/lib/env';
import { createLogger } from '@shared/lib/logger';
import express, { Request, Response } from 'express';

import { recordStripeWebhook } from '../../metrics/billingMetrics.js';
import WebhookService from '../../services/billing/WebhookService.js';


const router = express.Router();
const logger = createLogger({ component: 'WebhooksAPI' });

const WEBHOOK_PAYLOAD_LIMIT = '256kb';

const withRequestContext = (req: Request, res: Response, meta?: Record<string, unknown>) => ({
  requestId: (req as unknown as Record<string, unknown>).requestId || res.locals.requestId,
  ...meta,
});

/**
 * POST /api/billing/webhooks/stripe
 * Stripe webhook handler
 */
router.post(
  '/stripe',
  express.raw({ type: 'application/json', limit: WEBHOOK_PAYLOAD_LIMIT }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { url, serviceRoleKey } = getSupabaseConfig();
      if (!url || !serviceRoleKey) {
        logger.warn(
          'Webhook processing unavailable: server credentials not configured',
          withRequestContext(req, res)
        );
        res.status(503).json({ error: 'Service temporarily unavailable' });
        return;
      }

      const signature = req.headers['stripe-signature'] as string;

      if (!signature) {
        res.status(400).json({ error: 'Bad request' });
        return;
      }

      let event;
      try {
        event = WebhookService.verifySignature(req.body, signature);
      } catch {
        res.status(400).json({ error: 'Bad request' });
        return;
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
        res.status(503).json({ error: 'Service temporarily unavailable. Please retry.' });
        return;
      }

      res.json({ received: true, eventId: event.id });
    } catch (error: unknown) {
      logger.error(
        'Webhook unexpected error',
        error instanceof Error ? error : undefined,
        withRequestContext(req, res)
      );
      res.status(500).json({ error: 'Internal server error' });
      return;
    }
  }
);

export default router;
