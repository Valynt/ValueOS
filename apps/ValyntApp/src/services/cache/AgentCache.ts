/**
 * Agent Cache Service
 *
 * Multi-level caching system for agent responses, causal truth queries,
 * and frequently accessed data with intelligent invalidation strategies.
 */

import { EventEmitter } from "events";

import { logger } from "../../lib/logger";

// ============================================================================
// Types
// ============================================================================

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  size: number; // bytes
  metadata?: Record<string, unknown>;
}

export interface CacheStats {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  evictionRate: number;
  totalSize: number;
  averageTtl: number;
  oldestEntry: number;
  newestEntry: number;
}

export interface CacheConfig {
  // L1 Cache (In-memory)
  l1MaxSize: number; // MB
  l1MaxEntries: number;
  l1DefaultTtl: number; // seconds

  // L2 Cache (Redis/Distributed)
  l2Enabled: boolean;
  l2DefaultTtl: number; // seconds
  l2KeyPrefix: string;

  // Cache policies
  evictionPolicy: "lru" | "lfu" | "ttl" | "random";
  compressionEnabled: boolean;
  serializationFormat: "json" | "binary";

  // Performance
  cleanupInterval: number; // seconds
  statsReportingInterval: number; // seconds
}

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  priority?: "low" | "medium" | "high";
  metadata?: Record<string, unknown>;
}

// ============================================================================
// AgentCache Implementation
// ============================================================================

export class AgentCache extends EventEmitter {
  private config: CacheConfig;
  private l1Cache = new Map<string, CacheEntry>();
  private l2Cache: Map<string, CacheEntry> | null = null; // Mock Redis for now

