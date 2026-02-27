/**
 * Entitlements Service
 *
 * Usage allowance checking backed by EntitlementSnapshotService and
 * PriceVersionService. No hardcoded plan quotas — all pricing data
 * comes from the billing_price_versions table.
 */

import { type SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '../../lib/logger.js';
import type { MeterKey, EnforcementMode } from '@shared/types/billing-events';
import EntitlementSnapshotService from './EntitlementSnapshotService.js';
import type { EntitlementSnapshot, MeterEntitlement } from './EntitlementSnapshotService.js';

const logger = createLogger({ component: 'EntitlementsService' });

// Grace period: 24 hours, 10% overage buffer
const GRACE_PERIOD_HOURS = 24;
const GRACE_PERIOD_MULTIPLIER = 1.1;

export interface EntitlementCheckResult {
  allowed: boolean;
  reason?: string;
  remaining?: number;
  currentUsage?: number;
  quota?: number;
  enforcement?: EnforcementMode;
  gracePeriodRemaining?: number;
  suggestedAction?: string;
}

export interface UsageMetricStatus {
  current: number;
  quota: number;
  remaining: number;
  percentage: number;
  enforcement: EnforcementMode;
  status: 'ok' | 'warning' | 'exceeded';
}

export class EntitlementsService {
  private supabase: SupabaseClient;
  private snapshotService: EntitlementSnapshotService;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.snapshotService = new EntitlementSnapshotService(supabase);
  }

  /**
   * Check if usage is allowed for a tenant and meter.
   */
  async checkUsageAllowed(
    tenantId: string,
    meterKey: MeterKey,
    units: number = 1,
    options: { checkGracePeriod?: boolean } = {}
  ): Promise<EntitlementCheckResult> {
    const { checkGracePeriod = true } = options;

    try {
      const entitlement = await this.snapshotService.getMeterEntitlement(tenantId, meterKey);
      if (!entitlement) {
        return {
          allowed: false,
          reason: 'No entitlement found for meter',
          suggestedAction: 'Contact support',
        };
      }

      const currentUsage = await this.getCurrentUsage(tenantId, meterKey);
      const quota = entitlement.included;
      // Unlimited quota (represented as -1)
      if (quota < 0) {
        return { allowed: true, remaining: Infinity, currentUsage, quota, enforcement: entitlement.enforcement };
      }

      const remaining = Math.max(0, quota - currentUsage);
      const wouldExceed = (currentUsage + units) > quota;

      if (!wouldExceed) {
        return {
          allowed: true,
          remaining: remaining - units,
          currentUsage,
          quota,
          enforcement: entitlement.enforcement,
        };
      }

      // Overage billing — always allow, charge later
      if (entitlement.enforcement === 'bill_overage') {
        return {
          allowed: true,
          reason: 'Overage will be billed',
          remaining: 0,
          currentUsage,
          quota,
          enforcement: entitlement.enforcement,
        };
      }

      // Grace-then-lock: check grace period
      if (entitlement.enforcement === 'grace_then_lock' && checkGracePeriod) {
        const graceCheck = await this.checkGracePeriod(tenantId, meterKey, currentUsage + units, quota);
        if (graceCheck.allowed) {
          return {
            allowed: true,
            reason: 'Allowed during grace period',
            remaining: 0,
            currentUsage,
            quota,
            enforcement: entitlement.enforcement,
            gracePeriodRemaining: graceCheck.gracePeriodRemaining,
            suggestedAction: 'Upgrade plan before grace period expires',
          };
        }
      }

      // hard_lock or grace expired
      return {
        allowed: false,
        reason: `Quota exceeded for ${meterKey}`,
        remaining: 0,
        currentUsage,
        quota,
        enforcement: entitlement.enforcement,
        suggestedAction: 'Upgrade plan or wait for reset',
      };
    } catch (error) {
      logger.error('Error checking usage allowance', error as Error, { tenantId, meterKey });
      // Fail open on error to avoid blocking production traffic
      return { allowed: true };
    }
  }

  /**
   * Get usage summary with entitlements for all meters.
   */
  async getUsageWithEntitlements(tenantId: string): Promise<{
    usage: Record<string, UsageMetricStatus>;
    snapshot: EntitlementSnapshot | null;
  }> {
    try {
      const snapshot = await this.snapshotService.getCurrentSnapshot(tenantId);
      if (!snapshot) {
        return { usage: {}, snapshot: null };
      }

      const usage: Record<string, UsageMetricStatus> = {};

      for (const [meterKey, entitlement] of Object.entries(snapshot.entitlements)) {
        const current = await this.getCurrentUsage(tenantId, meterKey as MeterKey);
        const quota = (entitlement as MeterEntitlement).included;
        const remaining = quota < 0 ? Infinity : Math.max(0, quota - current);
        const percentage = quota > 0 ? (current / quota) * 100 : 0;

        let status: 'ok' | 'warning' | 'exceeded' = 'ok';
        if (percentage >= 100) {
          status = 'exceeded';
        } else if (percentage >= 80) {
          status = 'warning';
        }

        usage[meterKey] = {
          current,
          quota,
          remaining,
          percentage: Math.round(percentage * 100) / 100,
          enforcement: (entitlement as MeterEntitlement).enforcement,
          status,
        };
      }

      return { usage, snapshot };
    } catch (error) {
      logger.error('Error getting usage with entitlements', error as Error, { tenantId });
      return { usage: {}, snapshot: null };
    }
  }

  /**
   * Check grace period allowance.
   */
  async checkGracePeriod(
    tenantId: string,
    meterKey: MeterKey,
    requestedUsage: number,
    quota: number
  ): Promise<{ allowed: boolean; gracePeriodRemaining?: number }> {
    try {
      const graceWindowStart = new Date(Date.now() - GRACE_PERIOD_HOURS * 60 * 60 * 1000).toISOString();

      const { data: recentOverages, error } = await this.supabase
        .from('usage_events')
        .select('timestamp')
        .eq('tenant_id', tenantId)
        .eq('metric', meterKey)
        .gt('timestamp', graceWindowStart)
        .gt('quantity', quota);

      if (error) {
        logger.warn('Error checking grace period', error);
        return { allowed: false };
      }

      const graceLimit = quota * GRACE_PERIOD_MULTIPLIER;

      if (!recentOverages || recentOverages.length === 0) {
        // First overage — start grace period
        if (requestedUsage <= graceLimit) {
          return { allowed: true, gracePeriodRemaining: GRACE_PERIOD_HOURS };
        }
        return { allowed: false };
      }

      // Check if still within grace window
      const lastOverage = recentOverages[recentOverages.length - 1];
      const hoursSince = (Date.now() - new Date(lastOverage.timestamp).getTime()) / (1000 * 60 * 60);

      if (hoursSince < GRACE_PERIOD_HOURS && requestedUsage <= graceLimit) {
        return { allowed: true, gracePeriodRemaining: GRACE_PERIOD_HOURS - hoursSince };
      }

      return { allowed: false };
    } catch (error) {
      logger.error('Error in grace period check', error as Error);
      return { allowed: false };
    }
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  /**
   * Get current usage for a tenant + meter from usage_quotas.
   */
  private async getCurrentUsage(tenantId: string, meterKey: MeterKey): Promise<number> {
    const { data, error } = await this.supabase
      .from('usage_quotas')
      .select('current_usage')
      .eq('tenant_id', tenantId)
      .eq('metric', meterKey)
      .order('period_start', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.warn('Error fetching current usage', error);
      return 0;
    }

    return data?.current_usage ?? 0;
  }
}
