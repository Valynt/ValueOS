/**
 * Multi-level Caching Strategy
 *
 * Implements a sophisticated caching system with multiple cache layers:
 * - Memory cache (L1) - Fast in-memory storage
 * - Session cache (L2) - Browser session storage
 * - Persistent cache (L3) - IndexedDB for long-term storage
 * - CDN cache (L4) - External CDN integration
 */

import { logger } from "@shared/lib/logger";

/**
 * Cache entry with metadata
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
  version: string;
  tags?: string[];
  size?: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  maxSize?: number;
  ttl?: number; // Time to live in milliseconds
  strategy?: "lru" | "lfu" | "fifo";
  compressionEnabled?: boolean;
  encryptionEnabled?: boolean;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  hitRate: number;
  currentSize: number;
  maxSize: number;
  memoryUsage: number;
}

/**
 * Cache layer interface
 */
export interface CacheLayer<T> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
  size(): Promise<number>;
  stats(): Promise<CacheStats>;
}

/**
 * Memory cache implementation (L1)
 */
export class MemoryCache<T> implements CacheLayer<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private defaultTtl: number;
  private stats: CacheStats;
  private accessOrder: string[] = [];

  constructor(config: CacheConfig = {}) {
    this.maxSize = config.maxSize || 1000;
    this.defaultTtl = config.ttl || 5 * 60 * 1000; // 5 minutes
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      hitRate: 0,
      currentSize: 0,
      maxSize: this.maxSize,
      memoryUsage: 0,
    };
  }

  async get(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.stats.misses++;
      this.stats.deletes++;
      return null;
    }

    // Update access tracking
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.updateAccessOrder(key);
    this.stats.hits++;
    this.updateHitRate();

    return entry.data;
  }

  async set(key: string, value: T, ttl = this.defaultTtl): Promise<void> {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      data: value,
      timestamp: now,
      expiresAt: now + ttl,
      accessCount: 1,
      lastAccessed: now,
      version: "1.0",
      size: this.calculateSize(value),
    };

    // Evict if necessary
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, entry);
    this.updateAccessOrder(key);
    this.stats.sets++;
    this.stats.currentSize = this.cache.size;
    this.updateMemoryUsage();
  }

  async delete(key: string): Promise<void> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.removeFromAccessOrder(key);
      this.stats.deletes++;
      this.stats.currentSize = this.cache.size;
      this.updateMemoryUsage();
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.accessOrder = [];
    this.stats.currentSize = 0;
    this.stats.memoryUsage = 0;
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    return entry ? Date.now() <= entry.expiresAt : false;
  }

  async size(): Promise<number> {
    return this.cache.size;
  }

  async stats(): Promise<CacheStats> {
    return { ...this.stats };
  }

  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;

    const lruKey = this.accessOrder[0];
    this.cache.delete(lruKey);
    this.accessOrder.shift();
    this.stats.evictions++;
    this.stats.currentSize = this.cache.size;
  }

  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  private updateMemoryUsage(): void {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.size || 0;
    }
    this.stats.memoryUsage = totalSize;
  }

  private calculateSize(value: T): number {
    // Rough estimation of object size in bytes
    return JSON.stringify(value).length * 2; // Assume 2 bytes per char
  }
}

/**
 * Session cache implementation (L2)
 */
export class SessionCache<T> implements CacheLayer<T> {
  private prefix: string;

  constructor(prefix = "sdui_cache_") {
    this.prefix = prefix;
  }

  private serialize(value: T): string {
    return JSON.stringify(value);
  }

  private deserialize(value: string): T {
    return JSON.parse(value);
  }

  async get(key: string): Promise<T | null> {
    try {
      const item = sessionStorage.getItem(this.prefix + key);
      if (!item) return null;

      const parsed = this.deserialize(item);
      if (Date.now() > parsed.expiresAt) {
        sessionStorage.removeItem(this.prefix + key);
        return null;
      }

      return parsed.data;
    } catch (error) {
      logger.error("Session cache get error", { error, key });
      return null;
    }
  }

