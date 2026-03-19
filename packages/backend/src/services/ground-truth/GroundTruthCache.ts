/**
 * GroundTruthCache
 *
 * Redis-backed cache layer for ground truth data.
 * Cache SEC filing data with 24-hour TTL, benchmark data with 1-hour TTL.
 *
 * Reference: openspec/changes/ground-truth-integration/tasks.md §9
 */

import {
  cacheInvalidationBatchesTotal,
  cacheInvalidationDurationMs,
  cacheInvalidationKeysDeletedTotal,
} from "../../lib/metrics/cacheMetrics.js";
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

interface RedisDeletionPipeline {
  unlink: (key: string) => RedisDeletionPipeline;
  del: (key: string) => RedisDeletionPipeline;
  exec: () => Promise<Array<number | null>>;
}

interface RedisCacheClient {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, options: { EX: number }) => Promise<unknown>;
  ttl: (key: string) => Promise<number>;
  del: (...keys: string[]) => Promise<number>;
  scan: (
    cursor: string,
    options: { MATCH: string; COUNT: number }
  ) => Promise<[string, string[]]>;
  multi: () => RedisDeletionPipeline;
}

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
  private static readonly CACHE_METRIC_NAME = "ground-truth";
  private static readonly INVALIDATION_SCAN_BATCH_SIZE = 100;
  private static readonly INVALIDATION_DELETE_BATCH_SIZE = 100;

  private constructor() {}

  static getInstance(): GroundTruthCache {
    if (!GroundTruthCache.instance) {
      GroundTruthCache.instance = new GroundTruthCache();
    }
    return GroundTruthCache.instance;
  }

  private static async deleteKeysWithCommand(
    keys: string[],
    command: "unlink" | "del",
    createPipeline: () => RedisDeletionPipeline
  ): Promise<{ deleted: number; batches: number }> {
    let deleted = 0;
    let batches = 0;

    for (
      let index = 0;
      index < keys.length;
      index += this.INVALIDATION_DELETE_BATCH_SIZE
    ) {
      const keyBatch = keys.slice(
        index,
        index + this.INVALIDATION_DELETE_BATCH_SIZE
      );
      const pipeline = createPipeline();

      for (const key of keyBatch) {
        if (command === "unlink") {
          pipeline.unlink(key);
        } else {
          pipeline.del(key);
        }
      }

      const result = await pipeline.exec();
      deleted += result.reduce(
        (count, item) => count + (typeof item === "number" ? item : 0),
        0
      );
      batches += 1;
    }

    return { deleted, batches };
  }

  private static async deleteKeys(
    redis: RedisCacheClient,
    keys: string[]
  ): Promise<{ deleted: number; batches: number }> {
    try {
      return await this.deleteKeysWithCommand(keys, "unlink", () => redis.multi());
    } catch {
      return this.deleteKeysWithCommand(keys, "del", () => redis.multi());
    }
  }

  /**
   * Get data from cache
   */
  async get<T>(key: string): Promise<CacheResult<T> | null> {
    try {
      const redis = (await getRedisClient()) as RedisCacheClient | null;
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
      const redis = (await getRedisClient()) as RedisCacheClient | null;
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
      const redis = (await getRedisClient()) as RedisCacheClient | null;
      if (!redis) {
        return false;
      }

      const { deleted } = await GroundTruthCache.deleteKeys(redis, [key]);
      return deleted > 0;
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
    const startedAt = Date.now();
    try {
      const redis = (await getRedisClient()) as RedisCacheClient | null;
      if (!redis) {
        return 0;
      }

      let cursor = "0";
      let deleted = 0;
      let batches = 0;

      do {
        const [nextCursor, keys] = await redis.scan(cursor, {
          MATCH: pattern,
          COUNT: GroundTruthCache.INVALIDATION_SCAN_BATCH_SIZE,
        });
        cursor = nextCursor;

        if (!keys.length) {
          continue;
        }

        const result = await GroundTruthCache.deleteKeys(redis, keys);
        deleted += result.deleted;
        batches += result.batches;
      } while (cursor !== "0");

      cacheInvalidationBatchesTotal.inc(
        { cache_name: GroundTruthCache.CACHE_METRIC_NAME },
        batches
      );
      cacheInvalidationKeysDeletedTotal.inc(
        { cache_name: GroundTruthCache.CACHE_METRIC_NAME },
        deleted
      );

      return deleted;
    } catch (error) {
      logger.error("Cache invalidate pattern error", {
        pattern,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    } finally {
      cacheInvalidationDurationMs.observe(
        { cache_name: GroundTruthCache.CACHE_METRIC_NAME },
        Date.now() - startedAt
      );
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
      const redis = (await getRedisClient()) as RedisCacheClient | null;
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
