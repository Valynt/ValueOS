import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from './utils/logger.js';
import { webhookRouter } from './webhooks/router.js';
import { dashboardRouter } from './dashboard/router.js';
import { config } from './config/index.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API routes
app.use('/webhooks', webhookRouter);
app.use('/api', dashboardRouter);

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  logger.info(`GitHub Code Optimizer Bot running on port ${PORT}`);
  logger.info('Configuration:', {
    githubToken: config.github.token ? 'configured' : 'missing',
    openRouterKey: config.openRouter.apiKey ? 'configured' : 'missing',
    database: config.database.type
  });
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});