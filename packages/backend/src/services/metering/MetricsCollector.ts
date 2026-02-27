/**
 * Metrics Collector
 * Collects usage metrics from various sources for reporting
 */

import { BillingMetric } from '../../config/billing.js'
import { UsageSummary } from '../../types/billing';
import { createLogger } from '../../lib/logger.js'
import { supabase } from '../../lib/supabase.js';

const logger = createLogger({ component: 'MetricsCollector' });

class MetricsCollector {
  /**
   * Get usage summary for tenant
   */
  async getUsageSummary(tenantId: string): Promise<UsageSummary> {
    if (!supabase) {
      throw new Error('Billing service not configured');
    }
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const metrics: BillingMetric[] = [
      'llm_tokens',
      'agent_executions',
      'api_calls',
      'storage_gb',
      'user_seats',
    ];

    const usage: Record<BillingMetric, number> = {} as any;
    const quotas: Record<BillingMetric, number> = {} as any;
    const percentages: Record<BillingMetric, number> = {} as any;
    const overages: Record<BillingMetric, number> = {} as any;

    // Fetch metrics in parallel
    await Promise.all(
      metrics.map(async metric => {
        const [usageData, quotaData] = await Promise.all([
          this.getMetricUsage(tenantId, metric, periodStart, periodEnd),
          this.getMetricQuota(tenantId, metric),
        ]);

        usage[metric] = usageData;
        quotas[metric] = quotaData;
        percentages[metric] = quotaData > 0 ? Math.round((usageData / quotaData) * 100) : 0;
        overages[metric] = Math.max(0, usageData - quotaData);
      })
    );

    // Calculate costs (placeholder - will be calculated with actual rates)
    const costs = {
      base: 0,
      overage: {} as Record<BillingMetric, number>,
      total: 0,
    };

    return {
      tenant_id: tenantId,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      usage,
      quotas,
      percentages,
      overages,
      costs,
    };
  }

  /**
   * Get metric usage
   */
  /**
   * Get current usage for a single metric in the current billing period
   */
  async getCurrentUsage(tenantId: string, metric: BillingMetric): Promise<number> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return this.getMetricUsage(tenantId, metric, periodStart, periodEnd);
  }

  /**
   * Get usage data for a date range, suitable for CSV/JSON export
   */
  async getUsageForExport(
    tenantId: string,
    range: { startDate: Date; endDate: Date }
  ): Promise<Array<{ metric: string; usage: number; quota: number; period: string }>> {
    const metrics: BillingMetric[] = ['llm_tokens', 'agent_executions', 'api_calls', 'storage_gb', 'user_seats'];
    const period = `${range.startDate.toISOString().slice(0, 10)} - ${range.endDate.toISOString().slice(0, 10)}`;

    const rows = await Promise.all(
      metrics.map(async (metric) => {
        const usage = await this.getMetricUsage(tenantId, metric, range.startDate, range.endDate);
        const quota = await this.getMetricQuota(tenantId, metric);
        return { metric, usage, quota, period };
      })
    );
    return rows;
  }

  private async getMetricUsage(
    tenantId: string,
    metric: BillingMetric,
    periodStart: Date,
    periodEnd: Date
  ): Promise<number> {
    const { data, error } = await supabase.rpc('get_current_usage', {
      p_tenant_id: tenantId,
      p_metric: metric,
      p_period_start: periodStart.toISOString(),
      p_period_end: periodEnd.toISOString(),
    });

    if (error) {
      logger.error('Error fetching metric usage', error);
      return 0;
    }

    return parseFloat(data || 0);
  }

  /**
   * Get metric quota
   */
  private async getMetricQuota(tenantId: string, metric: BillingMetric): Promise<number> {
    const { data, error } = await supabase
      .from('usage_quotas')
      .select('quota_amount')
      .eq('tenant_id', tenantId)
      .eq('metric', metric)
      .gte('period_end', new Date().toISOString())
      .single();

    if (error || !data) {
      return Infinity;
    }

    return parseFloat(data.quota_amount);
  }
}

export default new MetricsCollector();
