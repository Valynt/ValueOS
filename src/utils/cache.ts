/**
 * Multi-layer Caching Strategy
 * Browser cache, session storage, and memory cache
 */

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  storage?: 'memory' | 'session' | 'local';
  version?: string;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  version: string;
}

class CacheManager {
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly CACHE_VERSION = '1.0';

  /**
   * Set cache entry
   */
  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const {
      ttl = this.DEFAULT_TTL,
      storage = 'memory',
      version = this.CACHE_VERSION,
    } = options;

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
      version,
    };

    switch (storage) {
      case 'memory':
        this.memoryCache.set(key, entry);
        break;
      case 'session':
        this.setSessionStorage(key, entry);
        break;
      case 'local':
        this.setLocalStorage(key, entry);
        break;
    }
  }

  /**
   * Get cache entry
   */
  get<T>(key: string, options: CacheOptions = {}): T | null {
    const { storage = 'memory', version = this.CACHE_VERSION } = options;

    let entry: CacheEntry<T> | null = null;

    switch (storage) {
      case 'memory':
        entry = this.memoryCache.get(key) || null;
        break;
      case 'session':
        entry = this.getSessionStorage<T>(key);
        break;
      case 'local':
        entry = this.getLocalStorage<T>(key);
        break;
    }

    if (!entry) return null;

    // Check version
    if (entry.version !== version) {
      this.delete(key, { storage });
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.delete(key, { storage });
      return null;
    }

    return entry.data;
  }

  /**
   * Delete cache entry
   */
  delete(key: string, options: CacheOptions = {}): void {
    const { storage = 'memory' } = options;

    switch (storage) {
      case 'memory':
        this.memoryCache.delete(key);
        break;
      case 'session':
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem(key);
        }
        break;
      case 'local':
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(key);
        }
        break;
    }
  }

  /**
   * Clear all cache entries
   */
  clear(storage?: 'memory' | 'session' | 'local'): void {
    if (!storage || storage === 'memory') {
      this.memoryCache.clear();
    }

    if (!storage || storage === 'session') {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.clear();
      }
    }

    if (!storage || storage === 'local') {
      if (typeof localStorage !== 'undefined') {
        localStorage.clear();
      }
    }
  }

  /**
   * Get or set cache entry
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    const data = await factory();
    this.set(key, data, options);
    return data;
  }

  /**
   * Check if cache entry exists and is valid
   */
  has(key: string, options: CacheOptions = {}): boolean {
    return this.get(key, options) !== null;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    memorySize: number;
    sessionSize: number;
    localStorage: number;
  } {
    let sessionSize = 0;
    let localStorageSize = 0;

    if (typeof sessionStorage !== 'undefined') {
      sessionSize = Object.keys(sessionStorage).length;
    }

    if (typeof localStorage !== 'undefined') {
      localStorageSize = Object.keys(localStorage).length;
    }

    return {
      memorySize: this.memoryCache.size,
      sessionSize,
      localStorage: localStorageSize,
    };
  }

  /**
   * Clean expired entries
   */
  cleanExpired(): number {
    let cleaned = 0;
    const now = Date.now();

    // Clean memory cache
    this.memoryCache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    });

    // Clean session storage
    if (typeof sessionStorage !== 'undefined') {
      Object.keys(sessionStorage).forEach((key) => {
        const entry = this.getSessionStorage(key);
        if (entry && now > entry.expiresAt) {
          sessionStorage.removeItem(key);
          cleaned++;
        }
      });
    }

    // Clean local storage
    if (typeof localStorage !== 'undefined') {
      Object.keys(localStorage).forEach((key) => {
        const entry = this.getLocalStorage(key);
        if (entry && now > entry.expiresAt) {
          localStorage.removeItem(key);
          cleaned++;
        }
      });
    }

    return cleaned;
  }

  /**
   * Prefetch data for common navigation patterns
   */
  async prefetch<T>(
    keys: Array<{ key: string; factory: () => Promise<T>; options?: CacheOptions }>
  ): Promise<void> {
    await Promise.all(
      keys.map(({ key, factory, options }) => this.getOrSet(key, factory, options))
    );
  }

  private setSessionStorage<T>(key: string, entry: CacheEntry<T>): void {
    if (typeof sessionStorage === 'undefined') return;

    try {
      sessionStorage.setItem(key, JSON.stringify(entry));
    } catch (error) {
      logger.warn('Session storage error:', error);
    }
  }

  private getSessionStorage<T>(key: string): CacheEntry<T> | null {
    if (typeof sessionStorage === 'undefined') return null;

    try {
      const item = sessionStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      logger.warn('Session storage error:', error);
      return null;
    }
  }

  private setLocalStorage<T>(key: string, entry: CacheEntry<T>): void {
    if (typeof localStorage === 'undefined') return;

    try {
      localStorage.setItem(key, JSON.stringify(entry));
    } catch (error) {
      logger.warn('Local storage error:', error);
    }
  }

  private getLocalStorage<T>(key: string): CacheEntry<T> | null {
    if (typeof localStorage === 'undefined') return null;

    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      logger.warn('Local storage error:', error);
      return null;
    }
  }
}

export const cacheManager = new CacheManager();

/**
 * React hook for caching
 */
export const useCache = <T,>(
  key: string,
  factory: () => Promise<T>,
  options: CacheOptions = {}
) => {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        const result = await cacheManager.getOrSet(key, factory, options);

        if (mounted) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err as Error);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [key]);

  const invalidate = React.useCallback(() => {
    cacheManager.delete(key, options);
    setData(null);
  }, [key, options]);

  return { data, loading, error, invalidate };
};

import { logger } from './lib/logger';
import React from 'react';
