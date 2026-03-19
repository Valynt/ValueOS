/**
 * GroundTruthCache
 *
 * Redis-backed cache layer for ground truth data.
 * Cache SEC filing data with 24-hour TTL, benchmark data with 1-hour TTL.
 *
 * Reference: openspec/changes/ground-truth-integration/tasks.md §9
 */

import { logger } from "../../lib/logger.js";
import { getRedisClient } from "../../lib/redisClient.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CacheEntry<T> {
  data: T;
  retrievedAt: string;
  ttl: number;
}

export interface CacheResult<T> {
  data: T;
  metadata: {
    hit: boolean;
    retrievedAt: string;
    remainingTtl?: number;
  };
}

export type CacheTier = "sec_filing" | "benchmark" | "general";

// ---------------------------------------------------------------------------
// Cache Configuration
// ---------------------------------------------------------------------------

const CACHE_TTLS: Record<CacheTier, number> = {
  sec_filing: 24 * 60 * 60, // 24 hours
  benchmark: 60 * 60, // 1 hour
  general: 30 * 60, // 30 minutes
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class GroundTruthCache {
  private static instance: GroundTruthCache;

  private constructor() {}

  static getInstance(): GroundTruthCache {
    if (!GroundTruthCache.instance) {
      GroundTruthCache.instance = new GroundTruthCache();
    }
    return GroundTruthCache.instance;
  }

  /**
   * Get data from cache
   */
  async get<T>(key: string): Promise<CacheResult<T> | null> {
    try {
      const redis = await getRedisClient();
      if (!redis) {
        return null;
      }

      const cached = await redis.get(key);
      if (!cached) {
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(cached);
      const remainingTtl = await redis.ttl(key);

      return {
        data: entry.data,
        metadata: {
          hit: true,
          retrievedAt: entry.retrievedAt,
          remainingTtl: remainingTtl > 0 ? remainingTtl : undefined,
        },
      };
    } catch (error) {
      logger.error("Cache get error", {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Store data in cache
   */
  async set<T>(
    key: string,
    data: T,
    tierOrTtl: CacheTier | number = "general"
  ): Promise<boolean> {
    try {
      const redis = await getRedisClient();
      if (!redis) {
        return false;
      }

      const ttl =
        typeof tierOrTtl === "number"
          ? tierOrTtl
          : CACHE_TTLS[tierOrTtl];
      const entry: CacheEntry<T> = {
        data,
        retrievedAt: new Date().toISOString(),
        ttl,
      };

      await redis.set(key, JSON.stringify(entry), { EX: ttl });
      return true;
    } catch (error) {
      logger.error("Cache set error", {
        key,
        tier: typeof tierOrTtl === "number" ? "custom" : tierOrTtl,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get or compute data with caching
   */
  async getOrCompute<T>(
    key: string,
    compute: () => Promise<T>,
    tier: CacheTier = "general"
  ): Promise<CacheResult<T>> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached) {
      return cached;
    }

    // Compute and store
    const data = await compute();
    await this.set(key, data, tier);

    return {
      data,
      metadata: {
        hit: false,
        retrievedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Invalidate cache entry
   */
  async invalidate(key: string): Promise<boolean> {
    try {
      const redis = await getRedisClient();
      if (!redis) {
        return false;
      }

      await redis.del(key);
      return true;
    } catch (error) {
      logger.error("Cache invalidate error", {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Invalidate cache entries by pattern
   */
  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const redis = await getRedisClient();
      if (!redis) {
        return 0;
      }

      const keys = await redis.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      await redis.del(keys);
      return keys.length;
    } catch (error) {
      logger.error("Cache invalidate pattern error", {
        pattern,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    tierTtls: Record<CacheTier, number>;
  }> {
    try {
      const redis = await getRedisClient();
      return {
        connected: redis !== null,
        tierTtls: { ...CACHE_TTLS },
      };
    } catch {
      return {
        connected: false,
        tierTtls: { ...CACHE_TTLS },
      };
    }
  }

  /**
   * Build cache key for SEC filing
   */
  buildFilingKey(cik: string, filingType: string, sections?: string[]): string {
    const parts = ["sec", cik, filingType];
    if (sections && sections.length > 0) {
      parts.push(sections.sort().join(","));
    }
    return parts.join(":");
  }

  /**
   * Build cache key for benchmark
   */
  buildBenchmarkKey(
    industry: string,
    kpi: string,
    companySize?: string
  ): string {
    const parts = ["benchmark", industry, kpi];
    if (companySize) parts.push(companySize);
    return parts.join(":");
  }
}

// Singleton export
export const groundTruthCache = GroundTruthCache.getInstance();