  // Statistics
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    sets: 0,
    gets: 0,
  };

  // Cleanup intervals
  private cleanupInterval: NodeJS.Timeout | null = null;
  private statsInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    super();

    this.config = {
      l1MaxSize: 256, // 256 MB
      l1MaxEntries: 10000,
      l1DefaultTtl: 300, // 5 minutes
      l2Enabled: false, // Disabled until Redis is available
      l2DefaultTtl: 1800, // 30 minutes
      l2KeyPrefix: "agent-cache:",
      evictionPolicy: "lru",
      compressionEnabled: true,
      serializationFormat: "json",
      cleanupInterval: 60, // 1 minute
      statsReportingInterval: 300, // 5 minutes
      ...config,
    };

    if (this.config.l2Enabled) {
      this.l2Cache = new Map<string, CacheEntry>();
    }

    this.startCleanup();
    this.startStatsReporting();
  }

  /**
   * Get value from cache (L1 -> L2 fallback)
   */
  async get<T = any>(key: string): Promise<T | null> {
    this.stats.gets++;

    // Try L1 cache first
    const l1Entry = this.l1Cache.get(key);
    if (l1Entry && !this.isExpired(l1Entry)) {
      l1Entry.accessCount++;
      l1Entry.lastAccessed = Date.now();
      this.stats.hits++;
      this.emit("cacheHit", { key, level: "L1" });
      return l1Entry.value;
    }

    // Remove expired L1 entry
    if (l1Entry && this.isExpired(l1Entry)) {
      this.l1Cache.delete(key);
    }

    // Try L2 cache if enabled
    if (this.config.l2Enabled && this.l2Cache) {
      const l2Entry = this.l2Cache.get(key);
      if (l2Entry && !this.isExpired(l2Entry)) {
        // Promote to L1 cache
        await this.set(key, l2Entry.value, {
          ttl: l2Entry.ttl,
          metadata: { ...l2Entry.metadata, promotedFrom: "L2" },
        });

        l2Entry.accessCount++;
        l2Entry.lastAccessed = Date.now();
        this.stats.hits++;
        this.emit("cacheHit", { key, level: "L2" });
        return l2Entry.value;
      }

      // Remove expired L2 entry
      if (l2Entry && this.isExpired(l2Entry)) {
        this.l2Cache.delete(key);
      }
    }

    this.stats.misses++;
    this.emit("cacheMiss", { key });
    return null;
  }

  /**
   * Set value in cache (L1 and optionally L2)
   */
  async set<T = any>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const ttl = options.ttl || this.config.l1DefaultTtl;
    const size = this.calculateSize(value);

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl: ttl * 1000, // Convert to milliseconds
      accessCount: 0,
      lastAccessed: Date.now(),
      size,
      metadata: options.metadata,
    };

    // Check if we need to evict entries (L1)
    if (this.shouldEvictL1(entry)) {
      this.evictL1Entries();
    }

    // Set in L1 cache
    this.l1Cache.set(key, entry);
    this.stats.sets++;

    // Set in L2 cache if enabled
    if (this.config.l2Enabled && this.l2Cache) {
      const l2Ttl = options.ttl || this.config.l2DefaultTtl;
      const l2Entry: CacheEntry<T> = {
        ...entry,
        ttl: l2Ttl * 1000,
      };
      this.l2Cache.set(key, l2Entry);
    }

    this.emit("cacheSet", { key, size, ttl });
  }

  /**
   * Delete entry from all cache levels
   */
  async delete(key: string): Promise<boolean> {
    const l1Deleted = this.l1Cache.delete(key);
    let l2Deleted = false;

    if (this.config.l2Enabled && this.l2Cache) {
      l2Deleted = this.l2Cache.delete(key);
    }

    const deleted = l1Deleted || l2Deleted;
    if (deleted) {
      this.emit("cacheDelete", { key });
    }

    return deleted;
  }

  /**
   * Clear cache entries by pattern or all
   */
  async clear(pattern?: string): Promise<number> {
    let deleted = 0;

    if (!pattern) {
      // Clear all
      deleted += this.l1Cache.size;
      this.l1Cache.clear();

      if (this.config.l2Enabled && this.l2Cache) {
        deleted += this.l2Cache.size;
        this.l2Cache.clear();
      }
    } else {
      // Clear by pattern
      const regex = new RegExp(pattern.replace(/\*/g, ".*"));

      for (const key of this.l1Cache.keys()) {
        if (regex.test(key)) {
          this.l1Cache.delete(key);
          deleted++;
        }
      }

      if (this.config.l2Enabled && this.l2Cache) {
        for (const key of this.l2Cache.keys()) {
          if (regex.test(key)) {
            this.l2Cache.delete(key);
            deleted++;
          }
        }
      }
    }

    this.emit("cacheClear", { pattern, deleted });
    return deleted;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;
    const missRate = total > 0 ? this.stats.misses / total : 0;
    const evictionRate = this.stats.sets > 0 ? this.stats.evictions / this.stats.sets : 0;

    const entries = Array.from(this.l1Cache.values());
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const averageTtl =
      entries.length > 0 ? entries.reduce((sum, entry) => sum + entry.ttl, 0) / entries.length : 0;

    const timestamps = entries.map((e) => e.timestamp);
    const oldestEntry = timestamps.length > 0 ? Math.min(...timestamps) : 0;
    const newestEntry = timestamps.length > 0 ? Math.max(...timestamps) : 0;

    return {
      totalEntries: this.l1Cache.size + (this.l2Cache?.size || 0),
      hitRate,
      missRate,
      evictionRate,
      totalSize,
      averageTtl,
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmup<T = any>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    logger.info("Starting cache warmup", { entries: entries.length });

    for (const entry of entries) {
      await this.set(entry.key, entry.value, { ttl: entry.ttl });
    }

    logger.info("Cache warmup completed", { entries: entries.length });
  }

  /**
   * Shutdown cache service
   */
  shutdown(): void {
    this.stopCleanup();
    this.stopStatsReporting();
    this.removeAllListeners();

    this.l1Cache.clear();
    if (this.l2Cache) {
      this.l2Cache.clear();
    }

    logger.info("Agent cache service shutdown");
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.config.cleanupInterval * 1000);
  }

  private stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  private startStatsReporting(): void {
    this.statsInterval = setInterval(() => {
      const stats = this.getStats();
      this.emit("stats", stats);

      // Log significant stats
      if (stats.hitRate < 0.5) {
        logger.warn("Low cache hit rate", { hitRate: stats.hitRate });
      }

      if (stats.evictionRate > 0.1) {
        logger.warn("High eviction rate", { evictionRate: stats.evictionRate });
      }
    }, this.config.statsReportingInterval * 1000);
  }

  private stopStatsReporting(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  private cleanupExpiredEntries(): void {
    let cleaned = 0;

    // Clean L1 cache
    for (const [key, entry] of this.l1Cache.entries()) {
      if (this.isExpired(entry)) {
        this.l1Cache.delete(key);
        cleaned++;
      }
    }

    // Clean L2 cache
    if (this.config.l2Enabled && this.l2Cache) {
      for (const [key, entry] of this.l2Cache.entries()) {
        if (this.isExpired(entry)) {
          this.l2Cache.delete(key);
          cleaned++;
        }
      }
    }

    if (cleaned > 0) {
      this.emit("cleanup", { cleaned });
      logger.debug("Cache cleanup completed", { cleaned });
    }
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private shouldEvictL1(newEntry: CacheEntry): boolean {
    const currentSize = Array.from(this.l1Cache.values()).reduce(
      (sum, entry) => sum + entry.size,
      0
    );

    return (
      this.l1Cache.size >= this.config.l1MaxEntries ||
      currentSize + newEntry.size > this.config.l1MaxSize * 1024 * 1024
    );
  }

  private evictL1Entries(): void {
    const entries = Array.from(this.l1Cache.entries());

    switch (this.config.evictionPolicy) {
      case "lru":
        this.evictLRU(entries);
        break;
      case "lfu":
        this.evictLFU(entries);
        break;
      case "ttl":
        this.evictByTTL(entries);
        break;
      case "random":
        this.evictRandom(entries);
        break;
    }
  }

  private evictLRU(entries: Array<[string, CacheEntry]>): void {
    // Sort by last accessed time (oldest first)
    entries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);

    // Evict oldest 25% or until we have space
    const evictCount = Math.max(1, Math.floor(entries.length * 0.25));

    for (let i = 0; i < evictCount; i++) {
      const key = entries[i]?.[0];
      if (key) {
        this.l1Cache.delete(key);
        this.stats.evictions++;
      }
    }
  }

  private evictLFU(entries: Array<[string, CacheEntry]>): void {
    // Sort by access count (least used first)
    entries.sort(([, a], [, b]) => a.accessCount - b.accessCount);

    // Evict least used 25%
    const evictCount = Math.max(1, Math.floor(entries.length * 0.25));

    for (let i = 0; i < evictCount; i++) {
      const key = entries[i]?.[0];
      if (key) {
        this.l1Cache.delete(key);
        this.stats.evictions++;
      }
    }
  }

  private evictByTTL(entries: Array<[string, CacheEntry]>): void {
    // Sort by TTL (shortest first)
    entries.sort(([, a], [, b]) => a.ttl - b.ttl);

    // Evict shortest TTL 25%
    const evictCount = Math.max(1, Math.floor(entries.length * 0.25));

    for (let i = 0; i < evictCount; i++) {
      const key = entries[i]?.[0];
      if (key) {
        this.l1Cache.delete(key);
        this.stats.evictions++;
      }
    }
  }

  private evictRandom(entries: Array<[string, CacheEntry]>): void {
    // Evict random 25%
    const evictCount = Math.max(1, Math.floor(entries.length * 0.25));

    for (let i = 0; i < evictCount; i++) {
      const randomIndex = Math.floor(Math.random() * entries.length);
      const key = entries[randomIndex]?.[0];
      if (key) {
        this.l1Cache.delete(key);
        this.stats.evictions++;
      }
    }
  }

  private calculateSize(value: unknown): number {
    try {
      // Rough estimation of serialized size
      const serialized = JSON.stringify(value);
      return serialized.length * 2; // Approximate bytes (UTF-16)
    } catch (error) {
      // Fallback estimation
      return 1024; // 1KB default
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let agentCacheInstance: AgentCache | null = null;

export function getAgentCache(config?: Partial<CacheConfig>): AgentCache {
  if (!agentCacheInstance) {
    agentCacheInstance = new AgentCache(config);
  }
  return agentCacheInstance;
}
