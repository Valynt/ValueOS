/**
 * In-memory cache for domain verification results
 * Reduces database load by caching verified domains
 */

import { config } from './config';
import { logger } from './logger';

interface CacheEntry {
  verified: boolean;
  expiresAt: number;
}

export class DomainCache {
  private cache: Map<string, CacheEntry>;
  private readonly ttlMs: number;
  private readonly maxSize: number;
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(ttlSeconds: number = config.cache.ttlSeconds, maxSize: number = config.cache.maxSize) {
    this.cache = new Map();
    this.ttlMs = ttlSeconds * 1000;
    this.maxSize = maxSize;

    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Stop the cleanup interval (useful for tests)
   */
  stopCleanup(): void {
    clearInterval(this.cleanupInterval);
  }

  /**
   * Get cached verification result
   */
  get(domain: string): boolean | null {
    const entry = this.cache.get(domain);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(domain);
      logger.debug('Cache entry expired', { domain });
      return null;
    }

    logger.debug('Cache hit', { domain, verified: entry.verified });
    return entry.verified;
  }

  /**
   * Set verification result in cache
   */
  set(domain: string, verified: boolean): void {
    // Enforce max size (LRU-like behavior)
    if (this.cache.size >= this.maxSize && !this.cache.has(domain)) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        logger.debug('Cache eviction', { evictedDomain: firstKey });
      }
    }

    const entry: CacheEntry = {
      verified,
      expiresAt: Date.now() + this.ttlMs,
    };

    this.cache.set(domain, entry);
    logger.debug('Cache set', { domain, verified, ttl: this.ttlMs });
  }

  /**
   * Clear all cache entries
   */
  clear(): number {
    const size = this.cache.size;
    this.cache.clear();
    logger.info('Cache cleared', { clearedCount: size });
    return size;
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [domain, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(domain);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug('Cache cleanup', { cleanedCount, remainingSize: this.cache.size });
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; ttlSeconds: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlSeconds: this.ttlMs / 1000,
    };
  }
}

// Singleton instance
export const domainCache = new DomainCache();
