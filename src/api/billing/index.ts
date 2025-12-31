/**
 * Billing API Router
 * Main router for all billing endpoints
 */

import express from 'express';
import subscriptionsRouter from './subscriptions';
import usageRouter from './usage';
import invoicesRouter from './invoices';
import webhooksRouter from './webhooks';
import { securityHeadersMiddleware } from '../../middleware/securityMiddleware';
import { serviceIdentityMiddleware } from '../../middleware/serviceIdentityMiddleware';
import { requirePermission } from '../../middleware/rbac';

const router = express.Router();

// Baseline protections applied to all billing routes
router.use(securityHeadersMiddleware);
router.use(serviceIdentityMiddleware);

// Public webhook endpoints (Stripe verification handles its own validation)
router.use('/webhooks', webhooksRouter);

// RBAC-protected billing routes
router.use('/subscription', requirePermission('billing.manage'), subscriptionsRouter);
router.use('/usage', requirePermission('billing.read'), usageRouter);
router.use('/invoices', requirePermission('billing.read'), invoicesRouter);

export default router;
