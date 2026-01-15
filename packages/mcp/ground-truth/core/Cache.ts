/**
 * Cache Implementation for MCP Ground Truth Server
 *
 * Provides in-memory caching with TTL support for expensive API calls.
 * Designed to reduce SEC API load and improve response times.
 */

import { CacheEntry, CachePolicy } from "../types";
import { logger } from "../../lib/logger";

export class MemoryCache {
  private cache = new Map<string, CacheEntry>();
  private policy: CachePolicy;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    policy: CachePolicy = {
      tier1_ttl: 86400, // 24 hours
      tier2_ttl: 21600, // 6 hours
      tier3_ttl: 3600, // 1 hour
      max_size_mb: 100,
    }
  ) {
    this.policy = policy;
    this.startCleanupInterval();
  }

  /**
   * Get cached value if available and not expired
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    const now = Date.now();
    const expiresAt = entry.created_at + entry.ttl * 1000;
    if (now > expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Update access stats
    entry.accessed_at = Date.now();
    entry.access_count++;

    logger.debug("Cache hit", { key, accessCount: entry.access_count });
    return entry.value as T;
  }

  /**
   * Store value in cache with appropriate TTL based on tier
   */
  async set<T>(
    key: string,
    value: T,
    tier: "tier1" | "tier2" | "tier3"
  ): Promise<void> {
    // Check cache size limit
    if (this.getCacheSizeMB() >= this.policy.max_size_mb) {
      this.evictOldest();
    }

    const ttl = this.getTTLForTier(tier);
    const entry: CacheEntry = {
      key,
      value,
      tier,
      ttl,
      created_at: Date.now(),
      accessed_at: Date.now(),
      access_count: 0,
    };

    this.cache.set(key, entry);
    logger.debug("Cache set", { key, tier, ttl });
  }

  /**
   * Delete cached value
   */
  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.debug("Cache deleted", { key });
    }
    return deleted;
  }

  /**
   * Clear all cached values
   */
  async clear(): Promise<void> {
    this.cache.clear();
    logger.info("Cache cleared");
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    totalEntries: number;
    sizeMB: number;
    tierBreakdown: Record<string, number>;
    hitRate?: number;
  } {
    const tierBreakdown = { tier1: 0, tier2: 0, tier3: 0 };

    for (const entry of this.cache.values()) {
      tierBreakdown[entry.tier]++;
    }

    return {
      totalEntries: this.cache.size,
      sizeMB: this.getCacheSizeMB(),
      tierBreakdown,
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      const expiresAt = entry.created_at + entry.ttl * 1000;
      if (now > expiresAt) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }

    if (expiredKeys.length > 0) {
      logger.debug("Cache cleanup completed", {
        expiredKeys: expiredKeys.length,
      });
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanupInterval(): void {
    // Clean up every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000
    );
  }

  /**
   * Stop cleanup interval
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get TTL for tier
   */
  private getTTLForTier(tier: "tier1" | "tier2" | "tier3"): number {
    switch (tier) {
      case "tier1":
        return this.policy.tier1_ttl;
      case "tier2":
        return this.policy.tier2_ttl;
      case "tier3":
        return this.policy.tier3_ttl;
      default:
        return this.policy.tier3_ttl;
    }
  }

  /**
   * Estimate cache size in MB
   */
  private getCacheSizeMB(): number {
    let totalSize = 0;

    for (const entry of this.cache.values()) {
      // Rough estimation: JSON string length as bytes
      totalSize += JSON.stringify(entry).length;
    }

    return totalSize / (1024 * 1024); // Convert to MB
  }

  /**
   * Evict oldest entries when cache is full
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime: number = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessed_at < oldestTime) {
        oldestTime = entry.accessed_at;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug("Cache eviction: removed oldest entry", { key: oldestKey });
    }
  }
}

// Singleton instance
let defaultCache: MemoryCache | null = null;

/**
 * Get default cache instance
 */
export function getCache(): MemoryCache {
  if (!defaultCache) {
    defaultCache = new MemoryCache();
  }
  return defaultCache;
}

/**
 * Set custom cache implementation
 */
export function setCache(cache: MemoryCache): void {
  if (defaultCache) {
    defaultCache.stopCleanup();
  }
  defaultCache = cache;
}
