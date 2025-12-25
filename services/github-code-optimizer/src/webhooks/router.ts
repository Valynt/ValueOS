import express from 'express';
import { webhookHandlers } from './handlers.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

interface WebhookPayload {
  action?: string;
  repository: any;
  sender: any;
  installation?: any;
  pull_request?: any;
  commits?: any[];
  after?: string;
  ref?: string;
}

// Simplified webhook handler for development
router.post('/github', express.json(), async (req, res) => {
  try {
    const event: WebhookPayload = req.body;
    const eventName = req.headers['x-github-event'] as string;

    logger.info('Received webhook', { eventName, action: event.action });

    if (webhookHandlers[eventName]) {
      await webhookHandlers[eventName](event);
      res.status(200).send('OK');
    } else {
      logger.warn('Unhandled webhook event', { eventName });
      res.status(200).send('Event ignored');
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