/**
 * Usage API Router
 * Endpoints for usage transparency dashboard
 */

import express, { Request, Response } from 'express';

import { logger } from '../../lib/logger.js';
import { supabase } from '../../lib/supabase.js';
import { securityHeadersMiddleware } from '../../middleware/securityMiddleware.js';
import { serviceIdentityMiddleware } from '../../middleware/serviceIdentityMiddleware.js';
import { EntitlementsService } from '../../services/billing/EntitlementsService.js';
import { InvoiceMathEngine } from '../../services/billing/InvoiceMathEngine.js';
import PriceVersionService from '../../services/billing/PriceVersionService.js';
import MetricsCollector from '../../services/metering/MetricsCollector.js';

const router = express.Router();

const entitlementsService = new EntitlementsService(supabase);
const invoiceMathEngine = new InvoiceMathEngine(supabase);
const priceVersionService = PriceVersionService;

// Baseline protections applied to all usage routes
router.use(securityHeadersMiddleware);
router.use(serviceIdentityMiddleware);

// Get comprehensive usage dashboard data
router.get('/dashboard', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId as string | undefined;
    const subscriptionId = req.user?.subscriptionId as string | undefined;
    if (!tenantId) {
      res.status(401).json({ error: 'Unauthorized: No tenant context' });
      return;
    }
    if (!subscriptionId) {
      res.status(400).json({ error: 'No subscription found' });
      return;
    }

    const usageSummary = await MetricsCollector.getUsageSummary(tenantId);
    const entitlements = await entitlementsService.getUsageWithEntitlements(tenantId);
    const upcomingInvoice = await invoiceMathEngine.calculateUpcomingInvoice(tenantId, subscriptionId);
    const pricingVersion = await priceVersionService.getEffectiveVersionForTenant(tenantId, 'standard');

    res.json({
      usageSummary,
      entitlements,
      upcomingInvoice,
      pricingVersion,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching usage dashboard data', error instanceof Error ? error : undefined);
    res.status(500).json({ error: 'Failed to fetch usage dashboard data' });
  }
});

// Get real-time quota tracking data
router.get('/quota-tracking', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId as string | undefined;
    if (!tenantId) {
      res.status(401).json({ error: 'Unauthorized: No tenant context' });
      return;
    }

    const usageSummary = await MetricsCollector.getUsageSummary(tenantId);
    const quotaStatus = await entitlementsService.getUsageWithEntitlements(tenantId);

    res.json({
      usageSummary,
      quotaStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching quota tracking data', error instanceof Error ? error : undefined);
    res.status(500).json({ error: 'Failed to fetch quota tracking data' });
  }
});

// Get invoice preview UI data
router.get('/invoice-preview', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId as string | undefined;
    const subscriptionId = req.user?.subscriptionId as string | undefined;
    if (!tenantId) {
      res.status(401).json({ error: 'Unauthorized: No tenant context' });
      return;
    }
    if (!subscriptionId) {
      res.status(400).json({ error: 'No subscription found' });
      return;
    }

    const invoicePreview = await invoiceMathEngine.calculateUpcomingInvoice(tenantId, subscriptionId);

    res.json({
      invoicePreview,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching invoice preview data', error instanceof Error ? error : undefined);
    res.status(500).json({ error: 'Failed to fetch invoice preview data' });
  }
});

