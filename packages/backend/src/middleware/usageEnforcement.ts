/**
 * Usage Enforcement Middleware
 * Enforces usage quotas and caps for billing
 */

import { NextFunction, Request, Response } from 'express';
import { getRequestSupabaseClient } from '@shared/lib/supabase';

import { BillingMetric } from '../config/billing.js';
import { createLogger } from '../lib/logger.js';
import { EntitlementsService } from '../services/billing/EntitlementsService.js';
import { createCounter } from '../services/lib/observability/index.js';
import { getMetricsCollector } from '../services/monitoring/MetricsCollector.js';

const logger = createLogger({ component: 'UsageEnforcementMiddleware' });
const usageEnforcementFailOpenCounter = createCounter(
  'usage_enforcement_fail_open_override_total',
  'Number of requests permitted because usage enforcement fail-open override is active'
);

function getEntitlementsService(req: Request): EntitlementsService {
  return new EntitlementsService(getRequestSupabaseClient(req));
}

interface UsageEnforcementOptions {
  metric: BillingMetric;
  checkGracePeriod?: boolean;
  allowPartialUsage?: boolean;
}

function isUsageEnforcementFailOpenEnabled(): boolean {
  return process.env.USAGE_ENFORCEMENT_FAIL_OPEN === 'true';
}

/**
 * Middleware to enforce usage quotas
 */
export function usageEnforcementMiddleware(options: UsageEnforcementOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId;
      const userId = req.userId;

      if (!tenantId) {
        logger.warn('No tenant ID in request', { path: req.path });
        return next();
      }

      const { metric, checkGracePeriod = true, allowPartialUsage = false } = options;

      // Check if usage is allowed
      const entitlementCheck = await getEntitlementsService(req).checkUsageAllowed(
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

        // Return 402 Payment Required for quota exceeded.
        // Body shape matches the sprint plan spec so the UI can render a
        // structured upgrade prompt without parsing the reason string.
        return res.status(402).json({
          allowed: false,
          reason: entitlementCheck.reason ?? 'quota_exceeded',
          meter_key: metric,
          cap: entitlementCheck.quota ?? null,
          used: entitlementCheck.currentUsage ?? null,
          upgrade_url: '/billing?tab=plans',
          grace_period_remaining: entitlementCheck.gracePeriodRemaining ?? null,
          suggested_action: entitlementCheck.suggestedAction ?? 'Upgrade your plan to continue.',
        });
      }

      // Add usage context to request for tracking
      req.usageContext = {
        tenantId,
        userId,
        metric,
        entitlementCheck,
        timestamp: new Date().toISOString()
      };

      // Soft limit: warn but do not block. The UI reads this header to show
      // the threshold alert banner (Sprint 16 KR4).
      if (entitlementCheck.status === 'warning') {
        res.setHeader('X-Usage-Warning', `${metric} usage is at or above 80% of quota`);
        logger.warn('Usage approaching limit', {
          tenantId,
          metric,
          remaining: entitlementCheck.remaining,
          path: req.path,
        });
      }

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
        tenantId: req.tenantId
      });

      const tenantId = req.tenantId ?? 'unknown';
      const route = req.route?.path ? String(req.route.path) : req.path;
      const failOpenEnabled = isUsageEnforcementFailOpenEnabled();

      if (failOpenEnabled) {
        logger.warn('Usage enforcement fail-open override active; permitting request despite entitlement dependency failure', {
          tenantId,
          route,
          metric: options.metric,
          reason: 'entitlements_dependency_unavailable',
          securityImpact: 'quota_enforcement_bypassed'
        });

        usageEnforcementFailOpenCounter.add(1, {
          metric: options.metric,
          tenant_id: tenantId,
          route,
        });

        next();
        return;
      }

      return res.status(503).json({
        allowed: false,
        reason: 'entitlements_dependency_unavailable',
        reason_code: 'ENTITLEMENTS_DEPENDENCY_UNAVAILABLE',
        meter_key: options.metric,
        retryable: true,
        message: 'Usage enforcement is temporarily unavailable. Please retry shortly.',
      });
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
const usageContext = req.usageContext;

    if (!usageContext) {
      return next();
    }

    // Override res.end to record usage after response
    const wrappedEnd: typeof originalEnd = function(this: Response, ...args: Parameters<typeof originalEnd>) {
      // Record usage if response was successful (2xx status)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Fire-and-forget usage recording
        setImmediate(() => {
          logger.debug('Usage recorded', {
            tenantId: usageContext.tenantId,
            metric: usageContext.metric,
            path: req.path
          });
          getMetricsCollector().recordUsage({
            tenantId: usageContext.tenantId,
            metric: usageContext.metric,
            path: req.path,
            method: req.method,
            statusCode: res.statusCode,
          });
        });
      }

      // Call original end function
      return originalEnd.apply(this, args);
    } as typeof originalEnd;
    res.end = wrappedEnd;

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
    const check = await getEntitlementsService().checkUsageAllowed(tenantId, metric, units);

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
