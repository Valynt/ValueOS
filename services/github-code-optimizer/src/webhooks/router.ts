import express from 'express';
import { createNodeMiddleware } from '@octokit/webhooks';
import { webhookHandlers } from './handlers.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// GitHub webhook middleware
if (config.github.webhookSecret) {
  const middleware = createNodeMiddleware(webhookHandlers, {
    secret: config.github.webhookSecret,
  });

  router.post('/github', middleware);
} else {
  // Fallback for development/testing without webhook secret
  logger.warn('GITHUB_WEBHOOK_SECRET not configured, webhook verification disabled');

  router.post('/github', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const event = JSON.parse(req.body.toString());
      const eventName = req.headers['x-github-event'] as string;

      if (webhookHandlers[eventName]) {
        await webhookHandlers[eventName]({ id: 'test', name: eventName, payload: event });
      }

      res.status(200).send('OK');
    } catch (error) {
      logger.error('Webhook processing error:', error);
      res.status(500).send('Internal server error');
    }
  });
}

// Health check for webhook endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'webhook handler healthy' });
});

export { router as webhookRouter };