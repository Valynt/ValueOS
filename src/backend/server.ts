/**
 * Backend Server for Billing API
 * Minimal Express server for secure billing operations
 */

import express from 'express';
import cors from 'cors';
import billingRouter from '../api/billing';
import documentRouter from '../api/documents';
import { createLogger } from '../lib/logger';
import { requestAuditMiddleware } from '../middleware/requestAuditMiddleware';

import { settings } from '../config/settings';

const logger = createLogger({ component: 'BillingServer' });

const app = express();
const PORT = settings.API_PORT;

// Middleware
app.use(cors({
  origin: settings.VITE_APP_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.raw({ type: 'application/json' })); // For Stripe webhooks
app.use(requestAuditMiddleware());

// Health check
app.get(
  '/health',
  (req: express.Request, res: express.Response): void => {
    res.json({ status: 'ok', service: 'billing-api' });
  }
);

// Mount billing routes
app.use('/api/billing', billingRouter);
app.use('/api/documents', documentRouter);

// Error handler
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ): void => {
    logger.error('Server error', err instanceof Error ? err : new Error(String(err)));
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
