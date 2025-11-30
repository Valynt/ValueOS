/**
 * Billing API Router
 * Main router for all billing endpoints
 */

import express from 'express';
import subscriptionsRouter from './subscriptions';
import usageRouter from './usage';
import invoicesRouter from './invoices';
import webhooksRouter from './webhooks';

const router = express.Router();

// Mount sub-routers
router.use('/subscription', subscriptionsRouter);
router.use('/usage', usageRouter);
router.use('/invoices', invoicesRouter);
router.use('/webhooks', webhooksRouter);

export default router;
