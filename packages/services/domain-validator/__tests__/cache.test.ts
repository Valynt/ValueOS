/**
 * Tests for DomainCache
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DomainCache } from '../src/cache';

describe('DomainCache', () => {
  let cache: DomainCache;

  beforeEach(() => {
    cache = new DomainCache(5, 10); // 5 second TTL, max 10 entries
  });

  afterEach(() => {
    cache.stopCleanup();
  });

  describe('get and set', () => {
    it('should return null for non-existent domain', () => {
      const result = cache.get('example.com');
      expect(result).toBeNull();
    });

    it('should return cached value for existing domain', () => {
      cache.set('example.com', true);
      const result = cache.get('example.com');
      expect(result).toBe(true);
    });

    it('should cache both verified and unverified domains', () => {
      cache.set('verified.com', true);
      cache.set('unverified.com', false);
      
      expect(cache.get('verified.com')).toBe(true);
      expect(cache.get('unverified.com')).toBe(false);
    });
  });

  describe('expiration', () => {
    it('should return null for expired entries', async () => {
      cache.set('example.com', true);
      
      // Fast-forward time
      vi.useFakeTimers();
      vi.advanceTimersByTime(6000); // 6 seconds (past 5 second TTL)
      
      const result = cache.get('example.com');
      expect(result).toBeNull();
      
      vi.useRealTimers();
    });

    it('should not expire entries before TTL', async () => {
      cache.set('example.com', true);
      
      vi.useFakeTimers();
      vi.advanceTimersByTime(4000); // 4 seconds (before 5 second TTL)
      
      const result = cache.get('example.com');
      expect(result).toBe(true);
      
      vi.useRealTimers();
    });
  });

  describe('size limits', () => {
    it('should enforce max size', () => {
      // Add 11 entries (max is 10)
      for (let i = 0; i < 11; i++) {
        cache.set(`domain${i}.com`, true);
      }
      
      expect(cache.size()).toBe(10);
    });

    it('should evict oldest entry when max size reached', () => {
      // Fill cache to max
      for (let i = 0; i < 10; i++) {
        cache.set(`domain${i}.com`, true);
      }
      
      // Add one more
      cache.set('new-domain.com', true);
      
      // First entry should be evicted
      expect(cache.get('domain0.com')).toBeNull();
      expect(cache.get('new-domain.com')).toBe(true);
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      cache.set('domain1.com', true);
      cache.set('domain2.com', false);
      
      const clearedCount = cache.clear();
      
      expect(clearedCount).toBe(2);
      expect(cache.size()).toBe(0);
      expect(cache.get('domain1.com')).toBeNull();
      expect(cache.get('domain2.com')).toBeNull();
    });

    it('should return 0 when clearing empty cache', () => {
      const clearedCount = cache.clear();
      expect(clearedCount).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      cache.set('domain1.com', true);
      cache.set('domain2.com', false);
      
      const stats = cache.getStats();
      
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(10);
      expect(stats.ttlSeconds).toBe(5);
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries during cleanup', async () => {
      vi.useFakeTimers();

      const newCache = new DomainCache(5, 10);

      newCache.set('domain1.com', true);
      newCache.set('domain2.com', false);
      
      // Advance time past TTL
      vi.advanceTimersByTime(6000);
      
      // Trigger cleanup (runs every minute)
      vi.advanceTimersByTime(60000);
      
      expect(newCache.size()).toBe(0);
      
      newCache.stopCleanup();
      vi.useRealTimers();
    });
  });
});
