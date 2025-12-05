/**
 * Plan Enforcement Middleware
 * Checks usage quotas before allowing requests
 */

import { Request, Response, NextFunction } from 'express';
import UsageCache from '../services/metering/UsageCache';
import { BillingMetric, GRACE_PERIOD_MS, isHardCap } from '../config/billing';
import { createLogger } from '../lib/logger';

const logger = createLogger({ component: 'PlanEnforcementMiddleware' });

interface EnforcementConfig {
  metric: BillingMetric;
  checkBeforeRequest?: boolean;
  hardCapOnly?: boolean;
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

      // Get current usage and quota
      const [usage, quota, isOver] = await Promise.all([
        UsageCache.getCurrentUsage(tenantId, metric),
        UsageCache.getQuota(tenantId, metric),
        UsageCache.isOverQuota(tenantId, metric),
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
        const isHard = isHardCap('free', metric); // TODO: Get actual plan tier

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
        // TODO: Check grace period from database
        
        // Allow with warning
        res.setHeader('X-Quota-Warning', 'true');
        res.setHeader('X-Quota-Metric', metric);
        res.setHeader('X-Quota-Usage', usage.toString());
        res.setHeader('X-Quota-Limit', quota.toString());
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
