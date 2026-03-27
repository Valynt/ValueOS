/**
 * Billing API Router
 * Main router for all billing endpoints
 */

import express from 'express';

import { requireAuth, requireMFA } from '../../middleware/auth.js'
import { requirePermission } from '../../middleware/rbac.js'
import { securityHeadersMiddleware } from '../../middleware/securityMiddleware.js'
import { serviceIdentityMiddleware } from '../../middleware/serviceIdentityMiddleware.js'
import { tenantContextMiddleware } from '../../middleware/tenantContext.js'
import { tenantDbContextMiddleware } from '../../middleware/tenantDbContext.js'

import dlqRouter from './dlq.js'
import executionControlRouter from './execution-control.js'
import invoicesRouter from './invoices.js'
import overridesRouter from './overrides.js'
import paymentMethodsRouter from './payment-methods.js'
import planChangeRouter from './plan-change.js'
import plansRouter from './plans.js'
import subscriptionsRouter from './subscriptions.js'
import summaryRouter from './summary.js'
import usageRouter from './usage.js'
import webhooksRouter from './webhooks.js'


const router = express.Router();

// Baseline protections applied to all billing routes
router.use(securityHeadersMiddleware);
router.use(serviceIdentityMiddleware);

// Public webhook endpoints (Stripe verification handles its own validation)
router.use('/webhooks', webhooksRouter);

// Internal DLQ observability + replay (service identity required — enforced inside dlqRouter)
router.use('/dlq', dlqRouter);

// RBAC-protected billing routes
router.use(
  '/subscription',
  requireAuth,
  requireMFA,
  tenantContextMiddleware(),
  tenantDbContextMiddleware(),
  requirePermission('billing:manage'),
  subscriptionsRouter
);
router.use(
  '/usage',
  requireAuth,
  tenantContextMiddleware(),
  tenantDbContextMiddleware(),
  requirePermission('billing:read'),
  usageRouter
);
router.use(
  '/summary',
  requireAuth,
  tenantContextMiddleware(),
  tenantDbContextMiddleware(),
  requirePermission('billing:read'),
  summaryRouter
);
router.use(
  '/plans',
  requireAuth,
  tenantContextMiddleware(),
  tenantDbContextMiddleware(),
  requirePermission('billing:read'),
  plansRouter
);
router.use(
  '/plan-change',
  requireAuth,
  requireMFA,
  tenantContextMiddleware(),
  tenantDbContextMiddleware(),
  requirePermission('billing:manage'),
  planChangeRouter
);
router.use(
  '/payment-methods',
  requireAuth,
  requireMFA,
  tenantContextMiddleware(),
  tenantDbContextMiddleware(),
  requirePermission('billing:manage'),
  paymentMethodsRouter
);

router.use(
  '/execution-control',
  requireAuth,
  requireMFA,
  tenantContextMiddleware(),
  tenantDbContextMiddleware(),
  requirePermission('billing:manage'),
  executionControlRouter
);

// Overrides (custom pricing + cap increases) and reconciliation export.
// GET /billing/overrides/reconciliation is included in overridesRouter.
router.use(
  '/overrides',
  requireAuth,
  requireMFA,
  tenantContextMiddleware(),
  requirePermission('billing:manage'),
  overridesRouter
);

export default router;
