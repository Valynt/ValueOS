/**
 * Billing API Router
 * Main router for all billing endpoints
 */

import express from 'express';
import subscriptionsRouter from './subscriptions.js'
import usageRouter from './usage.js'
import invoicesRouter from './invoices.js'
import summaryRouter from './summary.js'
import plansRouter from './plans.js'
import planChangeRouter from './plan-change.js'
import paymentMethodsRouter from './payment-methods.js'
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
  '/summary',
  requireAuth,
  tenantContextMiddleware(),
  tenantDbContextMiddleware(),
  requirePermission('billing.read'),
  summaryRouter
);
router.use(
  '/plans',
  requireAuth,
  tenantContextMiddleware(),
  tenantDbContextMiddleware(),
  requirePermission('billing.read'),
  plansRouter
);
router.use(
  '/plan-change',
  requireAuth,
  tenantContextMiddleware(),
  tenantDbContextMiddleware(),
  requirePermission('billing.manage'),
  planChangeRouter
);
router.use(
  '/payment-methods',
  requireAuth,
  tenantContextMiddleware(),
  tenantDbContextMiddleware(),
  requirePermission('billing.manage'),
  paymentMethodsRouter
);

export default router;
