/**
 * Usage Enforcement Middleware
 * Enforces usage quotas and caps for billing
 */

import { Request, Response, NextFunction } from 'express';
import MetricsCollector from '../services/metering/MetricsCollector.js';
import EntitlementsService from '../services/billing/EntitlementsService.js';
import { createLogger } from '../lib/logger.js';
import { BillingMetric } from '../config/billing.js';

const logger = createLogger({ component: 'UsageEnforcementMiddleware' });

interface UsageEnforcementOptions {
  metric: BillingMetric;
  checkGracePeriod?: boolean;
  allowPartialUsage?: boolean;
}

/**
 * Middleware to enforce usage quotas
 */
export function usageEnforcementMiddleware(options: UsageEnforcementOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).tenantId;
      const userId = (req as any).userId;

      if (!tenantId) {
        logger.warn('No tenant ID in request', { path: req.path });
        return next();
      }

      const { metric, checkGracePeriod = true, allowPartialUsage = false } = options;

      // Check if usage is allowed
      const entitlementCheck = await EntitlementsService.checkUsageAllowed(
        tenantId,
        metric,
        1, // Assume 1 unit for middleware check
        { checkGracePeriod }
      );

      if (!entitlementCheck.allowed) {
        logger.warn('Usage blocked by entitlement check', {
          tenantId,
          metric,
          reason: entitlementCheck.reason,
          path: req.path
        });

        // Return 402 Payment Required for quota exceeded
        return res.status(402).json({
          error: 'Payment Required',
          message: 'Usage quota exceeded',
          code: 'QUOTA_EXCEEDED',
          details: {
            metric,
            reason: entitlementCheck.reason,
            grace_period_remaining: entitlementCheck.gracePeriodRemaining,
            suggested_action: entitlementCheck.suggestedAction
          }
        });
      }

      // Add usage context to request for tracking
      (req as any).usageContext = {
        tenantId,
        userId,
        metric,
        entitlementCheck,
        timestamp: new Date().toISOString()
      };

      logger.debug('Usage allowed', {
        tenantId,
        metric,
        remaining: entitlementCheck.remaining,
        path: req.path
      });

      next();
    } catch (error) {
      logger.error('Error in usage enforcement middleware', error as Error, {
        path: req.path,
        tenantId: (req as any).tenantId
      });

      // On error, allow request to proceed (fail open)
      next();
    }
  };
}

/**
 * Middleware to record usage after successful request
 */
export function usageRecordingMiddleware(options: UsageEnforcementOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store original end function
    const originalEnd = res.end;
    const usageContext = (req as any).usageContext;

    if (!usageContext) {
      return next();
    }

    // Override res.end to record usage after response
    res.end = function(...args: any[]) {
      // Record usage if response was successful (2xx status)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          // Record the usage (this would be async, but middleware needs to be sync)
          setImmediate(async () => {
            try {
              await MetricsCollector.recordUsage(
                usageContext.tenantId,
                usageContext.metric,
                1, // Units used
                {
                  user_id: usageContext.userId,
                  request_path: req.path,
                  request_method: req.method,
                  response_status: res.statusCode,
                  timestamp: usageContext.timestamp
                }
              );

              logger.debug('Usage recorded', {
                tenantId: usageContext.tenantId,
                metric: usageContext.metric,
                path: req.path
              });
            } catch (recordError) {
              logger.error('Failed to record usage', recordError as Error, {
                tenantId: usageContext.tenantId,
                metric: usageContext.metric
              });
            }
          });
        } catch (error) {
          logger.error('Error setting up usage recording', error as Error);
        }
      }

      // Call original end function
      originalEnd.apply(this, args);
    };

    next();
  };
}

/**
 * Combined middleware that enforces and records usage
 */
export function usageEnforcement(options: UsageEnforcementOptions) {
  return [
    usageEnforcementMiddleware(options),
    usageRecordingMiddleware(options)
  ];
}

/**
 * Check usage allowance without blocking (for informational purposes)
 */
export async function checkUsageAllowance(
  tenantId: string,
  metric: BillingMetric,
  units: number = 1
): Promise<{
  allowed: boolean;
  reason?: string;
  remaining?: number;
  gracePeriodRemaining?: number;
  suggestedAction?: string;
}> {
  try {
    const check = await EntitlementsService.checkUsageAllowed(tenantId, metric, units);

    return {
      allowed: check.allowed,
      reason: check.reason,
      remaining: check.remaining,
      gracePeriodRemaining: check.gracePeriodRemaining,
      suggestedAction: check.suggestedAction
    };
  } catch (error) {
    logger.error('Error checking usage allowance', error as Error, { tenantId, metric });
    // Fail open on error
    return { allowed: true };
  }
}