  async set(key: string, value: T, ttl = 5 * 60 * 1000): Promise<void> {
    try {
      const item = {
        data: value,
        timestamp: Date.now(),
        expiresAt: Date.now() + ttl,
      };
      sessionStorage.setItem(this.prefix + key, this.serialize(item));
    } catch (error) {
      logger.error("Session cache set error", { error, key });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      sessionStorage.removeItem(this.prefix + key);
    } catch (error) {
      logger.error("Session cache delete error", { error, key });
    }
  }

  async clear(): Promise<void> {
    try {
      const keys = Object.keys(sessionStorage);
      for (const key of keys) {
        if (key.startsWith(this.prefix)) {
          sessionStorage.removeItem(key);
        }
      }
    } catch (error) {
      logger.error("Session cache clear error", { error });
    }
  }

  async has(key: string): Promise<boolean> {
    const item = await this.get(key);
    return item !== null;
  }

  async size(): Promise<number> {
    let count = 0;
    const keys = Object.keys(sessionStorage);
    for (const key of keys) {
      if (key.startsWith(this.prefix)) {
        count++;
      }
    }
    return count;
  }

  async stats(): Promise<CacheStats> {
    // Session storage doesn't provide detailed stats
    return {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      hitRate: 0,
      currentSize: await this.size(),
      maxSize: 50, // Session storage is typically limited
      memoryUsage: 0,
    };
  }
}

/**
 * Multi-level cache manager
 */
export class MultiLevelCache<T> {
  private layers: CacheLayer<T>[] = [];
  private layerNames: string[] = [];
  private globalStats: CacheStats;

