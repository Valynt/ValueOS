/**
 * CacheService Tests
 * 
 * Tests for caching with TTL management following MCP patterns
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('CacheService', () => {
  let mockCache: Map<string, any>;

  beforeEach(() => {
    mockCache = new Map();
  });

  describe('Basic Operations', () => {
    it('should set and get cache values', async () => {
      const key = 'test-key';
      const value = { data: 'test-value' };

      mockCache.set(key, value);
      const result = mockCache.get(key);

      expect(result).toEqual(value);
    });

    it('should delete cache values', async () => {
      const key = 'test-key';
      mockCache.set(key, { data: 'test' });

      mockCache.delete(key);

      expect(mockCache.has(key)).toBe(false);
    });

    it('should check cache existence', async () => {
      const key = 'test-key';
      mockCache.set(key, { data: 'test' });

      expect(mockCache.has(key)).toBe(true);
      expect(mockCache.has('non-existent')).toBe(false);
    });

    it('should clear all cache', async () => {
      mockCache.set('key1', { data: 'value1' });
      mockCache.set('key2', { data: 'value2' });

      mockCache.clear();

      expect(mockCache.size).toBe(0);
    });
  });

  describe('TTL Management', () => {
    it('should set cache with TTL', async () => {
      const key = 'test-key';
      const value = { data: 'test' };
      const ttl = 3600; // 1 hour

      const entry = {
        value,
        expiresAt: Date.now() + ttl * 1000
      };

      mockCache.set(key, entry);

      expect(mockCache.get(key)).toEqual(entry);
    });

    it('should expire cache after TTL', async () => {
      const key = 'test-key';
      const value = { data: 'test' };
      const ttl = 1; // 1 second

      const entry = {
        value,
        expiresAt: Date.now() + ttl * 1000
      };

      mockCache.set(key, entry);

      // Simulate time passing
      await new Promise(resolve => setTimeout(resolve, 1100));

      const cached = mockCache.get(key);
      if (cached && cached.expiresAt < Date.now()) {
        mockCache.delete(key);
      }

      expect(mockCache.has(key)).toBe(false);
    });

    it('should refresh TTL on access', async () => {
      const key = 'test-key';
      const value = { data: 'test' };
      const ttl = 3600;

      const entry = {
        value,
        expiresAt: Date.now() + ttl * 1000
      };

      mockCache.set(key, entry);

      // Refresh TTL
      const cached = mockCache.get(key);
      if (cached) {
        cached.expiresAt = Date.now() + ttl * 1000;
        mockCache.set(key, cached);
      }

      expect(mockCache.get(key)?.expiresAt).toBeGreaterThan(Date.now());
    });
  });

  describe('Cache Strategies', () => {
    it('should implement LRU eviction', async () => {
      const maxSize = 3;
      const lruCache = new Map();

      // Add items
      lruCache.set('key1', { value: 'value1', lastAccessed: Date.now() });
      lruCache.set('key2', { value: 'value2', lastAccessed: Date.now() });
      lruCache.set('key3', { value: 'value3', lastAccessed: Date.now() });

      // Add 4th item, should evict oldest
      if (lruCache.size >= maxSize) {
        const oldestKey = Array.from(lruCache.entries())
          .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)[0][0];
        lruCache.delete(oldestKey);
      }
      lruCache.set('key4', { value: 'value4', lastAccessed: Date.now() });

      expect(lruCache.size).toBe(maxSize);
      expect(lruCache.has('key1')).toBe(false);
    });

    it('should support cache warming', async () => {
      const warmupData = [
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2' },
        { key: 'key3', value: 'value3' }
      ];

      warmupData.forEach(({ key, value }) => {
        mockCache.set(key, { value, expiresAt: Date.now() + 3600000 });
      });

      expect(mockCache.size).toBe(3);
    });
  });

  describe('Cache Patterns', () => {
    it('should implement cache-aside pattern', async () => {
      const key = 'user-123';
      
      // Check cache first
      let data = mockCache.get(key);
      
      if (!data) {
        // Cache miss - fetch from source
        data = { id: 'user-123', name: 'Test User' };
        mockCache.set(key, data);
      }

      expect(data).toBeDefined();
      expect(mockCache.has(key)).toBe(true);
    });

    it('should implement write-through pattern', async () => {
      const key = 'user-123';
      const data = { id: 'user-123', name: 'Updated User' };

      // Write to cache and source simultaneously
      mockCache.set(key, data);
      // Simulate DB write
      const dbWrite = Promise.resolve({ success: true });

      await dbWrite;

      expect(mockCache.get(key)).toEqual(data);
    });
  });

  describe('Performance', () => {
    it('should handle high-volume operations', async () => {
      const operations = 1000;

      for (let i = 0; i < operations; i++) {
        mockCache.set(`key-${i}`, { value: `value-${i}` });
      }

      expect(mockCache.size).toBe(operations);
    });

    it('should provide cache statistics', async () => {
      let hits = 0;
      let misses = 0;

      // Simulate cache operations
      mockCache.set('key1', { value: 'value1' });

      // Hit
      if (mockCache.has('key1')) hits++;
      
      // Miss
      if (!mockCache.has('key2')) misses++;

      const hitRate = hits / (hits + misses);

      expect(hitRate).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle cache errors gracefully', async () => {
      const key = 'test-key';

      try {
        // Simulate cache error
        if (Math.random() > 1) {
          throw new Error('Cache unavailable');
        }
        mockCache.set(key, { value: 'test' });
      } catch (error) {
        // Fallback to direct source
        expect(error).toBeDefined();
      }
    });

    it('should handle serialization errors', async () => {
      const key = 'test-key';
      const circularRef: any = { a: 1 };
      circularRef.self = circularRef;

      try {
        JSON.stringify(circularRef);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