// Get spend estimation forecasting data
router.get('/spend-forecasting', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId as string | undefined;
    if (!tenantId) {
      res.status(401).json({ error: 'Unauthorized: No tenant context' });
      return;
    }

    const pricingVersion = await priceVersionService.getEffectiveVersionForTenant(tenantId, 'standard');

    res.json({
      pricingVersion,
      forecast: {
        projectedSpend: 0,
        confidenceInterval: 'medium',
        trendAnalysis: 'stable',
        recommendations: []
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching spend forecasting data', error instanceof Error ? error : undefined);
    res.status(500).json({ error: 'Failed to fetch spend forecasting data' });
  }
});

/**
 * Parse a ledger dateRange param into UTC period bounds.
 *
 * Accepts:
 *   "YYYY-MM"         — single month
 *   "YYYY-MM:YYYY-MM" — inclusive month range
 *
 * Returns null when the format is invalid.
 */
export function parseLedgerDateRange(
  dateRange: string,
): { periodStart: Date; periodEnd: Date } | null {
  const [startPart, endPart] = dateRange.split(':');
  const periodStart = new Date(`${startPart}-01T00:00:00.000Z`);
  if (isNaN(periodStart.getTime())) return null;

  const endMonth = endPart ?? startPart;
  const parts = endMonth.split('-').map(Number);
  if (parts.length < 2 || parts.some(isNaN)) return null;
  const [endYear, endMonthNum] = parts;
  // Exclusive upper bound: first day of the month after endMonth.
  const periodEnd = new Date(Date.UTC(endYear, endMonthNum, 1));
  if (isNaN(periodEnd.getTime())) return null;

  return { periodStart, periodEnd };
}

// Get drill-down ledger view per tenant.
// dateRange format: "YYYY-MM" (single month) or "YYYY-MM:YYYY-MM" (inclusive range).
router.get('/ledger/:dateRange', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId as string | undefined;
    if (!tenantId) {
      res.status(401).json({ error: 'Unauthorized: No tenant context' });
      return;
    }
    const { dateRange } = req.params;

    const parsed = parseLedgerDateRange(dateRange);
    if (!parsed) {
      res.status(400).json({ error: 'Invalid dateRange format. Use YYYY-MM or YYYY-MM:YYYY-MM.' });
      return;
    }
    const { periodStart, periodEnd } = parsed;

    const { data, error: dbError } = await supabase
      .from('rated_ledger')
      .select(
        'id, meter_key, period_start, period_end, quantity_used, quantity_included, quantity_overage, unit_price, amount, rated_at'
      )
      .eq('tenant_id', tenantId)
      .gte('period_start', periodStart.toISOString())
      .lt('period_start', periodEnd.toISOString())
      .order('period_start', { ascending: true });

    if (dbError) {
      logger.error('Error querying rated_ledger', dbError);
      res.status(500).json({ error: 'Failed to fetch ledger data' });
      return;
    }

    const ledgerEntries = data ?? [];

    // Aggregate total billed amount per meter key for the breakdown panel.
    const breakdownByMetric: Record<string, number> = {};
    for (const entry of ledgerEntries) {
      const key = entry.meter_key as string;
      breakdownByMetric[key] = (breakdownByMetric[key] ?? 0) + Number(entry.amount);
    }

    res.json({
      ledgerEntries,
      breakdownByMetric,
      dateRange,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching ledger data', error instanceof Error ? error : undefined);
    res.status(500).json({ error: 'Failed to fetch ledger data' });
  }
});

// Export usage data
router.get('/export', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId as string | undefined;
    if (!tenantId) {
      res.status(401).json({ error: 'Unauthorized: No tenant context' });
      return;
    }
    const { format = 'json', startDate, endDate } = req.query;

    if (!startDate || !endDate || typeof startDate !== 'string' || typeof endDate !== 'string') {
      res.status(400).json({ error: 'startDate and endDate query parameters are required' });
      return;
    }

    const parsedStart = new Date(startDate);
    const parsedEnd = new Date(endDate);
    if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
      res.status(400).json({ error: 'startDate and endDate must be valid date strings' });
      return;
    }

    const usageData = await MetricsCollector.getUsageForExport(tenantId, {
      startDate: parsedStart,
      endDate: parsedEnd
    });

    if (format === 'csv') {
      const csvData = convertToCSV(usageData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="usage-export.csv"');
      res.send(csvData);
    } else {
      res.json(usageData);
    }
  } catch (error) {
    logger.error('Error exporting usage data', error instanceof Error ? error : undefined);
    res.status(500).json({ error: 'Failed to export usage data' });
  }
});

// Helper functions
function calculateSpendForecast(
  _historicalUsage: unknown,
  _pricingVersion: unknown
): { projectedSpend: number; confidenceInterval: string; trendAnalysis: string; recommendations: string[] } {
  return {
    projectedSpend: 0,
    confidenceInterval: 'medium',
    trendAnalysis: 'stable',
    recommendations: []
  };
}

/** Escape a value for safe CSV output (prevents formula injection and handles commas/quotes). */
function escapeCsvField(value: unknown): string {
  const str = String(value ?? '');
  // Strip leading formula-injection characters
  const safe = str.replace(/^[=+\-@\t\r]/, "'$&");
  // Wrap in quotes if it contains commas, quotes, or newlines
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

interface UsageExportRow {
  metric: string;
  usage: number;
  quota: number;
  period: string;
}

function convertToCSV(data: UsageExportRow[]): string {
  if (!Array.isArray(data)) return 'metric,usage,quota,period\n';
  return 'metric,usage,quota,period\n' +
         data.map(item =>
           [item.metric, item.usage, item.quota, item.period]
             .map(escapeCsvField)
             .join(',')
         ).join('\n');
}

export default router;
