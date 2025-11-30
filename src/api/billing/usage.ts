/**
 * Usage API
 * Endpoints for usage metrics and quotas
 */

import express, { Request, Response } from 'express';
import MetricsCollector from '../../services/metering/MetricsCollector';
import UsageCache from '../../services/metering/UsageCache';
import { BillingMetric } from '../../config/billing';
import { createLogger } from '../../lib/logger';

const router = express.Router();
const logger = createLogger({ component: 'UsageAPI' });

/**
 * GET /api/billing/usage
 * Get current period usage summary
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const summary = await MetricsCollector.getUsageSummary(tenantId);
    
    res.json(summary);
  } catch (error) {
    logger.error('Error fetching usage', error as Error);
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

/**
 * GET /api/billing/usage/:metric
 * Get usage for specific metric
 */
router.get('/:metric', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const metric = req.params.metric as BillingMetric;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [usage, quota, percentage] = await Promise.all([
      UsageCache.getCurrentUsage(tenantId, metric),
      UsageCache.getQuota(tenantId, metric),
      UsageCache.getUsagePercentage(tenantId, metric),
    ]);

    res.json({
      metric,
      usage,
      quota,
      percentage,
      remaining: quota - usage,
    });
  } catch (error) {
    logger.error('Error fetching metric usage', error as Error);
    res.status(500).json({ error: 'Failed to fetch metric usage' });
  }
});

/**
 * GET /api/billing/quotas
 * Get all quotas for tenant
 */
router.get('/quotas', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const metrics: BillingMetric[] = [
      'llm_tokens',
      'agent_executions',
      'api_calls',
      'storage_gb',
      'user_seats',
    ];

    const quotas: any = {};

    await Promise.all(
      metrics.map(async metric => {
        quotas[metric] = await UsageCache.getQuota(tenantId, metric);
      })
    );

    res.json(quotas);
  } catch (error) {
    logger.error('Error fetching quotas', error as Error);
    res.status(500).json({ error: 'Failed to fetch quotas' });
  }
});

export default router;
