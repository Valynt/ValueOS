import { createNodeMiddleware, Webhooks } from '@octokit/webhooks';
import express from 'express';

import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

import { webhookHandlers } from './handlers.js';

const router = express.Router();

const webhooks = new Webhooks({
  secret: config.github.webhookSecret || 'development-secret',
});

webhooks.on('push', async ({ id, name, payload }) => {
  logger.info(`Received ${name} event`, { id });
  await webhookHandlers.push(payload);
});

webhooks.on('pull_request', async ({ id, name, payload }) => {
  logger.info(`Received ${name} event`, { id });
  await webhookHandlers.pull_request(payload);
});

webhooks.on('installation', async ({ id, name, payload }) => {
  logger.info(`Received ${name} event`, { id });
  await webhookHandlers.installation(payload);
});

webhooks.on('installation_repositories', async ({ id, name, payload }) => {
  logger.info(`Received ${name} event`, { id });
  await webhookHandlers.installation_repositories(payload);
});

webhooks.onError((error) => {
  logger.error('Webhook processing error', {
    error: error.message,
    name: error.name,
  });
});

// Full processing middleware for GitHub Webhooks
router.use(createNodeMiddleware(webhooks, { path: '/github' }));

// Health check for webhook endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'webhook handler healthy' });
});

export { router as webhookRouter };