/**
 * Usage Cache
 * Redis-backed cache for real-time usage quota checks
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { BILLING_METRICS, USAGE_CACHE_TTL } from "../../config/billing.js"
import type { BillingMetric } from "../../config/billing.js"
import { createLogger } from "../../lib/logger.js"
import { getEnvVar, getSupabaseConfig } from "@shared/lib/env";
import Redis, { type RedisClientType } from "redis";

// Constants
const PERCENTAGE_MULTIPLIER = 100;
const MILLISECONDS_MULTIPLIER = 1000;

const logger = createLogger({ component: "UsageCache" });

const { url: supabaseUrl, serviceRoleKey: supabaseServiceRoleKey } =
  getSupabaseConfig();

let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseServiceRoleKey) {
  supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
} else {
  logger.warn(
    "Supabase billing not configured: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing"
  );
}

// Redis client (optional - will use in-memory fallback if not available)
let redisClient: RedisClientType | null = null;
let redisConnectionPromise: Promise<RedisClientType | void> | null = null;

// Initialize Redis connection asynchronously with proper error handling
function initializeRedis(): void {
  try {
    redisClient = Redis.createClient({
      url: getEnvVar("REDIS_URL", { defaultValue: "redis://localhost:6379" }),
    });

    // Handle connection errors
    redisClient.on("error", (err) => {
      logger.warn("Redis connection error", { error: err.message });
    });

    redisClient.on("ready", () => {
      logger.info("Redis connected for usage cache");
    });

    // Connect asynchronously and handle errors
    redisConnectionPromise = redisClient.connect().catch((err) => {
      logger.warn("Redis connection failed, using in-memory cache", {
        error: err.message,
      });
      redisClient = null;
    });
  } catch (_error) {
    logger.warn("Redis not available, using in-memory cache");
    redisClient = null;
  }
}

// Initialize on module load
initializeRedis();

interface CacheEntry {
  value: number;
  expiresAt: number;
}

// In-memory fallback
const memoryCache = new Map<string, CacheEntry>();

class UsageCache {
  /**
   * Get current usage from cache
   */
  async getCurrentUsage(
    tenantId: string,
    metric: BillingMetric
  ): Promise<number> {
    const key = `usage:${tenantId}:${metric}`;

    try {
      // Try Redis first
      if (redisClient && redisClient.isReady) {
        logger.debug("Checking Redis cache", { tenantId, metric, key });
        try {
          const cached = await redisClient.get(key);
          if (cached !== null) {
            const parsedValue = parseFloat(cached);
            if (!isNaN(parsedValue)) {
              logger.debug("Redis cache hit", {
                tenantId,
                metric,
                value: parsedValue,
              });
              return parsedValue;
            } else {
              logger.warn("Invalid cached value in Redis, treating as miss", {
                tenantId,
                metric,
                cachedValue: cached,
              });
            }
          } else {
            logger.debug("Redis cache miss", { tenantId, metric });
          }
        } catch (redisError: unknown) {
          logger.warn("Redis operation failed, falling back to memory cache", {
            tenantId,
            metric,
            error:
              redisError instanceof Error
                ? redisError.message
                : String(redisError),
          });
        }
      } else {
        logger.debug("Redis not available, using memory cache", {
          tenantId,
          metric,
        });
        // Check in-memory cache
        const cached = memoryCache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
          logger.debug("Memory cache hit", {
            tenantId,
            metric,
            value: cached.value,
          });
          return cached.value;
        } else {
          logger.debug("Memory cache miss", { tenantId, metric });
        }
      }

      // Cache miss - fetch from database
      logger.debug("Fetching usage from database", { tenantId, metric });
      const usage = await this.fetchUsageFromDB(tenantId, metric);
      await this.set(key, usage);

      return usage;
    } catch (error) {
      logger.error("Error getting usage from cache", error as Error);
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
      logger.error("Error getting quota from cache", error as Error);
      return this.fetchQuotaFromDB(tenantId, metric);
    }
  }

  /**
   * Check if over quota
   * @param tenantId - Tenant ID
   * @param metric - Billing metric to check
   * @param isHardCap - If true, fail closed on errors (block request). Used for free tier hard caps.
   */
  async isOverQuota(
    tenantId: string,
    metric: BillingMetric,
    isHardCap: boolean = false
  ): Promise<boolean> {
    try {
      const [usage, quota] = await Promise.all([
        this.getCurrentUsage(tenantId, metric),
        this.getQuota(tenantId, metric),
      ]);

      return usage >= quota;
    } catch (error) {
      logger.error("Error checking quota", error as Error, {
        tenantId,
        metric,
        isHardCap,
      });
      // Fail closed for hard-capped metrics (free tier) to prevent abuse
      // Fail open for soft-capped metrics (paid tiers) to avoid blocking paying customers
      if (isHardCap) {
        logger.warn("Failing closed for hard-capped metric due to error", {
          tenantId,
          metric,
        });
        return true; // Block the request
      }
      return false; // Allow the request
    }
  }

  /**
   * Get usage percentage
   */
  async getUsagePercentage(
    tenantId: string,
    metric: BillingMetric
  ): Promise<number> {
    try {
      const [usage, quota] = await Promise.all([
        this.getCurrentUsage(tenantId, metric),
        this.getQuota(tenantId, metric),
      ]);

      if (quota === 0) return 0;
      return Math.round((usage / quota) * PERCENTAGE_MULTIPLIER);
    } catch (error) {
      logger.error("Error calculating usage percentage", error as Error);
      return 0;
    }
  }

  /**
   * Refresh cache from database
   */
  async refreshCache(tenantId: string): Promise<void> {
    for (const metric of BILLING_METRICS) {
      try {
        const usage = await this.fetchUsageFromDB(tenantId, metric);
        const quota = await this.fetchQuotaFromDB(tenantId, metric);

        await this.set(`usage:${tenantId}:${metric}`, usage);
        await this.set(`quota:${tenantId}:${metric}`, quota);
      } catch (error) {
        logger.error("Error refreshing cache", error as Error, {
          tenantId,
          metric,
        });
      }
    }

    logger.info("Cache refreshed", { tenantId });
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
          expiresAt: Date.now() + USAGE_CACHE_TTL * MILLISECONDS_MULTIPLIER,
        });
      }
    } catch (error) {
      logger.error("Error setting cache", error as Error);
    }
  }

  /**
   * Fetch current usage from database
   */
  private async fetchUsageFromDB(
    tenantId: string,
    metric: BillingMetric
  ): Promise<number> {
    if (!supabase) {
      throw new Error("Billing service not configured");
    }
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data, error } = await supabase.rpc("get_current_usage", {
      p_tenant_id: tenantId,
      p_metric: metric,
      p_period_start: periodStart.toISOString(),
      p_period_end: now.toISOString(),
    });

    if (error) {
      logger.error("Error fetching usage from DB", error);
      return 0;
    }

    return parseFloat(data || 0);
  }

  /**
   * Fetch quota from database
   */
  private async fetchQuotaFromDB(
    tenantId: string,
    metric: BillingMetric
  ): Promise<number> {
    if (!supabase) {
      throw new Error("Billing service not configured");
    }
    const { data, error } = await supabase
      .from("usage_quotas")
      .select("quota_amount")
      .eq("tenant_id", tenantId)
      .eq("metric", metric)
      .gte("period_end", new Date().toISOString())
      .single();

    if (error || !data) {
      logger.warn("No quota found", { tenantId, metric });
      return Infinity; // No limit
    }

    return parseFloat(data.quota_amount);
  }

  /**
   * Clear cache for tenant
   */
  async clearCache(tenantId: string): Promise<void> {
    for (const metric of BILLING_METRICS) {
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

    logger.info("Cache cleared", { tenantId });
  }
}

export default new UsageCache();
