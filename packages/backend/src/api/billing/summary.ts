/**
 * Billing Summary API
 * Provides tenant billing overview
 */

import { createLogger } from '@shared/lib/logger';
import express, { Request, Response, Router } from 'express';

import { createBillingPlatformSupabaseClient } from '../../lib/supabase/privileged/index.js';

import { InvoiceService } from '../../services/billing/InvoiceService.js';
import { subscriptionService as SubscriptionService } from '../../services/billing/SubscriptionService.js';
import MetricsCollector from '../../services/metering/MetricsCollector.js';

const router: Router = express.Router();
const logger = createLogger({ component: 'BillingSummaryAPI' });

const withRequestContext = (req: Request, res: Response, meta?: Record<string, unknown>) => ({
  requestId: req.requestId || res.locals.requestId,
  ...meta,
});

/**
 * GET /api/billing/summary
 * Get tenant billing overview
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get current subscription
    const subscription = await SubscriptionService.getActiveSubscription(tenantId);

    // Get usage summary
    const usageSummary = await MetricsCollector.getUsageSummary(tenantId);

    // Instantiate services
    const invoiceService = new InvoiceService(createBillingPlatformSupabaseClient({
      justification: 'service-role:justified billing summary API'
    }));

    // Get upcoming invoice preview
    let upcomingInvoice = null;
    try {
      upcomingInvoice = await invoiceService.getUpcomingInvoice(tenantId);
    } catch (error) {
      logger.warn('Could not fetch upcoming invoice', { error: error instanceof Error ? error.message : String(error) });
    }

    // Get recent invoices
    const recentInvoices = await invoiceService.getInvoices(tenantId, 5, 0);

    const summary = {
      tenant_id: tenantId,
      subscription: subscription ? {
        id: subscription.id,
        status: subscription.status,
        plan_tier: subscription.plan_tier,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end
      } : null,
      usage: usageSummary,
      upcoming_invoice: upcomingInvoice,
      recent_invoices: recentInvoices ?? [],
      generated_at: new Date().toISOString()
    };

    res.json(summary);
  } catch (error) {
    logger.error('Error fetching billing summary', error as Error, withRequestContext(req, res));
    res.status(500).json({ error: 'Failed to fetch billing summary' });
  }
});

export default router;
