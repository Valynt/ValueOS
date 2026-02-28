import express from 'express';

import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

import { webhookHandlers } from './handlers.js';

const router = express.Router();

// Simplified webhook handler for development
router.post('/github', async (req, res) => {
  try {
    const eventName = req.headers['x-github-event'] as string;
    logger.info('Received webhook', { eventName, bodyType: typeof req.body });

    // For now, just acknowledge webhooks - full processing needs middleware fix
    if (eventName === 'ping') {
      logger.info('Ping webhook received - bot is reachable');
      res.status(200).send('OK');
    } else if (eventName === 'push') {
      logger.info('Push webhook received - analysis would start here');
      res.status(200).send('OK');
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