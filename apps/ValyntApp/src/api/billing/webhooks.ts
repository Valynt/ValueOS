/**
 * Webhooks API
 * Stripe webhook endpoint with security hardening
 */

import express, { Request, Response } from 'express';

import { getSupabaseServerConfig } from '../../lib/env';
import { createLogger } from '../../lib/logger';
import { recordStripeWebhook } from '../../metrics/billingMetrics';
import { recordWebhookRejection } from '../../metrics/webhookMetrics';
import { createRateLimiter } from '../../middleware/rateLimiter';
import { requestSanitizationMiddleware } from '../../middleware/requestSanitizationMiddleware';
import WebhookService from '../../services/billing/WebhookService';

const router = express.Router();
const logger = createLogger({ component: 'WebhooksAPI' });

/** Max raw body size for webhook payloads (256 KB). */
const WEBHOOK_PAYLOAD_LIMIT = '256kb';

/** Dedicated rate limiter for the webhook endpoint: IP-keyed, burst-tolerant. */
const webhookRateLimiter = createRateLimiter('standard', {
  windowMs: 60 * 1000,
  max: 120,
  message: 'Webhook rate limit exceeded. Retry later.',
  keyGenerator: (req: Request) => `webhook:ip:${req.ip || req.socket.remoteAddress || 'unknown'}`,
});

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
  requestSanitizationMiddleware({ skipBody: true }),
  express.raw({ type: 'application/json', limit: WEBHOOK_PAYLOAD_LIMIT }),
  webhookRateLimiter,
  async (req: Request, res: Response) => {
    try {
      // Validate server credentials are available
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
        recordWebhookRejection('missing_signature');
        return res.status(400).json({ error: 'Bad request' });
      }

      // Verify and construct event
      let event;
      try {
        event = WebhookService.verifySignature(req.body, signature);
      } catch {
        recordWebhookRejection('invalid_signature');
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

      // Persist event durably before acknowledging.
      // processEvent handles idempotent insert internally.
      try {
        await WebhookService.processEvent(event);
      } catch (processingError) {
        logger.error(
          'Webhook processing failed',
          processingError instanceof Error ? processingError : undefined,
          withRequestContext(req, res, { eventId: event.id })
        );
        recordWebhookRejection('persistence_failed');
        return res.status(503).json({ error: 'Service temporarily unavailable. Please retry.' });
      }

      res.json({ received: true, eventId: event.id });
    } catch (error: unknown) {
      // Catch-all: never leak internal details
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
