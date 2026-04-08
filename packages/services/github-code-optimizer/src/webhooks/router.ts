import crypto from 'crypto';
import express from 'express';

import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

import { webhookHandlers } from './handlers.js';

const router = express.Router();
interface RawBodyRequest extends express.Request {
  rawBody?: Buffer;
}

// Middleware to verify GitHub webhook signature
const verifyGitHubSignature = (req: RawBodyRequest, res: express.Response, next: express.NextFunction) => {
  const signature = req.headers['x-hub-signature-256'] as string;
  const eventName = req.headers['x-github-event'] as string;

  if (!eventName) {
    logger.warn('Missing x-github-event header');
    res.status(400).send('Missing event header');
    return;
  }

  const secret = config.github.webhookSecret;
  if (secret) {
    if (!signature) {
      logger.warn('Missing webhook signature');
      res.status(401).send('Missing signature');
      return;
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      logger.error('Raw body not found for signature verification');
      res.status(500).send('Internal Server Error');
      return;
    }

    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(rawBody).digest('hex');

    try {
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
        logger.warn('Invalid webhook signature');
        res.status(401).send('Invalid signature');
        return;
      }
    } catch (e) {
      logger.warn('Error comparing signatures', { error: e });
      res.status(401).send('Invalid signature format');
      return;
    }
  } else {
    logger.warn('No webhook secret configured, skipping signature verification');
  }

  next();
};

// Webhook handler with full processing and dispatch
router.post('/github', verifyGitHubSignature, async (req, res) => {
  try {
    const eventName = req.headers['x-github-event'] as string;
    logger.info('Received webhook', { eventName, bodyType: typeof req.body });

    if (eventName === 'ping') {
      logger.info('Ping webhook received - bot is reachable');
      res.status(200).send('OK');
      return;
    }

    const handler = webhookHandlers[eventName];
    if (handler) {
      // Fire and forget, as analysis can take a long time and we shouldn't block GitHub's webhook timeout
      handler(req.body).catch((error) => {
        logger.error('Error processing webhook event in handler', {
          eventName,
          error: error instanceof Error ? error.message : String(error)
        });
      });
      res.status(200).send('Event accepted');
    } else {
      logger.warn('Unhandled webhook event', { eventName });
      res.status(200).send('Event acknowledged');
    }
  } catch (error) {
    logger.error('Webhook processing error:', error);
    res.status(500).send('Internal server error');
  }
});

// Health check for webhook endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'webhook handler healthy' });
});

export { router as webhookRouter };
