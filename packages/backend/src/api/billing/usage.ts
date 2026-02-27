/**
 * Usage API Router
 * Endpoints for usage transparency dashboard
 */

import express from 'express';
import { MetricsCollector } from '../../services/metering/MetricsCollector.js';
import { EntitlementsService } from '../../services/billing/EntitlementsService.js';
import { UsageAggregator } from '../../services/metering/UsageAggregator.js';
import { InvoiceMathEngine } from '../../services/billing/InvoiceMathEngine.js';
import { PriceVersionService } from '../../services/billing/PriceVersionService.js';
import { securityHeadersMiddleware } from '../../middleware/securityMiddleware.js';
import { serviceIdentityMiddleware } from '../../middleware/serviceIdentityMiddleware.js';
import { requirePermission } from '../../middleware/rbac.js';
import { requireAuth } from '../../middleware/auth.js';
import { tenantContextMiddleware } from '../../middleware/tenantContext.js';
import { tenantDbContextMiddleware } from '../../middleware/tenantDbContext.js';
import { supabase } from '../../lib/supabase.js';

const router = express.Router();

// Baseline protections applied to all usage routes
router.use(securityHeadersMiddleware);
router.use(serviceIdentityMiddleware);

// Get comprehensive usage dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(401).json({ error: 'Unauthorized: No tenant context' });
    }
    if (!req.user?.subscriptionId) {
      return res.status(400).json({ error: 'No subscription found' });
    }
    const tenantId = req.tenantId;
    const metricsCollector = new MetricsCollector();
    const entitlementsService = new EntitlementsService(supabase);
    const usageAggregator = new UsageAggregator(supabase);
    const invoiceMathEngine = new InvoiceMathEngine(supabase);
    const priceVersionService = new PriceVersionService();

    // Get usage summary
    const usageSummary = await metricsCollector.getUsageSummary(tenantId);

    // Get entitlements and quota information
    const entitlements = await entitlementsService.getUsageWithEntitlements(tenantId);

    // Get recent usage aggregates
    const recentAggregates = await usageAggregator.getRecentAggregates(tenantId, 30);

    // Get upcoming invoice preview
    const upcomingInvoice = await invoiceMathEngine.calculateUpcomingInvoice(tenantId, req.user.subscriptionId);

    // Get current pricing version
    const pricingVersion = await priceVersionService.getEffectiveVersionForTenant(tenantId);

    res.json({
      usageSummary,
      entitlements,
      recentAggregates,
      upcomingInvoice,
      pricingVersion,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching usage dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch usage dashboard data' });
  }
});

// Get real-time quota tracking data
router.get('/quota-tracking', async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(401).json({ error: 'Unauthorized: No tenant context' });
    }
    const tenantId = req.tenantId;
    const metricsCollector = new MetricsCollector();
    const entitlementsService = new EntitlementsService(supabase);

    // Get real-time usage metrics
    const realTimeUsage = await metricsCollector.getRealTimeUsage(tenantId);

    // Get quota status with alerts
    const quotaStatus = await entitlementsService.getUsageWithEntitlements(tenantId);

    res.json({
      realTimeUsage,
      quotaStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching quota tracking data:', error);
    res.status(500).json({ error: 'Failed to fetch quota tracking data' });
  }
});

// Get invoice preview UI data
router.get('/invoice-preview', async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(401).json({ error: 'Unauthorized: No tenant context' });
    }
    if (!req.user?.subscriptionId) {
      return res.status(400).json({ error: 'No subscription found' });
    }
    const tenantId = req.tenantId;
    const invoiceMathEngine = new InvoiceMathEngine(supabase);

    // Get invoice preview for current period
    const invoicePreview = await invoiceMathEngine.calculateUpcomingInvoice(tenantId, req.user.subscriptionId);

    // Get historical invoices for comparison
    const recentInvoices = await invoiceMathEngine.getRecentInvoices(tenantId, 3);

    res.json({
      invoicePreview,
      recentInvoices,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching invoice preview data:', error);
    res.status(500).json({ error: 'Failed to fetch invoice preview data' });
  }
});

// Get spend estimation forecasting data
router.get('/spend-forecasting', async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(401).json({ error: 'Unauthorized: No tenant context' });
    }
    const tenantId = req.tenantId;
    const metricsCollector = new MetricsCollector();
    const priceVersionService = new PriceVersionService();

    // Get historical usage trends
    const historicalUsage = await metricsCollector.getHistoricalUsage(tenantId, 90);

    // Get current pricing
    const pricingVersion = await priceVersionService.getEffectiveVersionForTenant(tenantId);

    // Calculate forecasted spend
    const forecast = calculateSpendForecast(historicalUsage, pricingVersion);

    res.json({
      historicalUsage,
      pricingVersion,
      forecast,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching spend forecasting data:', error);
    res.status(500).json({ error: 'Failed to fetch spend forecasting data' });
  }
});

// Get drill-down ledger view per tenant
router.get('/ledger/:dateRange', async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(401).json({ error: 'Unauthorized: No tenant context' });
    }
    const tenantId = req.tenantId;
    const { dateRange } = req.params;
    const usageAggregator = new UsageAggregator(supabase);

    // Get rated ledger entries for the specified date range
    const ledgerEntries = await usageAggregator.getRatedLedgerEntries(tenantId, dateRange);

    // Get detailed breakdown by metric type
    const breakdownByMetric = await usageAggregator.getLedgerBreakdownByMetric(tenantId, dateRange);

    res.json({
      ledgerEntries,
      breakdownByMetric,
      dateRange,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching ledger data:', error);
    res.status(500).json({ error: 'Failed to fetch ledger data' });
  }
});

// Export usage data
router.get('/export', async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(401).json({ error: 'Unauthorized: No tenant context' });
    }
    const tenantId = req.tenantId;
    const { format = 'json', startDate, endDate } = req.query;

    if (!startDate || !endDate || typeof startDate !== 'string' || typeof endDate !== 'string') {
      return res.status(400).json({ error: 'startDate and endDate query parameters are required' });
    }

    const parsedStart = new Date(startDate);
    const parsedEnd = new Date(endDate);
    if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
      return res.status(400).json({ error: 'startDate and endDate must be valid date strings' });
    }

    const metricsCollector = new MetricsCollector();

    // Get usage data for export
    const usageData = await metricsCollector.getUsageForExport(tenantId, {
      startDate: parsedStart,
      endDate: parsedEnd
    });

    // Format response based on requested format
    if (format === 'csv') {
      const csvData = convertToCSV(usageData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="usage-export.csv"');
      res.send(csvData);
    } else {
      res.json(usageData);
    }
  } catch (error) {
    console.error('Error exporting usage data:', error);
    res.status(500).json({ error: 'Failed to export usage data' });
  }
});

// Helper functions
function calculateSpendForecast(
  historicalUsage: unknown,
  pricingVersion: unknown
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
