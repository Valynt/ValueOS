/**
 * Grace Period Service
 * Manages grace periods for soft quota limits
 */

import { createClient } from '@supabase/supabase-js';
import { BillingMetric, GRACE_PERIOD_MS } from '../../config/billing';
import { createLogger } from '../../lib/logger';

const logger = createLogger({ component: 'GracePeriodService' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface GracePeriod {
  id: string;
  tenant_id: string;
  metric: BillingMetric;
  started_at: string;
  expires_at: string;
  quota_at_start: number;
  usage_at_start: number;
  notified: boolean;
}

class GracePeriodService {
  /**
   * Start grace period for tenant/metric
   */
  async startGracePeriod(
    tenantId: string,
    metric: BillingMetric,
    currentUsage: number,
    quota: number
  ): Promise<GracePeriod> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + GRACE_PERIOD_MS);

    const { data, error } = await supabase
      .from('grace_periods')
      .insert({
        tenant_id: tenantId,
        metric,
        started_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        quota_at_start: quota,
        usage_at_start: currentUsage,
        notified: false,
      })
      .select()
      .single();

    if (error) throw error;

    logger.info('Grace period started', {
      tenantId,
      metric,
      expiresAt: expiresAt.toISOString(),
    });

    return data;
  }

  /**
   * Get active grace period for tenant/metric
   */
  async getActiveGracePeriod(
    tenantId: string,
    metric: BillingMetric
  ): Promise<GracePeriod | null> {
    const { data, error } = await supabase
      .from('grace_periods')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('metric', metric)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('Error fetching grace period', error);
      throw error;
    }

    return data;
  }

  /**
   * Check if tenant is in grace period
   */
  async isInGracePeriod(
    tenantId: string,
    metric: BillingMetric
  ): Promise<boolean> {
    const gracePeriod = await this.getActiveGracePeriod(tenantId, metric);
    return gracePeriod !== null;
  }

  /**
   * Get grace period expiration time
   */
  async getGracePeriodExpiration(
    tenantId: string,
    metric: BillingMetric
  ): Promise<Date | null> {
    const gracePeriod = await this.getActiveGracePeriod(tenantId, metric);
    return gracePeriod ? new Date(gracePeriod.expires_at) : null;
  }

  /**
   * Mark grace period as notified
   */
  async markNotified(gracePeriodId: string): Promise<void> {
    const { error } = await supabase
      .from('grace_periods')
      .update({ notified: true })
      .eq('id', gracePeriodId);

    if (error) throw error;
  }

  /**
   * End grace period (when user upgrades or usage drops)
   */
  async endGracePeriod(
    tenantId: string,
    metric: BillingMetric
  ): Promise<void> {
    const { error } = await supabase
      .from('grace_periods')
      .update({ expires_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('metric', metric)
      .gt('expires_at', new Date().toISOString());

    if (error) throw error;

    logger.info('Grace period ended', { tenantId, metric });
  }

  /**
   * Get all expired grace periods
   */
  async getExpiredGracePeriods(): Promise<GracePeriod[]> {
    const { data, error } = await supabase
      .from('grace_periods')
      .select('*')
      .lt('expires_at', new Date().toISOString())
      .eq('notified', false);

    if (error) throw error;

    return data || [];
  }

  /**
   * Clean up old grace periods
   */
  async cleanupOldGracePeriods(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { error, count } = await supabase
      .from('grace_periods')
      .delete()
      .lt('expires_at', cutoffDate.toISOString());

    if (error) throw error;

    logger.info('Cleaned up old grace periods', { count });

    return count || 0;
  }
}

export default new GracePeriodService();
