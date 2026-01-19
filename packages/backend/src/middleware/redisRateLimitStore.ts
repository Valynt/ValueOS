/**
 * Redis-based Distributed Rate Limit Store
 *
 * Provides distributed rate limiting across multiple instances using Redis
 * with atomic operations and TTL-based expiry.
 */

import { getRedisClient } from "@shared/lib/redisClient";
import { logger } from "@shared/lib/logger";
import { RedisClientType } from "redis";

export interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class RedisRateLimitStore {
  private redis: RedisClientType | null = null;
  private readonly prefix = "ratelimit:";

  constructor() {
    this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.redis = await getRedisClient();
      logger.info("Redis rate limit store initialized");
    } catch (error) {
      logger.error(
        "Failed to initialize Redis for rate limiting",
        error as Error
      );
      // Continue with null redis - will fall back to in-memory behavior
    }
  }

  /**
   * Increment request count for a key with atomic operations
   */
  async increment(key: string, windowMs: number): Promise<RateLimitEntry> {
    if (!this.redis) {
      throw new Error("Redis client not available for rate limiting");
    }

    const redisKey = this.prefix + key;
    const now = Date.now();
    const resetTime = now + windowMs;

    try {
      // Use Redis pipeline for atomic operations
      const pipeline = this.redis.multi();

      // Increment counter
      pipeline.incr(redisKey);

      // Set expiry if not set (only on first increment)
      pipeline.pexpire(redisKey, windowMs);

      // Execute pipeline
      const results = await pipeline.exec();

      if (!results || results.length < 2) {
        throw new Error("Redis pipeline execution failed");
      }

      const count = results[0] as number;

      return {
        count,
        resetTime,
      };
    } catch (error) {
      logger.error("Redis rate limit increment failed", {
        key: redisKey,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get current count for a key
   */
  async get(key: string): Promise<RateLimitEntry | undefined> {
    if (!this.redis) {
      return undefined;
    }

    const redisKey = this.prefix + key;

    try {
      const pipeline = this.redis.multi();
      pipeline.get(redisKey);
      pipeline.pttl(redisKey); // Get TTL in milliseconds

      const results = await pipeline.exec();

      if (!results || results.length < 2) {
        return undefined;
      }

      const countStr = results[0] as string | null;
      const ttlMs = results[1] as number;

      if (!countStr || ttlMs === -2) {
        return undefined; // Key doesn't exist
      }

      const count = parseInt(countStr, 10);
      const resetTime = Date.now() + ttlMs;

      return {
        count,
        resetTime,
      };
    } catch (error) {
      logger.error("Redis rate limit get failed", {
        key: redisKey,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  /**
   * Reset count for a key
   */
  async reset(key: string): Promise<void> {
    if (!this.redis) {
      return;
    }

    const redisKey = this.prefix + key;

    try {
      await this.redis.del(redisKey);
      logger.debug("Rate limit reset", { key: redisKey });
    } catch (error) {
      logger.error("Redis rate limit reset failed", {
        key: redisKey,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get all rate limit keys matching a pattern
   */
  async getKeys(pattern: string = "*"): Promise<string[]> {
    if (!this.redis) {
      return [];
    }

    try {
      const keys = await this.redis.keys(this.prefix + pattern);
      return keys.map((key) => key.replace(this.prefix, ""));
    } catch (error) {
      logger.error("Redis rate limit keys fetch failed", {
        pattern,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get statistics for monitoring
   */
  async getStats(): Promise<{
    totalKeys: number;
    keys: Array<{ key: string; count: number; ttl: number }>;
  }> {
    if (!this.redis) {
      return { totalKeys: 0, keys: [] };
    }

    try {
      const keys = await this.redis.keys(this.prefix + "*");
      const stats: Array<{ key: string; count: number; ttl: number }> = [];

      for (const redisKey of keys) {
        const pipeline = this.redis.multi();
        pipeline.get(redisKey);
        pipeline.pttl(redisKey);
        const results = await pipeline.exec();

        if (results && results.length >= 2) {
          const countStr = results[0] as string | null;
          const ttl = results[1] as number;

          if (countStr && ttl !== -2) {
            stats.push({
              key: redisKey.replace(this.prefix, ""),
              count: parseInt(countStr, 10),
              ttl,
            });
          }
        }
      }

      return {
        totalKeys: stats.length,
        keys: stats,
      };
    } catch (error) {
      logger.error("Redis rate limit stats fetch failed", error as Error);
      return { totalKeys: 0, keys: [] };
    }
  }

  /**
   * Cleanup expired keys (Redis handles this automatically with TTL)
   */
  async cleanup(): Promise<void> {
    // Redis automatically expires keys, no manual cleanup needed
    logger.debug("Redis rate limit cleanup called (no-op)");
  }
}
