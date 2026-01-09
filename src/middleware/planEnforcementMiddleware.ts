/**
 * Plan Enforcement Middleware
 * Checks usage quotas before allowing requests
 */

import { NextFunction, Request, Response } from 'express';
import UsageCache from '../services/metering/UsageCache';
import GracePeriodService from '../services/metering/GracePeriodService';
import { BillingMetric, GRACE_PERIOD_MS, isHardCap, PlanTier } from '../config/billing';
import { createLogger } from '../lib/logger';
import SubscriptionService from '../services/billing/SubscriptionService';

const logger = createLogger({ component: 'PlanEnforcementMiddleware' });
const PLAN_TIERS: PlanTier[] = ['free', 'standard', 'enterprise'];
const DEFAULT_PLAN_TIER: PlanTier = 'free';

interface EnforcementConfig {
  metric: BillingMetric;
  checkBeforeRequest?: boolean;
  hardCapOnly?: boolean;
}

function isPlanTier(value: unknown): value is PlanTier {
  return typeof value === 'string' && PLAN_TIERS.includes(value as PlanTier);
}

async function resolvePlanTier(req: Request, tenantId: string): Promise<PlanTier> {
  const userTier = (req as any)?.user?.subscription_tier
    ?? (req as any)?.user?.plan_tier
    ?? (req as any)?.user?.planTier;

  if (isPlanTier(userTier)) {
    return userTier;
  }

  const tenantSettingsTier = (req as any)?.tenantSettings?.billing?.planTier;
  if (isPlanTier(tenantSettingsTier)) {
    return tenantSettingsTier;
  }

  try {
    const subscription = await SubscriptionService.getActiveSubscription(tenantId);
    if (isPlanTier(subscription?.plan_tier)) {
      return subscription.plan_tier;
    }
  } catch (error) {
    logger.warn('Failed to resolve plan tier from subscription', {
      tenantId,
      error: error instanceof Error ? error.message : error,
    });
  }

  return DEFAULT_PLAN_TIER;
}

/**
 * Create plan enforcement middleware for specific metric
 */
export function createPlanEnforcement(config: EnforcementConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).tenantId || req.headers['x-tenant-id'] as string;
      
      if (!tenantId) {
        // No tenant - skip enforcement (public endpoint)
        return next();
      }

      const { metric, hardCapOnly = false } = config;

      // Get current usage, quota, and plan tier
      const [usage, quota, isOver, planTier] = await Promise.all([
        UsageCache.getCurrentUsage(tenantId, metric),
        UsageCache.getQuota(tenantId, metric),
        UsageCache.isOverQuota(tenantId, metric),
        resolvePlanTier(req, tenantId),
      ]);

      // Check if over quota
      if (isOver) {
        const percentage = quota > 0 ? Math.round((usage / quota) * 100) : 0;

        logger.warn('Quota exceeded', {
          tenantId,
          metric,
          usage,
          quota,
          percentage,
        });

        // Check if hard cap
        const isHard = isHardCap(planTier, metric);

        if (isHard || hardCapOnly) {
          // Hard cap - reject immediately
          return res.status(402).json({
            error: 'Quota exceeded',
            code: 'QUOTA_EXCEEDED',
            metric,
            usage,
            quota,
            message: `You have exceeded your ${metric} quota. Please upgrade your plan.`,
          });
        }

        // Soft cap - check grace period
        const inGracePeriod = await GracePeriodService.isInGracePeriod(tenantId, metric);
        
        if (!inGracePeriod) {
          // Start grace period
          await GracePeriodService.startGracePeriod(tenantId, metric, usage, quota);
        }

        const gracePeriodExpiration = await GracePeriodService.getGracePeriodExpiration(tenantId, metric);
        const isExpired = gracePeriodExpiration && gracePeriodExpiration < new Date();

        if (isExpired) {
          // Grace period expired - enforce limit
          return res.status(402).json({
            error: 'Quota exceeded',
            code: 'QUOTA_EXCEEDED_GRACE_EXPIRED',
            metric,
            usage,
            quota,
            gracePeriodExpired: gracePeriodExpiration?.toISOString(),
            message: `Your grace period has expired. Please upgrade your plan to continue.`,
          });
        }
        
        // Still in grace period - allow with warning
        res.setHeader('X-Quota-Warning', 'true');
        res.setHeader('X-Quota-Metric', metric);
        res.setHeader('X-Quota-Usage', usage.toString());
        res.setHeader('X-Quota-Limit', quota.toString());
        res.setHeader('X-Grace-Period-Expires', gracePeriodExpiration?.toISOString() || '');
      } else {
        // Within quota - add headers
        const remaining = quota - usage;
        const percentage = quota > 0 ? Math.round((usage / quota) * 100) : 0;

        res.setHeader('X-Quota-Remaining', remaining.toString());
        res.setHeader('X-Quota-Percentage', percentage.toString());
      }

      next();
    } catch (error) {
      logger.error('Plan enforcement error', error as Error);
      // Fail open - allow request
      next();
    }
  };
}

/**
 * LLM tokens enforcement
 */
export const enforceLLMQuota = createPlanEnforcement({
  metric: 'llm_tokens',
  checkBeforeRequest: true,
});

/**
 * Agent execution enforcement
 */
export const enforceAgentQuota = createPlanEnforcement({
  metric: 'agent_executions',
  checkBeforeRequest: true,
});

/**
 * API calls enforcement
 */
export const enforceAPIQuota = createPlanEnforcement({
  metric: 'api_calls',
  checkBeforeRequest: true,
});

/**
 * Storage enforcement (hard cap)
 */
export const enforceStorageQuota = createPlanEnforcement({
  metric: 'storage_gb',
  hardCapOnly: true,
});

/**
 * User seats enforcement (hard cap)
 */
export const enforceUserSeatsQuota = createPlanEnforcement({
  metric: 'user_seats',
  hardCapOnly: true,
});

export default {
  createPlanEnforcement,
  enforceLLMQuota,
  enforceAgentQuota,
  enforceAPIQuota,
  enforceStorageQuota,
  enforceUserSeatsQuota,
};
