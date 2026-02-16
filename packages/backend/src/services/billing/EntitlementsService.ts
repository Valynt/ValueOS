/**
 * Entitlements Service
 * Manages usage allowances and entitlement checking
 */

import { createClient } from '@supabase/supabase-js';
import SubscriptionService from './SubscriptionService.js';
import MetricsCollector from '../metering/MetricsCollector.js';
import { createLogger } from '../../lib/logger.js';
import { BillingMetric } from '../../config/billing.js';

const logger = createLogger({ component: 'EntitlementsService' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Grace period configuration
const GRACE_PERIOD_HOURS = 24; // 24 hours grace period
const GRACE_PERIOD_MULTIPLIER = 1.1; // 10% overage allowed in grace period

export interface EntitlementCheckResult {
  allowed: boolean;
  reason?: string;
  remaining?: number;
  currentUsage?: number;
  quota?: number;
  gracePeriodRemaining?: number;
  suggestedAction?: string;
}

export interface EntitlementSnapshot {
  id: string;
  tenant_id: string;
  snapshot_date: string;
  plan_tier: string;
  quotas: Record<BillingMetric, number>;
  overage_rates: Record<BillingMetric, number>;
  effective_date: string;
  expires_at?: string;
}

export class EntitlementsService {
  /**
   * Check if usage is allowed for a tenant
   */
  static async checkUsageAllowed(
    tenantId: string,
    metric: BillingMetric,
    units: number = 1,
    options: {
      checkGracePeriod?: boolean;
      snapshotDate?: string;
    } = {}
  ): Promise<EntitlementCheckResult> {
    try {
      const { checkGracePeriod = true, snapshotDate } = options;

      // Get current usage
      const currentUsage = await MetricsCollector.getCurrentUsage(tenantId, metric);

      // Get entitlement snapshot
      const snapshot = await this.getEffectiveEntitlementSnapshot(tenantId, snapshotDate);
      if (!snapshot) {
        return {
          allowed: false,
          reason: 'No entitlement snapshot found',
          suggestedAction: 'Contact support'
        };
      }

      const quota = snapshot.quotas[metric];
      if (!quota) {
        return {
          allowed: false,
          reason: `No quota defined for metric: ${metric}`,
          suggestedAction: 'Contact support'
        };
      }

      const remaining = Math.max(0, quota - currentUsage);
      const wouldExceed = (currentUsage + units) > quota;

      // If within quota, allow
      if (!wouldExceed) {
        return {
          allowed: true,
          remaining: remaining - units,
          currentUsage,
          quota
        };
      }

      // Check grace period if enabled
      if (checkGracePeriod) {
        const graceCheck = await this.checkGracePeriod(tenantId, metric, currentUsage + units, quota);
        if (graceCheck.allowed) {
          return {
            allowed: true,
            reason: 'Allowed during grace period',
            remaining: 0,
            currentUsage,
            quota,
            gracePeriodRemaining: graceCheck.gracePeriodRemaining,
            suggestedAction: 'Upgrade plan soon'
          };
        }
      }

      // Usage would exceed quota
      return {
        allowed: false,
        reason: `Quota exceeded for ${metric}`,
        remaining: 0,
        currentUsage,
        quota,
        suggestedAction: 'Upgrade plan or wait for reset'
      };
    } catch (error) {
      logger.error('Error checking usage allowance', error as Error, { tenantId, metric });
      // Fail open on error
      return { allowed: true };
    }
  }

  /**
   * Check grace period allowance
   */
  static async checkGracePeriod(
    tenantId: string,
    metric: BillingMetric,
    requestedUsage: number,
    quota: number
  ): Promise<{ allowed: boolean; gracePeriodRemaining?: number }> {
    try {
      // Check if tenant has been in grace period recently
      const { data: recentOverages, error } = await supabase
        .from('usage_events')
        .select('timestamp')
        .eq('tenant_id', tenantId)
        .eq('metric', metric)
        .gt('timestamp', new Date(Date.now() - GRACE_PERIOD_HOURS * 60 * 60 * 1000).toISOString())
        .gt('quantity', quota); // Overage events

      if (error) {
        logger.warn('Error checking grace period', error);
        return { allowed: false };
      }

      if (!recentOverages || recentOverages.length === 0) {
        // First time exceeding quota - allow grace period
        const graceLimit = quota * GRACE_PERIOD_MULTIPLIER;
        if (requestedUsage <= graceLimit) {
          return {
            allowed: true,
            gracePeriodRemaining: GRACE_PERIOD_HOURS
          };
        }
      }

      // Check if still within grace period window
      const lastOverage = recentOverages[recentOverages.length - 1];
      const hoursSinceLastOverage = (Date.now() - new Date(lastOverage.timestamp).getTime()) / (1000 * 60 * 60);

      if (hoursSinceLastOverage < GRACE_PERIOD_HOURS) {
        const graceLimit = quota * GRACE_PERIOD_MULTIPLIER;
        if (requestedUsage <= graceLimit) {
          return {
            allowed: true,
            gracePeriodRemaining: GRACE_PERIOD_HOURS - hoursSinceLastOverage
          };
        }
      }

      return { allowed: false };
    } catch (error) {
      logger.error('Error in grace period check', error as Error);
      return { allowed: false };
    }
  }

  /**
   * Get effective entitlement snapshot for tenant
   */
  static async getEffectiveEntitlementSnapshot(
    tenantId: string,
    snapshotDate?: string
  ): Promise<EntitlementSnapshot | null> {
    try {
      const effectiveDate = snapshotDate || new Date().toISOString();

      const { data, error } = await supabase
        .from('entitlement_snapshots')
        .select('*')
        .eq('tenant_id', tenantId)
        .lte('effective_date', effectiveDate)
        .or(`expires_at.is.null,expires_at.gt.${effectiveDate}`)
        .order('effective_date', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        logger.error('Error getting entitlement snapshot', error);
        throw error;
      }

      return data || null;
    } catch (error) {
      logger.error('Error in getEffectiveEntitlementSnapshot', error as Error);
      return null;
    }
  }

  /**
   * Create entitlement snapshot for tenant
   */
  static async createEntitlementSnapshot(
    tenantId: string,
    planTier: string,
    quotas: Record<BillingMetric, number>,
    overageRates: Record<BillingMetric, number>,
    effectiveDate?: string
  ): Promise<EntitlementSnapshot> {
    try {
      const snapshotDate = effectiveDate || new Date().toISOString();

      const { data, error } = await supabase
        .from('entitlement_snapshots')
        .insert({
          tenant_id: tenantId,
          snapshot_date: snapshotDate,
          plan_tier: planTier,
          quotas,
          overage_rates: overageRates,
          effective_date: snapshotDate
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating entitlement snapshot', error);
        throw error;
      }

      logger.info('Created entitlement snapshot', { tenantId, snapshotId: data.id });
      return data;
    } catch (error) {
      logger.error('Error in createEntitlementSnapshot', error as Error);
      throw error;
    }
  }

  /**
   * Update entitlement snapshot (for plan changes)
   */
  static async updateEntitlementSnapshot(
    snapshotId: string,
    updates: Partial<EntitlementSnapshot>
  ): Promise<EntitlementSnapshot> {
    try {
      const { data, error } = await supabase
        .from('entitlement_snapshots')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', snapshotId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating entitlement snapshot', error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error in updateEntitlementSnapshot', error as Error);
      throw error;
    }
  }

  /**
   * Get usage summary with entitlements
   */
  static async getUsageWithEntitlements(tenantId: string): Promise<{
    usage: Record<BillingMetric, {
      current: number;
      quota: number;
      remaining: number;
      percentage: number;
      status: 'ok' | 'warning' | 'exceeded';
    }>;
    snapshot: EntitlementSnapshot | null;
  }> {
    try {
      const snapshot = await this.getEffectiveEntitlementSnapshot(tenantId);

      if (!snapshot) {
        return { usage: {}, snapshot: null };
      }

      const usage: Record<string, any> = {};

      for (const [metric, quota] of Object.entries(snapshot.quotas)) {
        const current = await MetricsCollector.getCurrentUsage(tenantId, metric as BillingMetric);
        const remaining = Math.max(0, quota - current);
        const percentage = quota > 0 ? (current / quota) * 100 : 0;

        let status: 'ok' | 'warning' | 'exceeded' = 'ok';
        if (percentage >= 100) {
          status = 'exceeded';
        } else if (percentage >= 80) {
          status = 'warning';
        }

        usage[metric] = {
          current,
          quota,
          remaining,
          percentage: Math.round(percentage * 100) / 100,
          status
        };
      }

      return { usage, snapshot };
    } catch (error) {
      logger.error('Error getting usage with entitlements', error as Error, { tenantId });
      return { usage: {}, snapshot: null };
    }
  }

  /**
   * Refresh entitlement snapshot from subscription
   */
  static async refreshEntitlementSnapshot(tenantId: string): Promise<EntitlementSnapshot | null> {
    try {
      const subscription = await SubscriptionService.getActiveSubscription(tenantId);

      if (!subscription) {
        logger.warn('No active subscription for tenant', { tenantId });
        return null;
      }

      // Get plan quotas (this would come from a configuration)
      const quotas = await this.getPlanQuotas(subscription.plan_tier);
      const overageRates = await this.getPlanOverageRates(subscription.plan_tier);

      // Create or update snapshot
      const existingSnapshot = await this.getEffectiveEntitlementSnapshot(tenantId);

      if (existingSnapshot) {
        return await this.updateEntitlementSnapshot(existingSnapshot.id, {
          quotas,
          overage_rates: overageRates,
          plan_tier: subscription.plan_tier
        });
      } else {
        return await this.createEntitlementSnapshot(
          tenantId,
          subscription.plan_tier,
          quotas,
          overageRates
        );
      }
    } catch (error) {
      logger.error('Error refreshing entitlement snapshot', error as Error, { tenantId });
      return null;
    }
  }

  /**
   * Get plan quotas (placeholder - would be from config)
   */
  private static async getPlanQuotas(planTier: string): Promise<Record<BillingMetric, number>> {
    // This would come from a configuration service
    const planQuotas: Record<string, Record<BillingMetric, number>> = {
      free: {
        ai_tokens: 100,
        api_calls: 1000,
        agent_executions: 10
      },
      starter: {
        ai_tokens: 10000,
        api_calls: 50000,
        agent_executions: 100
      },
      professional: {
        ai_tokens: 100000,
        api_calls: 500000,
        agent_executions: 1000
      },
      enterprise: {
        ai_tokens: 1000000,
        api_calls: 5000000,
        agent_executions: 10000
      }
    };

    return planQuotas[planTier] || planQuotas.free;
  }

  /**
   * Get plan overage rates (placeholder - would be from config)
   */
  private static async getPlanOverageRates(planTier: string): Promise<Record<BillingMetric, number>> {
    // This would come from a configuration service
    const overageRates: Record<string, Record<BillingMetric, number>> = {
      free: {
        ai_tokens: 0.01,
        api_calls: 0.001,
        agent_executions: 0.1
      },
      starter: {
        ai_tokens: 0.009,
        api_calls: 0.0009,
        agent_executions: 0.09
      },
      professional: {
        ai_tokens: 0.008,
        api_calls: 0.0008,
        agent_executions: 0.08
      },
      enterprise: {
        ai_tokens: 0.007,
        api_calls: 0.0007,
        agent_executions: 0.07
      }
    };

    return overageRates[planTier] || overageRates.free;
  }
}
