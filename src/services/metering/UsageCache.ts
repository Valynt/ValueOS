/**
 * Usage Cache
 * Redis-backed cache for real-time usage quota checks
 */

import { createClient } from '@supabase/supabase-js';
import { BillingMetric } from '../../config/billing';
import { USAGE_CACHE_TTL } from '../../config/billing';
import { createLogger } from '../../lib/logger';

const logger = createLogger({ component: 'UsageCache' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Redis client (optional - will use in-memory fallback if not available)
let redisClient: any = null;

try {
  // Try to import redis
  const redis = require('redis');
  redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  });
  redisClient.connect();
  logger.info('Redis connected for usage cache');
} catch (error) {
  logger.warn('Redis not available, using in-memory cache');
}

// In-memory fallback
const memoryCache = new Map<string, { value: any; expiresAt: number }>();

class UsageCache {
  /**
   * Get current usage from cache
   */
  async getCurrentUsage(tenantId: string, metric: BillingMetric): Promise<number> {
    const key = `usage:${tenantId}:${metric}`;

    try {
      // Try Redis first
      if (redisClient && redisClient.isReady) {
        const cached = await redisClient.get(key);
        if (cached !== null) {
          return parseFloat(cached);
        }
      } else {
        // Check in-memory cache
        const cached = memoryCache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
          return cached.value;
        }
      }

      // Cache miss - fetch from database
      const usage = await this.fetchUsageFromDB(tenantId, metric);
      await this.set(key, usage);

      return usage;
    } catch (error) {
      logger.error('Error getting usage from cache', error as Error);
      // Fallback to database
      return this.fetchUsageFromDB(tenantId, metric);
    }
  }

  /**
   * Get quota from cache
   */
  async getQuota(tenantId: string, metric: BillingMetric): Promise<number> {
    const key = `quota:${tenantId}:${metric}`;

    try {
      // Try Redis first
      if (redisClient && redisClient.isReady) {
        const cached = await redisClient.get(key);
        if (cached !== null) {
          return parseFloat(cached);
        }
      } else {
        // Check in-memory cache
        const cached = memoryCache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
          return cached.value;
        }
      }

      // Cache miss - fetch from database
      const quota = await this.fetchQuotaFromDB(tenantId, metric);
      await this.set(key, quota);

      return quota;
    } catch (error) {
      logger.error('Error getting quota from cache', error as Error);
      return this.fetchQuotaFromDB(tenantId, metric);
    }
  }

  /**
   * Check if over quota
   */
  async isOverQuota(tenantId: string, metric: BillingMetric): Promise<boolean> {
    try {
      const [usage, quota] = await Promise.all([
        this.getCurrentUsage(tenantId, metric),
        this.getQuota(tenantId, metric),
      ]);

      return usage >= quota;
    } catch (error) {
      logger.error('Error checking quota', error as Error);
      // Fail open - allow request
      return false;
    }
  }

  /**
   * Get usage percentage
   */
  async getUsagePercentage(tenantId: string, metric: BillingMetric): Promise<number> {
    try {
      const [usage, quota] = await Promise.all([
        this.getCurrentUsage(tenantId, metric),
        this.getQuota(tenantId, metric),
      ]);

      if (quota === 0) return 0;
      return Math.round((usage / quota) * 100);
    } catch (error) {
      logger.error('Error calculating usage percentage', error as Error);
      return 0;
    }
  }

  /**
   * Refresh cache from database
   */
  async refreshCache(tenantId: string): Promise<void> {
    const metrics: BillingMetric[] = [
      'llm_tokens',
      'agent_executions',
      'api_calls',
      'storage_gb',
      'user_seats',
    ];

    for (const metric of metrics) {
      try {
        const usage = await this.fetchUsageFromDB(tenantId, metric);
        const quota = await this.fetchQuotaFromDB(tenantId, metric);

        await this.set(`usage:${tenantId}:${metric}`, usage);
        await this.set(`quota:${tenantId}:${metric}`, quota);
      } catch (error) {
        logger.error('Error refreshing cache', error as Error, { tenantId, metric });
      }
    }

    logger.info('Cache refreshed', { tenantId });
  }

  /**
   * Set value in cache
   */
  private async set(key: string, value: number): Promise<void> {
    try {
      if (redisClient && redisClient.isReady) {
        await redisClient.setEx(key, USAGE_CACHE_TTL, value.toString());
      } else {
        // In-memory cache
        memoryCache.set(key, {
          value,
          expiresAt: Date.now() + USAGE_CACHE_TTL * 1000,
        });
      }
    } catch (error) {
      logger.error('Error setting cache', error as Error);
    }
  }

  /**
   * Fetch current usage from database
   */
  private async fetchUsageFromDB(tenantId: string, metric: BillingMetric): Promise<number> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data, error } = await supabase.rpc('get_current_usage', {
      p_tenant_id: tenantId,
      p_metric: metric,
      p_period_start: periodStart.toISOString(),
      p_period_end: now.toISOString(),
    });

    if (error) {
      logger.error('Error fetching usage from DB', error);
      return 0;
    }

    return parseFloat(data || 0);
  }

  /**
   * Fetch quota from database
   */
  private async fetchQuotaFromDB(tenantId: string, metric: BillingMetric): Promise<number> {
    const { data, error } = await supabase
      .from('usage_quotas')
      .select('quota_amount')
      .eq('tenant_id', tenantId)
      .eq('metric', metric)
      .gte('period_end', new Date().toISOString())
      .single();

    if (error || !data) {
      logger.warn('No quota found', { tenantId, metric });
      return Infinity; // No limit
    }

    return parseFloat(data.quota_amount);
  }

  /**
   * Clear cache for tenant
   */
  async clearCache(tenantId: string): Promise<void> {
    const metrics: BillingMetric[] = [
      'llm_tokens',
      'agent_executions',
      'api_calls',
      'storage_gb',
      'user_seats',
    ];

    for (const metric of metrics) {
      const usageKey = `usage:${tenantId}:${metric}`;
      const quotaKey = `quota:${tenantId}:${metric}`;

      if (redisClient && redisClient.isReady) {
        await redisClient.del(usageKey);
        await redisClient.del(quotaKey);
      } else {
        memoryCache.delete(usageKey);
        memoryCache.delete(quotaKey);
      }
    }

    logger.info('Cache cleared', { tenantId });
  }
}

export default new UsageCache();
