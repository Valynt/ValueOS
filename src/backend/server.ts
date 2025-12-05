/**
 * Backend Server for Billing API
 * Minimal Express server for secure billing operations
 */

import express from 'express';
import cors from 'cors';
import billingRouter from '../api/billing';
import agentsRouter from '../api/agents';
import workflowRouter from '../api/workflow';
import documentRouter from '../api/documents';
import { createLogger } from '../lib/logger';
import { createVersionedApiRouter } from './versioning';
import { requestAuditMiddleware } from '../middleware/requestAuditMiddleware';
import { latencyMetricsMiddleware, getLatencySnapshot } from '../middleware/latencyMetricsMiddleware';
import { getMetricsRegistry, metricsMiddleware } from '../middleware/metricsMiddleware';

import { settings } from '../config/settings';

const logger = createLogger({ component: 'BillingServer' });

const app = express();
const PORT = settings.API_PORT;
const apiRouter = createVersionedApiRouter();

// Middleware
app.use(cors({
  origin: settings.VITE_APP_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.raw({ type: 'application/json' })); // For Stripe webhooks
app.use(metricsMiddleware());
app.use(requestAuditMiddleware());
app.use(latencyMetricsMiddleware());

// Health check
app.get(
  '/health',
  (req: express.Request, res: express.Response): void => {
    res.json({ status: 'ok', service: 'billing-api' });
  }
);

// Prometheus metrics endpoint
app.get('/metrics', async (_req: express.Request, res: express.Response) => {
  const registry = getMetricsRegistry();
  res.set('Content-Type', registry.contentType);
  res.end(await registry.metrics());
});

// Latency metrics snapshot for dashboards
app.get('/metrics/latency', (_req, res) => {
  res.json({
    routes: getLatencySnapshot(),
    timestamp: new Date().toISOString(),
  });
});

// Mount billing routes with versioning support
apiRouter.use('/billing', billingRouter);
app.use('/api', apiRouter);

// Agent transparency and workflow explainability
app.use('/api/agents', agentsRouter);
app.use('/api', workflowRouter);
app.use('/api/documents', documentRouter);

// Error handler
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ): void => {
    logger.error('Server error', err instanceof Error ? err : new Error(String(err)), {
      requestId: res.locals.requestId,
    });
    const message =
      settings.NODE_ENV === 'development' && err instanceof Error ? err.message : undefined;
    res.status(500).json({
      error: 'Internal server error',
      message,
    });
  }
);

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Billing API server running on port ${PORT}`, {
      url: `http://localhost:${PORT}`,
      healthCheck: `http://localhost:${PORT}/health`,
    });
  });
}

export default app;
