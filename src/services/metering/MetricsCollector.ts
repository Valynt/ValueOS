/**
 * Metrics Collector
 * Collects usage metrics from various sources for reporting
 */

import { createClient } from '@supabase/supabase-js';
import { BillingMetric } from '../../config/billing';
import { UsageSummary } from '../../types/billing';
import { createLogger } from '../../lib/logger';

const logger = createLogger({ component: 'MetricsCollector' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

class MetricsCollector {
  /**
   * Get usage summary for tenant
   */
  async getUsageSummary(tenantId: string): Promise<UsageSummary> {
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
