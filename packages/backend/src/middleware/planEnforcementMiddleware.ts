/**
 * Plan Enforcement Middleware
 * Checks usage quotas before allowing requests
 */

import { createLogger } from '@shared/lib/logger';
import { createServerSupabaseClient } from '@shared/lib/supabase';
import { NextFunction, Request, Response } from 'express';

import type { AuthenticatedRequest } from './auth.js';

interface PlanRequest extends AuthenticatedRequest {
  tenantSettings?: { billing?: { planTier?: string } };
  useFallbackModel?: boolean;
  sessionId?: string;
  requestId?: string;
}

import { BillingMetric, isHardCap, PlanTier } from '../config/billing';
import { subscriptionService as SubscriptionService } from '../services/billing/SubscriptionService';
import { llmCostTracker } from '../services/llm/LLMCostTracker.js';
import GracePeriodService from '../services/metering/GracePeriodService';
import UsageCache from '../services/metering/UsageCache';
import { getAuditTrailService } from '../services/security/AuditTrailService.js';

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
  const userTier = (req as PlanRequest)?.user?.subscription_tier
    ?? (req as PlanRequest)?.user?.plan_tier
    ?? (req as PlanRequest)?.user?.planTier;

  if (isPlanTier(userTier)) {
    return userTier;
  }

  const tenantSettingsTier = (req as PlanRequest)?.tenantSettings?.billing?.planTier;
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

  // Try to get from organizations table (source of truth for configuration)
  try {
    const supabase = createServerSupabaseClient();
    const { data: org, error } = await supabase
      .from('organizations')
      .select('tier')
      .eq('id', tenantId)
      .single();

    if (!error && org) {
      let tier = org.tier;
      // Map tenant tier to plan tier
      if (tier === 'professional' || tier === 'starter') {
        tier = 'standard';
      }

      if (isPlanTier(tier)) {
        return tier as PlanTier;
      }
    }
  } catch (error) {
    logger.warn('Failed to resolve plan tier from organization', {
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
      const tenantId = (req as PlanRequest).tenantId;

      if (!tenantId) {
        // No tenant - skip enforcement (public endpoint)
        return next();
      }

      const { metric, hardCapOnly = false } = config;

      const monthlyTokensPromise =
        metric === 'llm_tokens'
          ? llmCostTracker.getMonthlyTokensByTenant(tenantId)
          : Promise.resolve(null);

      // Get current usage, quota, and plan tier
      const [usage, quota, isOver, planTier, monthlyTokens] = await Promise.all([
        UsageCache.getCurrentUsage(tenantId, metric),
        UsageCache.getQuota(tenantId, metric),
        UsageCache.isOverQuota(tenantId, metric),
        resolvePlanTier(req, tenantId),
        monthlyTokensPromise,
      ]);

      // Monthly token budgets should downgrade to fallback when exceeded.
      if (metric === 'llm_tokens' && monthlyTokens !== null && quota > 0 && monthlyTokens >= quota) {
        (req as PlanRequest).useFallbackModel = true;
        res.setHeader('X-LLM-Fallback', 'true');

        // Notify user via UI
        try {
          await realtimeUpdateService.pushUpdate(tenantId, {
            id: `llm-fallback-${Date.now()}`,
            type: 'notification',
            target: 'user',
            operation: 'notify',
            payload: {
              type: 'warning',
              title: 'Monthly Token Budget Exceeded',
              message: 'Your monthly LLM token budget has been reached. Requests are now using fallback AI service with reduced capabilities.',
              action: 'upgrade_plan',
              metadata: {
                monthlyTokens,
                quota,
                exceededBy: monthlyTokens - quota,
              },
            },
            timestamp: new Date().toISOString(),
          });
        } catch (notifyError) {
          logger.warn('Failed to send UI notification for LLM fallback', { error: notifyError });
        }

        try {
          const audit = getAuditTrailService();
          void audit.logImmediate({
            eventType: 'security_event',
            actorId: (req as PlanRequest).user?.id || 'system',
            auth0Sub: (req as PlanRequest).user?.sub || (req as PlanRequest).user?.auth0_sub || (req as PlanRequest).user?.id || 'system',
            actorType: 'service',
            resourceId: tenantId,
            resourceType: 'data',
            action: 'llm_fallback_applied',
            outcome: 'success',
            details: {
              metric,
              quota,
              monthlyTokens,
            },
            ipAddress: 'system',
            userAgent: 'system',
            timestamp: Date.now(),
            sessionId: (req as PlanRequest).sessionId || 'unknown',
            correlationId: (req as PlanRequest).requestId || 'llm-fallback',
            riskScore: 0,
            complianceFlags: [],
            tenantId,
          });
        } catch (err) {
          logger.warn('Failed to log LLM fallback to audit trail', { error: err instanceof Error ? err.message : String(err) });
        }
      }

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
