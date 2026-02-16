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

const router = express.Router();

// Baseline protections applied to all usage routes
router.use(securityHeadersMiddleware);
router.use(serviceIdentityMiddleware);

// Get comprehensive usage dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const metricsCollector = new MetricsCollector();
    const entitlementsService = new EntitlementsService();
    const usageAggregator = new UsageAggregator();
    const invoiceMathEngine = new InvoiceMathEngine();
    const priceVersionService = new PriceVersionService();

    // Get usage summary
    const usageSummary = await metricsCollector.getUsageSummary(tenantId);

    // Get entitlements and quota information
    const entitlements = await entitlementsService.getUsageWithEntitlements(tenantId);

    // Get recent usage aggregates
    const recentAggregates = await usageAggregator.getRecentAggregates(tenantId, 30);

    // Get upcoming invoice preview
    const upcomingInvoice = await invoiceMathEngine.calculateUpcomingInvoice({
      tenantId,
      subscriptionId: req.user.subscriptionId,
      billingPeriod: 'current_month'
    });

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
    const tenantId = req.tenantId;
    const metricsCollector = new MetricsCollector();
    const entitlementsService = new EntitlementsService();

    // Get real-time usage metrics
    const realTimeUsage = await metricsCollector.getRealTimeUsage(tenantId);

    // Get quota status with alerts
    const quotaStatus = await entitlementsService.getQuotaStatusWithAlerts(tenantId);

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
    const tenantId = req.tenantId;
    const invoiceMathEngine = new InvoiceMathEngine();

    // Get invoice preview for current period
    const invoicePreview = await invoiceMathEngine.calculateUpcomingInvoice({
      tenantId,
      subscriptionId: req.user.subscriptionId,
      billingPeriod: 'current_month'
    });

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
    const tenantId = req.tenantId;
    const { dateRange } = req.params;
    const usageAggregator = new UsageAggregator();

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
    const tenantId = req.tenantId;
    const { format = 'json', startDate, endDate } = req.query;
    const metricsCollector = new MetricsCollector();

    // Get usage data for export
    const usageData = await metricsCollector.getUsageForExport(tenantId, {
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string)
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
function calculateSpendForecast(historicalUsage, pricingVersion) {
  // Implement spend forecasting algorithm
  // This would analyze historical usage patterns and project future spend
  // based on current pricing and usage trends
  return {
    projectedSpend: 0,
    confidenceInterval: 'medium',
    trendAnalysis: 'stable',
    recommendations: []
  };
}

function convertToCSV(data) {
  // Convert usage data to CSV format
  return 'metric,usage,quota,period\n' +
         data.map(item =>
           `${item.metric},${item.usage},${item.quota},${item.period}`
         ).join('\n');
}

export default router;
