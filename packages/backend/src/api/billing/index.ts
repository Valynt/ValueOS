/**
 * Billing API Router
 * Main router for all billing endpoints
 */

import express from 'express';
import subscriptionsRouter from './subscriptions.js'
import usageRouter from './usage.js'
import invoicesRouter from './invoices.js'
import webhooksRouter from './webhooks.js'
import { securityHeadersMiddleware } from '../../middleware/securityMiddleware.js'
import { serviceIdentityMiddleware } from '../../middleware/serviceIdentityMiddleware.js'
import { requirePermission } from '../../middleware/rbac.js'
import { requireAuth } from '../../middleware/auth.js'
import { tenantContextMiddleware } from '../../middleware/tenantContext.js'
import { tenantDbContextMiddleware } from '../../middleware/tenantDbContext.js'

const router = express.Router();

// Baseline protections applied to all billing routes
router.use(securityHeadersMiddleware);
router.use(serviceIdentityMiddleware);

// Public webhook endpoints (Stripe verification handles its own validation)
router.use('/webhooks', webhooksRouter);

// RBAC-protected billing routes
router.use(
  '/subscription',
  requireAuth,
  tenantContextMiddleware(),
  tenantDbContextMiddleware(),
  requirePermission('billing.manage'),
  subscriptionsRouter
);
router.use(
  '/usage',
  requireAuth,
  tenantContextMiddleware(),
  tenantDbContextMiddleware(),
  requirePermission('billing.read'),
  usageRouter
);
router.use(
  '/invoices',
  requireAuth,
  tenantContextMiddleware(),
  tenantDbContextMiddleware(),
  requirePermission('billing.read'),
  invoicesRouter
);

export default router;
