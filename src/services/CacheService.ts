/**
 * Cache Service
 * 
 * Provides a unified caching interface with:
 * - Browser-side caching (localStorage/sessionStorage)
 * - Redis-compatible API for future server-side caching
 * - Automatic expiration
 * - Cache invalidation
 * - Hit rate monitoring
 * - LRU eviction for browser storage
 */

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  namespace?: string; // Cache namespace for organization
  storage?: 'memory' | 'local' | 'session'; // Storage backend
}

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
  hits: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  maxSize: number;
}

// ============================================================================
// Cache Service Class
// ============================================================================

export class CacheService {
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private stats = {
    hits: 0,
    misses: 0,
  };
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_MEMORY_SIZE = 1000; // Max entries in memory
  private readonly MAX_STORAGE_SIZE = 100; // Max entries in localStorage/sessionStorage

  constructor(private defaultNamespace: string = 'app') {}

  // ==========================================================================
  // Core Cache Operations
  // ==========================================================================

  /**
   * Get value from cache
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const fullKey = this.getFullKey(key, options.namespace);
    const storage = options.storage || 'memory';

    let entry: CacheEntry<T> | null = null;

    // Try to get from appropriate storage
    switch (storage) {
      case 'memory':
        entry = this.memoryCache.get(fullKey) || null;
        break;
      case 'local':
        entry = this.getFromStorage(fullKey, localStorage);
        break;
      case 'session':
        entry = this.getFromStorage(fullKey, sessionStorage);
        break;
    }

    // Check if entry exists and is not expired
    if (entry) {
      if (Date.now() < entry.expiresAt) {
        // Update hit count
        entry.hits++;
        this.stats.hits++;
        
        // Update entry in storage
        if (storage === 'memory') {
          this.memoryCache.set(fullKey, entry);
        } else {
          this.setToStorage(fullKey, entry, storage === 'local' ? localStorage : sessionStorage);
        }

        return entry.value;
      } else {
        // Entry expired, remove it
        await this.delete(key, options);
      }
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Set value in cache
   */
  async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const fullKey = this.getFullKey(key, options.namespace);
    const ttl = options.ttl || this.DEFAULT_TTL;
    const storage = options.storage || 'memory';

    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now(),
      hits: 0,
    };

    switch (storage) {
      case 'memory':
        // Check size and evict if necessary
        if (this.memoryCache.size >= this.MAX_MEMORY_SIZE) {
          this.evictLRU(this.memoryCache);
        }
        this.memoryCache.set(fullKey, entry);
        break;

      case 'local':
        this.setToStorage(fullKey, entry, localStorage);
        this.evictStorageIfNeeded(localStorage, this.MAX_STORAGE_SIZE);
        break;

      case 'session':
        this.setToStorage(fullKey, entry, sessionStorage);
        this.evictStorageIfNeeded(sessionStorage, this.MAX_STORAGE_SIZE);
        break;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string, options: CacheOptions = {}): Promise<void> {
    const fullKey = this.getFullKey(key, options.namespace);
    const storage = options.storage || 'memory';

    switch (storage) {
      case 'memory':
        this.memoryCache.delete(fullKey);
        break;
      case 'local':
        localStorage.removeItem(fullKey);
        break;
      case 'session':
        sessionStorage.removeItem(fullKey);
        break;
    }
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string, options: CacheOptions = {}): Promise<boolean> {
    const value = await this.get(key, options);
    return value !== null;
  }

  /**
   * Clear all cache entries
   */
  async clear(options: { namespace?: string; storage?: 'memory' | 'local' | 'session' } = {}): Promise<void> {
    const storage = options.storage || 'memory';
    const namespace = options.namespace || this.defaultNamespace;

    switch (storage) {
      case 'memory':
        if (options.namespace) {
          // Clear only entries in this namespace
          const prefix = `${namespace}:`;
          for (const key of this.memoryCache.keys()) {
            if (key.startsWith(prefix)) {
              this.memoryCache.delete(key);
            }
          }
        } else {
          this.memoryCache.clear();
        }
        break;

      case 'local':
        this.clearStorage(localStorage, namespace);
        break;

      case 'session':
        this.clearStorage(sessionStorage, namespace);
        break;
    }
  }

  // ==========================================================================
  // Advanced Operations
  // ==========================================================================

  /**
   * Get or set (fetch if not in cache)
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    // Fetch and cache
    const value = await fetcher();
    await this.set(key, value, options);
    return value;
  }

  /**
   * Get multiple keys at once
   */
  async getMany<T>(
    keys: string[],
    options: CacheOptions = {}
  ): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();

    await Promise.all(
      keys.map(async (key) => {
        const value = await this.get<T>(key, options);
        results.set(key, value);
      })
    );

    return results;
  }

  /**
   * Set multiple keys at once
   */
  async setMany<T>(
    entries: Map<string, T>,
    options: CacheOptions = {}
  ): Promise<void> {
    await Promise.all(
      Array.from(entries.entries()).map(([key, value]) =>
        this.set(key, value, options)
      )
    );
  }

  /**
   * Delete multiple keys at once
   */
  async deleteMany(
    keys: string[],
    options: CacheOptions = {}
  ): Promise<void> {
    await Promise.all(keys.map((key) => this.delete(key, options)));
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidatePattern(
    pattern: string,
    options: { namespace?: string; storage?: 'memory' | 'local' | 'session' } = {}
  ): Promise<void> {
    const storage = options.storage || 'memory';
    const namespace = options.namespace || this.defaultNamespace;
    const fullPattern = `${namespace}:${pattern}`;

    switch (storage) {
      case 'memory':
        for (const key of this.memoryCache.keys()) {
          if (this.matchPattern(key, fullPattern)) {
            this.memoryCache.delete(key);
          }
        }
        break;

      case 'local':
        this.invalidateStoragePattern(localStorage, fullPattern);
        break;

      case 'session':
        this.invalidateStoragePattern(sessionStorage, fullPattern);
        break;
    }
  }

  // ==========================================================================
  // Statistics & Monitoring
  // ==========================================================================

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      size: this.memoryCache.size,
      maxSize: this.MAX_MEMORY_SIZE,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * Get all keys in cache
   */
  async keys(options: { namespace?: string; storage?: 'memory' | 'local' | 'session' } = {}): Promise<string[]> {
    const storage = options.storage || 'memory';
    const namespace = options.namespace || this.defaultNamespace;
    const prefix = `${namespace}:`;

    switch (storage) {
      case 'memory':
        return Array.from(this.memoryCache.keys())
          .filter(key => key.startsWith(prefix))
          .map(key => key.substring(prefix.length));

      case 'local':
        return this.getStorageKeys(localStorage, prefix);

      case 'session':
        return this.getStorageKeys(sessionStorage, prefix);

      default:
        return [];
    }
  }

  /**
   * Get cache size
   */
  async size(options: { namespace?: string; storage?: 'memory' | 'local' | 'session' } = {}): Promise<number> {
    const keys = await this.keys(options);
    return keys.length;
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private getFullKey(key: string, namespace?: string): string {
    const ns = namespace || this.defaultNamespace;
    return `${ns}:${key}`;
  }

  private getFromStorage<T>(key: string, storage: Storage): CacheEntry<T> | null {
    try {
      const item = storage.getItem(key);
      if (!item) return null;

      return JSON.parse(item) as CacheEntry<T>;
    } catch (error) {
      logger.error('Failed to get from storage', error instanceof Error ? error : undefined);
      return null;
    }
  }

  private setToStorage<T>(key: string, entry: CacheEntry<T>, storage: Storage): void {
    try {
      storage.setItem(key, JSON.stringify(entry));
    } catch (error) {
      // Storage quota exceeded, evict and retry
      logger.warn('Storage quota exceeded, evicting entries');
      this.evictStorageIfNeeded(storage, 1);
      try {
        storage.setItem(key, JSON.stringify(entry));
      } catch (retryError) {
        logger.error('Failed to set to storage after eviction:', retryError);
      }
    }
  }

  private clearStorage(storage: Storage, namespace: string): void {
    const prefix = `${namespace}:`;
    const keysToRemove: string[] = [];

    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => storage.removeItem(key));
  }

  private getStorageKeys(storage: Storage, prefix: string): string[] {
    const keys: string[] = [];

    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(prefix)) {
        keys.push(key.substring(prefix.length));
      }
    }

    return keys;
  }

  private evictLRU(cache: Map<string, CacheEntry<any>>): void {
    // Find entry with lowest hits and oldest creation time
    let lruKey: string | null = null;
    let lruScore = Infinity;

    for (const [key, entry] of cache.entries()) {
      // Score = hits * 1000 + (now - createdAt)
      // Lower score = less valuable
      const score = entry.hits * 1000 + (Date.now() - entry.createdAt);
      if (score < lruScore) {
        lruScore = score;
        lruKey = key;
      }
    }

    if (lruKey) {
      cache.delete(lruKey);
    }
  }

  private evictStorageIfNeeded(storage: Storage, maxSize: number): void {
    const keys = this.getStorageKeys(storage, this.defaultNamespace + ':');
    
    if (keys.length <= maxSize) return;

    // Get all entries with their scores
    const entries: Array<{ key: string; score: number }> = [];

    for (const key of keys) {
      const fullKey = `${this.defaultNamespace}:${key}`;
      const entry = this.getFromStorage(fullKey, storage);
      if (entry) {
        const score = entry.hits * 1000 + (Date.now() - entry.createdAt);
        entries.push({ key: fullKey, score });
      }
    }

    // Sort by score (ascending) and remove lowest scoring entries
    entries.sort((a, b) => a.score - b.score);
    const toRemove = entries.slice(0, entries.length - maxSize);

    toRemove.forEach(({ key }) => storage.removeItem(key));
  }

  private invalidateStoragePattern(storage: Storage, pattern: string): void {
    const keysToRemove: string[] = [];

    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && this.matchPattern(key, pattern)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => storage.removeItem(key));
  }

  private matchPattern(key: string, pattern: string): boolean {
    // Simple wildcard matching (* matches any characters)
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
      .replace(/\*/g, '.*'); // Replace * with .*

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(key);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const cacheService = new CacheService('valuecanvas');

// ============================================================================
// Specialized Cache Instances
// ============================================================================

/**
 * Settings cache with 5-minute TTL
 */
export const settingsCache = {
  async get<T>(key: string, userId?: string): Promise<T | null> {
    const cacheKey = userId ? `settings:${userId}:${key}` : `settings:${key}`;
    return cacheService.get<T>(cacheKey, {
      ttl: 5 * 60 * 1000, // 5 minutes
      namespace: 'settings',
      storage: 'memory',
    });
  },

  async set<T>(key: string, value: T, userId?: string): Promise<void> {
    const cacheKey = userId ? `settings:${userId}:${key}` : `settings:${key}`;
    return cacheService.set(cacheKey, value, {
      ttl: 5 * 60 * 1000,
      namespace: 'settings',
      storage: 'memory',
    });
  },

  async invalidate(key: string, userId?: string): Promise<void> {
    const cacheKey = userId ? `settings:${userId}:${key}` : `settings:${key}`;
    return cacheService.delete(cacheKey, {
      namespace: 'settings',
      storage: 'memory',
    });
  },

  async invalidateUser(userId: string): Promise<void> {
    return cacheService.invalidatePattern(`settings:${userId}:*`, {
      namespace: 'settings',
      storage: 'memory',
    });
  },
};

/**
 * Agent response cache with query + context as key
 */
export const agentCache = {
  async get(query: string, context: Record<string, any>): Promise<any | null> {
    const cacheKey = this.getCacheKey(query, context);
    return cacheService.get(cacheKey, {
      ttl: 10 * 60 * 1000, // 10 minutes
      namespace: 'agent',
      storage: 'memory',
    });
  },

  async set(query: string, context: Record<string, any>, response: any): Promise<void> {
    const cacheKey = this.getCacheKey(query, context);
    return cacheService.set(cacheKey, response, {
      ttl: 10 * 60 * 1000,
      namespace: 'agent',
      storage: 'memory',
    });
  },

  async invalidate(query: string, context: Record<string, any>): Promise<void> {
    const cacheKey = this.getCacheKey(query, context);
    return cacheService.delete(cacheKey, {
      namespace: 'agent',
      storage: 'memory',
    });
  },

  async invalidateAgent(agentType: string): Promise<void> {
    return cacheService.invalidatePattern(`${agentType}:*`, {
      namespace: 'agent',
      storage: 'memory',
    });
  },

  getCacheKey(query: string, context: Record<string, any>): string {
    // Create deterministic cache key from query + context
    const contextStr = JSON.stringify(this.normalizeContext(context));
    const hash = this.simpleHash(query + contextStr);
    return `${context.agentType || 'unknown'}:${hash}`;
  },

  normalizeContext(context: Record<string, any>): Record<string, any> {
    // Remove non-deterministic fields
    const { sessionId, timestamp, ...normalized } = context;
    return normalized;
  },

  simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  },
};

/**
 * Workflow definition cache
 */
export const workflowCache = {
  async get(workflowId: string): Promise<any | null> {
    return cacheService.get(workflowId, {
      ttl: 30 * 60 * 1000, // 30 minutes
      namespace: 'workflow',
      storage: 'memory',
    });
  },

  async set(workflowId: string, workflow: any): Promise<void> {
    return cacheService.set(workflowId, workflow, {
      ttl: 30 * 60 * 1000,
      namespace: 'workflow',
      storage: 'memory',
    });
  },

  async invalidate(workflowId: string): Promise<void> {
    return cacheService.delete(workflowId, {
      namespace: 'workflow',
      storage: 'memory',
    });
  },

  async invalidateAll(): Promise<void> {
    return cacheService.clear({
      namespace: 'workflow',
      storage: 'memory',
    });
  },
};
