/**
 * Tests for Cache Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CacheService, settingsCache, agentCache, workflowCache } from '../CacheService';

describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = new CacheService('test');
  });

  describe('Basic Operations', () => {
    it('should set and get value', async () => {
      await cache.set('key1', 'value1');
      const value = await cache.get('key1');
      expect(value).toBe('value1');
    });

    it('should return null for non-existent key', async () => {
      const value = await cache.get('non-existent');
      expect(value).toBeNull();
    });

    it('should delete value', async () => {
      await cache.set('key1', 'value1');
      await cache.delete('key1');
      const value = await cache.get('key1');
      expect(value).toBeNull();
    });

    it('should check if key exists', async () => {
      await cache.set('key1', 'value1');
      expect(await cache.has('key1')).toBe(true);
      expect(await cache.has('non-existent')).toBe(false);
    });

    it('should clear all cache', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.clear();
      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
    });
  });

  describe('TTL and Expiration', () => {
    it('should expire after TTL', async () => {
      await cache.set('key1', 'value1', { ttl: 100 }); // 100ms TTL
      
      // Should exist immediately
      expect(await cache.get('key1')).toBe('value1');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should be expired
      expect(await cache.get('key1')).toBeNull();
    });

    it('should use default TTL if not specified', async () => {
      await cache.set('key1', 'value1');
      const value = await cache.get('key1');
      expect(value).toBe('value1');
    });
  });

  describe('Advanced Operations', () => {
    it('should get or set value', async () => {
      const fetcher = vi.fn(async () => 'fetched-value');
      
      // First call should fetch
      const value1 = await cache.getOrSet('key1', fetcher);
      expect(value1).toBe('fetched-value');
      expect(fetcher).toHaveBeenCalledTimes(1);
      
      // Second call should use cache
      const value2 = await cache.getOrSet('key1', fetcher);
      expect(value2).toBe('fetched-value');
      expect(fetcher).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should get many keys', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');
      
      const results = await cache.getMany(['key1', 'key2', 'key4']);
      expect(results.get('key1')).toBe('value1');
      expect(results.get('key2')).toBe('value2');
      expect(results.get('key4')).toBeNull();
    });

    it('should set many keys', async () => {
      const entries = new Map([
        ['key1', 'value1'],
        ['key2', 'value2'],
        ['key3', 'value3'],
      ]);
      
      await cache.setMany(entries);
      
      expect(await cache.get('key1')).toBe('value1');
      expect(await cache.get('key2')).toBe('value2');
      expect(await cache.get('key3')).toBe('value3');
    });

    it('should delete many keys', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');
      
      await cache.deleteMany(['key1', 'key3']);
      
      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBe('value2');
      expect(await cache.get('key3')).toBeNull();
    });
  });

  describe('Pattern Invalidation', () => {
    it('should invalidate by pattern', async () => {
      await cache.set('user:123:name', 'John');
      await cache.set('user:123:email', 'john@example.com');
      await cache.set('user:456:name', 'Jane');
      
      await cache.invalidatePattern('user:123:*');
      
      expect(await cache.get('user:123:name')).toBeNull();
      expect(await cache.get('user:123:email')).toBeNull();
      expect(await cache.get('user:456:name')).toBe('Jane');
    });

    it('should handle wildcard patterns', async () => {
      await cache.set('prefix:a:suffix', 'value1');
      await cache.set('prefix:b:suffix', 'value2');
      await cache.set('other:c:suffix', 'value3');
      
      await cache.invalidatePattern('prefix:*:suffix');
      
      expect(await cache.get('prefix:a:suffix')).toBeNull();
      expect(await cache.get('prefix:b:suffix')).toBeNull();
      expect(await cache.get('other:c:suffix')).toBe('value3');
    });
  });

  describe('Statistics', () => {
    it('should track hits and misses', async () => {
      cache.resetStats();
      
      await cache.set('key1', 'value1');
      
      // Hit
      await cache.get('key1');
      
      // Miss
      await cache.get('non-existent');
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should calculate hit rate correctly', async () => {
      cache.resetStats();
      
      await cache.set('key1', 'value1');
      
      // 3 hits
      await cache.get('key1');
      await cache.get('key1');
      await cache.get('key1');
      
      // 1 miss
      await cache.get('non-existent');
      
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0.75); // 3/4
    });

    it('should reset statistics', async () => {
      await cache.set('key1', 'value1');
      await cache.get('key1');
      await cache.get('non-existent');
      
      cache.resetStats();
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('Namespace Support', () => {
    it('should isolate namespaces', async () => {
      await cache.set('key1', 'value1', { namespace: 'ns1' });
      await cache.set('key1', 'value2', { namespace: 'ns2' });
      
      const value1 = await cache.get('key1', { namespace: 'ns1' });
      const value2 = await cache.get('key1', { namespace: 'ns2' });
      
      expect(value1).toBe('value1');
      expect(value2).toBe('value2');
    });

    it('should clear namespace independently', async () => {
      await cache.set('key1', 'value1', { namespace: 'ns1' });
      await cache.set('key2', 'value2', { namespace: 'ns2' });
      
      await cache.clear({ namespace: 'ns1' });
      
      expect(await cache.get('key1', { namespace: 'ns1' })).toBeNull();
      expect(await cache.get('key2', { namespace: 'ns2' })).toBe('value2');
    });
  });

  describe('Keys and Size', () => {
    it('should list all keys', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');
      
      const keys = await cache.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    it('should return cache size', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      
      const size = await cache.size();
      expect(size).toBe(2);
    });
  });
});

describe('Specialized Caches', () => {
  describe('Settings Cache', () => {
    it('should cache settings with user ID', async () => {
      await settingsCache.set('theme', 'dark', 'user-123');
      const value = await settingsCache.get('theme', 'user-123');
      expect(value).toBe('dark');
    });

    it('should invalidate user settings', async () => {
      await settingsCache.set('theme', 'dark', 'user-123');
      await settingsCache.set('language', 'en', 'user-123');
      
      await settingsCache.invalidateUser('user-123');
      
      expect(await settingsCache.get('theme', 'user-123')).toBeNull();
      expect(await settingsCache.get('language', 'user-123')).toBeNull();
    });
  });

  describe('Agent Cache', () => {
    it('should cache agent responses', async () => {
      const query = 'Generate opportunity page';
      const context = { userId: 'user-123', agentType: 'opportunity' };
      const response = { success: true, data: {} };
      
      await agentCache.set(query, context, response);
      const cached = await agentCache.get(query, context);
      
      expect(cached).toEqual(response);
    });

    it('should generate consistent cache keys', () => {
      const query = 'test query';
      const context1 = { userId: 'user-123', agentType: 'opportunity' };
      const context2 = { userId: 'user-123', agentType: 'opportunity' };
      
      const key1 = agentCache.getCacheKey(query, context1);
      const key2 = agentCache.getCacheKey(query, context2);
      
      expect(key1).toBe(key2);
    });

    it('should normalize context for caching', () => {
      const context = {
        userId: 'user-123',
        agentType: 'opportunity',
        sessionId: 'session-456', // Should be removed
        timestamp: Date.now(), // Should be removed
      };
      
      const normalized = agentCache.normalizeContext(context);
      
      expect(normalized.userId).toBe('user-123');
      expect(normalized.agentType).toBe('opportunity');
      expect(normalized.sessionId).toBeUndefined();
      expect(normalized.timestamp).toBeUndefined();
    });

    it('should invalidate agent cache', async () => {
      const query = 'test query';
      const context = { userId: 'user-123', agentType: 'opportunity' };
      
      await agentCache.set(query, context, { data: 'test' });
      await agentCache.invalidateAgent('opportunity');
      
      const cached = await agentCache.get(query, context);
      expect(cached).toBeNull();
    });
  });

  describe('Workflow Cache', () => {
    it('should cache workflow definitions', async () => {
      const workflow = { id: 'wf-123', name: 'Test Workflow' };
      
      await workflowCache.set('wf-123', workflow);
      const cached = await workflowCache.get('wf-123');
      
      expect(cached).toEqual(workflow);
    });

    it('should invalidate workflow cache', async () => {
      await workflowCache.set('wf-123', { id: 'wf-123' });
      await workflowCache.invalidate('wf-123');
      
      const cached = await workflowCache.get('wf-123');
      expect(cached).toBeNull();
    });

    it('should invalidate all workflows', async () => {
      await workflowCache.set('wf-1', { id: 'wf-1' });
      await workflowCache.set('wf-2', { id: 'wf-2' });
      
      await workflowCache.invalidateAll();
      
      expect(await workflowCache.get('wf-1')).toBeNull();
      expect(await workflowCache.get('wf-2')).toBeNull();
    });
  });
});