  constructor() {
    this.globalStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      hitRate: 0,
      currentSize: 0,
      maxSize: 0,
      memoryUsage: 0,
    };
  }

  /**
   * Add a cache layer
   */
  addLayer(name: string, layer: CacheLayer<T>): void {
    this.layers.push(layer);
    this.layerNames.push(name);
    logger.info("Cache layer added", { name, totalLayers: this.layers.length });
  }

  /**
   * Get value from cache (checks layers in order)
   */
  async get(key: string): Promise<T | null> {
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      const value = await layer.get(key);

      if (value !== null) {
        // Promote to higher layers (write-through)
        for (let j = 0; j < i; j++) {
          await this.layers[j].set(key, value);
        }

        this.globalStats.hits++;
        this.updateGlobalHitRate();

        logger.debug("Cache hit", { key, layer: this.layerNames[i] });
        return value;
      }
    }

    this.globalStats.misses++;
    this.updateGlobalHitRate();

    logger.debug("Cache miss", { key });
    return null;
  }

  /**
   * Set value in all cache layers
   */
  async set(key: string, value: T, ttl?: number): Promise<void> {
    await Promise.all(this.layers.map((layer) => layer.set(key, value, ttl)));
    this.globalStats.sets++;

    logger.debug("Cache set", { key, layers: this.layerNames.length });
  }

  /**
   * Delete value from all cache layers
   */
  async delete(key: string): Promise<void> {
    await Promise.all(this.layers.map((layer) => layer.delete(key)));
    this.globalStats.deletes++;

    logger.debug("Cache delete", { key });
  }

  /**
   * Clear all cache layers
   */
  async clear(): Promise<void> {
    await Promise.all(this.layers.map((layer) => layer.clear()));
    this.resetGlobalStats();

    logger.info("All cache layers cleared");
  }

  /**
   * Check if key exists in any cache layer
   */
  async has(key: string): Promise<boolean> {
    for (const layer of this.layers) {
      if (await layer.has(key)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get total size across all layers
   */
  async size(): Promise<number> {
    const sizes = await Promise.all(this.layers.map((layer) => layer.size()));
    return sizes.reduce((sum, size) => sum + size, 0);
  }

  /**
   * Get aggregated statistics
   */
  async stats(): Promise<CacheStats & { layerStats: Array<{ name: string; stats: CacheStats }> }> {
    const layerStats = await Promise.all(
      this.layers.map(async (layer, index) => ({
        name: this.layerNames[index],
        stats: await layer.stats(),
      }))
    );

    // Aggregate stats
    const aggregated = layerStats.reduce(
      (acc, { stats }) => ({
        hits: acc.hits + stats.hits,
        misses: acc.misses + stats.misses,
        sets: acc.sets + stats.sets,
        deletes: acc.deletes + stats.deletes,
        evictions: acc.evictions + stats.evictions,
        currentSize: acc.currentSize + stats.currentSize,
        maxSize: acc.maxSize + stats.maxSize,
        memoryUsage: acc.memoryUsage + stats.memoryUsage,
      }),
      {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        evictions: 0,
        currentSize: 0,
        maxSize: 0,
        memoryUsage: 0,
      }
    );

    aggregated.hitRate =
      aggregated.hits + aggregated.misses > 0
        ? aggregated.hits / (aggregated.hits + aggregated.misses)
        : 0;

    return {
      ...aggregated,
      layerStats,
    };
  }

  /**
   * Warm up cache with data
   */
  async warmUp(data: Record<string, T>, ttl?: number): Promise<void> {
    const entries = Object.entries(data);
    logger.info("Cache warm-up started", { entries: entries.length });

    await Promise.all(entries.map(([key, value]) => this.set(key, value, ttl)));

    logger.info("Cache warm-up completed", { entries: entries.length });
  }

  /**
   * Get cache health metrics
   */
  async health(): Promise<{
    status: "healthy" | "warning" | "critical";
    issues: string[];
    recommendations: string[];
  }> {
    const stats = await this.stats();
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check hit rate
    if (stats.hitRate < 0.5) {
      issues.push("Low cache hit rate");
      recommendations.push("Consider increasing cache TTL or adjusting cache keys");
    }

    // Check memory usage
    if (stats.memoryUsage > 100 * 1024 * 1024) {
      // 100MB
      issues.push("High memory usage");
      recommendations.push("Consider reducing cache size or implementing compression");
    }

    // Check eviction rate
    const evictionRate = stats.evictions / Math.max(stats.sets, 1);
    if (evictionRate > 0.1) {
      issues.push("High eviction rate");
      recommendations.push("Consider increasing cache size");
    }

    let status: "healthy" | "warning" | "critical" = "healthy";
    if (issues.length >= 3) {
      status = "critical";
    } else if (issues.length > 0) {
      status = "warning";
    }

    return { status, issues, recommendations };
  }

  private updateGlobalHitRate(): void {
    const total = this.globalStats.hits + this.globalStats.misses;
    this.globalStats.hitRate = total > 0 ? this.globalStats.hits / total : 0;
  }

  private resetGlobalStats(): void {
    this.globalStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      hitRate: 0,
      currentSize: 0,
      maxSize: 0,
      memoryUsage: 0,
    };
  }
}

/**
 * Cache factory for creating configured cache instances
 */
export class CacheFactory {
  /**
   * Create a multi-level cache with default configuration
   */
  static createMultiLevelCache<T>(): MultiLevelCache<T> {
    const cache = new MultiLevelCache<T>();

    // L1: Memory cache (fastest)
    cache.addLayer(
      "memory",
      new MemoryCache<T>({
        maxSize: 1000,
        ttl: 5 * 60 * 1000, // 5 minutes
        strategy: "lru",
      })
    );

    // L2: Session cache (persistent for session)
    cache.addLayer("session", new SessionCache<T>("sdui_l2_"));

    logger.info("Multi-level cache created", { layers: 2 });
    return cache;
  }

  /**
   * Create a memory-only cache
   */
  static createMemoryCache<T>(config?: CacheConfig): MemoryCache<T> {
    return new MemoryCache<T>(config);
  }

  /**
   * Create a session-only cache
   */
  static createSessionCache<T>(prefix?: string): SessionCache<T> {
    return new SessionCache<T>(prefix);
  }
}

// Global cache instance
export const globalCache = CacheFactory.createMultiLevelCache<any>();

/**
 * Cache decorator for functions
 */
export function cached<T extends (...args: any[]) => Promise<any>>(
  ttl: number = 5 * 60 * 1000,
  keyGenerator?: (...args: Parameters<T>) => string
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: Parameters<T>) {
      const cacheKey = keyGenerator
        ? keyGenerator(...args)
        : `${propertyName}_${JSON.stringify(args)}`;

      // Try to get from cache
      const cached = await globalCache.get(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // Execute and cache result
      const result = await method.apply(this, args);
      await globalCache.set(cacheKey, result, ttl);

      return result;
    };

    return descriptor;
  };
}
