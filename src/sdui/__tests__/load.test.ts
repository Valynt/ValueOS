/**
 * SDUI Load Testing Suite
 * 
 * Tests system behavior under high load:
 * - Concurrent requests
 * - Cache eviction patterns
 * - Rate limiting enforcement
 * - Memory stability
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { performance } from 'perf_hooks';
import { sanitizeProps } from '../security/sanitization';
import { validateSession, createSessionContext, type SessionContext } from '../security/sessionValidation';
import { resetSecurityMetrics, getSecurityMetrics } from '../security/metrics';

describe('Load Testing', () => {
  beforeEach(() => {
    resetSecurityMetrics();
  });

  describe('Concurrent Request Handling', () => {
    it('should handle 1000 concurrent sanitizations', async () => {
      const inputs = Array(1000).fill({
        title: '<script>alert(1)</script>Component',
        content: 'Safe content',
      });

      const start = performance.now();
      const results = await Promise.all(
        inputs.map(input => Promise.resolve(sanitizeProps(input, 'InfoBanner')))
      );
      const duration = performance.now() - start;

      expect(results).toHaveLength(1000);
      expect(duration).toBeLessThan(5000); // 1000 concurrent in <5s
    });

    it('should handle 10000 sequential sanitizations', () => {
      const input = {
        title: '<script>XSS</script>Test',
        content: 'Content',
      };

      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        sanitizeProps(input, 'InfoBanner');
      }
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50000); // 10k in <50s (5ms avg)
    });

    it('should handle mixed workload (sanitize + validate)', async () => {
      const session = createSessionContext('user-123', 'org-456');
      const props = {
        title: '<b>Title</b>',
        content: 'Content',
      };

      const operations = [];
      for (let i = 0; i < 5000; i++) {
        if (i % 2 === 0) {
          operations.push(Promise.resolve(validateSession(session)));
        } else {
          operations.push(Promise.resolve(sanitizeProps(props, 'InfoBanner')));
        }
      }

      const start = performance.now();
      const results = await Promise.all(operations);
      const duration = performance.now() - start;

      expect(results).toHaveLength(5000);
      expect(duration).toBeLessThan(15000); // 5k mixed ops in <15s
    });
  });

  describe('Cache Eviction Under Load', () => {
    it('should maintain performance during eviction', () => {
      const cache = new Map<string, any>();
      const accessOrder: string[] = [];
      const MAX_SIZE = 1000;

      const addToCache = (key: string, value: any) => {
        if (cache.size >= MAX_SIZE && !cache.has(key)) {
          // Evict LRU
          const lruKey = accessOrder.shift();
          if (lruKey) cache.delete(lruKey);
        }
        cache.set(key, value);
        const index = accessOrder.indexOf(key);
        if (index > -1) accessOrder.splice(index, 1);
        accessOrder.push(key);
      };

      const start = performance.now();

      // Add 5000 items (will trigger eviction after 1000)
      for (let i = 0; i < 5000; i++) {
        addToCache(`key-${i}`, { value: `value-${i}` });
      }

      const duration = performance.now() - start;

      expect(cache.size).toBeLessThanOrEqual(MAX_SIZE);
      expect(duration).toBeLessThan(1000); // 5000 ops with eviction <1s
    });

    it('should handle high eviction rate without memory leak', () => {
      const cache = new Map<string, any>();
      const MAX_SIZE = 100; // Small cache to force frequent eviction
      const accessOrder: string[] = [];

      for (let i = 0; i < 10000; i++) {
        const key = `key-${i}`;
        
        if (cache.size >= MAX_SIZE) {
          const lruKey = accessOrder.shift();
          if (lruKey) cache.delete(lruKey);
        }
        
        cache.set(key, { value: `value-${i}` });
        accessOrder.push(key);
      }

      expect(cache.size).toBeLessThanOrEqual(MAX_SIZE);
      expect(accessOrder.length).toBeLessThanOrEqual(MAX_SIZE);
    });

    it('should maintain cache hit rate under load', () => {
      const cache = new Map<string, any>();
      const accessOrder: string[] = [];
      const MAX_SIZE = 1000;
      let hits = 0;
      let misses = 0;

      const getCached = (key: string): any => {
        if (cache.has(key)) {
          hits++;
          // Update access order
          const index = accessOrder.indexOf(key);
          if (index > -1) {
            accessOrder.splice(index, 1);
            accessOrder.push(key);
          }
          return cache.get(key);
        }
        misses++;
        return null;
      };

      const setCached = (key: string, value: any) => {
        if (cache.size >= MAX_SIZE && !cache.has(key)) {
          const lruKey = accessOrder.shift();
          if (lruKey) cache.delete(lruKey);
        }
        cache.set(key, value);
        if (!accessOrder.includes(key)) {
          accessOrder.push(key);
        }
      };

      // Populate cache with 1000 items
      for (let i = 0; i < 1000; i++) {
        setCached(`key-${i}`, { value: `value-${i}` });
      }

      // Access pattern: 80% existing keys, 20% new keys
      for (let i = 0; i < 10000; i++) {
        const key = i < 8000 
          ? `key-${i % 1000}` // Access existing
          : `key-new-${i}`; // New keys
        
        let value = getCached(key);
        if (!value) {
          setCached(key, { value: `value-${i}` });
        }
      }

      const hitRate = (hits / (hits + misses)) * 100;
      
      expect(cache.size).toBeLessThanOrEqual(MAX_SIZE);
      expect(hitRate).toBeGreaterThan(70); // >70% hit rate under load
    });
  });

  describe('Rate Limiting Under Load', () => {
    it('should enforce rate limits under burst traffic', () => {
      const rateLimiter = new Map<string, { count: number; resetTime: number }>();
      const RATE_LIMIT = 100;
      const WINDOW_MS = 60000;
      let blocked = 0;

      const checkRateLimit = (orgId: string): boolean => {
        const now = Date.now();
        let entry = rateLimiter.get(orgId);

        if (!entry || now > entry.resetTime) {
          entry = { count: 0, resetTime: now + WINDOW_MS };
          rateLimiter.set(orgId, entry);
        }

        entry.count++;

        if (entry.count > RATE_LIMIT) {
          blocked++;
          return false;
        }

        return true;
      };

      // Simulate burst: 500 requests in quick succession
      for (let i = 0; i < 500; i++) {
        checkRateLimit('org-123');
      }

      expect(blocked).toBeGreaterThan(0);
      expect(blocked).toBe(400); // 500 - 100 allowed
    });

    it('should handle multiple organizations concurrently', () => {
      const rateLimiter = new Map<string, { count: number; resetTime: number }>();
      const RATE_LIMIT = 100;
      const WINDOW_MS = 60000;
      const orgIds = Array(100).fill(0).map((_, i) => `org-${i}`);

      orgIds.forEach(orgId => {
        for (let i = 0; i < 50; i++) {
          const now = Date.now();
          let entry = rateLimiter.get(orgId);

          if (!entry || now > entry.resetTime) {
            entry = { count: 0, resetTime: now + WINDOW_MS };
            rateLimiter.set(orgId, entry);
          }

          entry.count++;
        }
      });

      expect(rateLimiter.size).toBe(100); // 100 orgs tracked
      orgIds.forEach(orgId => {
        const entry = rateLimiter.get(orgId);
        expect(entry?.count).toBe(50); // Each org made 50 requests
      });
    });
  });

  describe('Session Validation Under Load', () => {
    it('should validate 100000 sessions efficiently', () => {
      const validSession = createSessionContext('user-123', 'org-456');
      const expiredSession = {
        ...validSession,
        expiresAt: Date.now() - 1000,
      };

      const sessions: SessionContext[] = [];
      for (let i = 0; i < 100000; i++) {
        sessions.push(i % 10 === 0 ? expiredSession : validSession);
      }

      const start = performance.now();
      const results = sessions.map(s => validateSession(s));
      const duration = performance.now() - start;

      const validCount = results.filter(r => r.valid).length;
      const invalidCount = results.filter(r => !r.valid).length;

      expect(validCount).toBe(90000); // 90% valid
      expect(invalidCount).toBe(10000); // 10% expired
      expect(duration).toBeLessThan(100000); // 100k validations in <100s (1ms avg)
    });

    it('should handle concurrent session checks', async () => {
      const session = createSessionContext('user-123', 'org-456');
      const checks = Array(10000).fill(session);

      const start = performance.now();
      const results = await Promise.all(
        checks.map(s => Promise.resolve(validateSession(s)))
      );
      const duration = performance.now() - start;

      expect(results.every(r => r.valid)).toBe(true);
      expect(duration).toBeLessThan(10000); // 10k concurrent in <10s
    });
  });

  describe('Memory Stability', () => {
    it('should maintain stable memory with continuous operations', () => {
      const cache = new Map<string, any>();
      const MAX_SIZE = 1000;
      const accessOrder: string[] = [];

      // Run for 100k operations
      for (let i = 0; i < 100000; i++) {
        const key = `key-${i}`;
        
        if (cache.size >= MAX_SIZE) {
          const lruKey = accessOrder.shift();
          if (lruKey) cache.delete(lruKey);
        }
        
        cache.set(key, {
          value: `value-${i}`,
          timestamp: Date.now(),
        });
        
        accessOrder.push(key);
      }

      // Memory should be bounded
      expect(cache.size).toBe(MAX_SIZE);
      expect(accessOrder.length).toBe(MAX_SIZE);
    });

    it('should cleanup expired entries efficiently', () => {
      const cache = new Map<string, any>();
      const now = Date.now();

      // Add 10k entries with varying expiry
      for (let i = 0; i < 10000; i++) {
        cache.set(`key-${i}`, {
          value: `value-${i}`,
          timestamp: now - (i * 100), // Staggered timestamps
          ttl: 5000,
        });
      }

      const start = performance.now();
      
      // Cleanup expired
      let removed = 0;
      for (const [key, entry] of cache.entries()) {
        if (now > entry.timestamp + entry.ttl) {
          cache.delete(key);
          removed++;
        }
      }
      
      const duration = performance.now() - start;

      expect(removed).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100); // Cleanup 10k entries in <100ms
    });
  });

  describe('System Stress Test', () => {
    it('should handle realistic production load', async () => {
      // Simulate: 1000 users, 10 requests each, mixed operations
      const users = Array(1000).fill(0).map((_, i) => ({
        session: createSessionContext(`user-${i}`, `org-${i % 100}`),
        requests: 10,
      }));

      const operations: Promise<any>[] = [];

      users.forEach(user => {
        for (let i = 0; i < user.requests; i++) {
          // Mix of operations
          if (i % 3 === 0) {
            operations.push(Promise.resolve(validateSession(user.session)));
          } else {
            const props = {
              title: `<script>XSS</script>User ${user.session.userId}`,
              content: 'Content',
            };
            operations.push(Promise.resolve(sanitizeProps(props, 'InfoBanner')));
          }
        }
      });

      const start = performance.now();
      const results = await Promise.all(operations);
      const duration = performance.now() - start;

      expect(results).toHaveLength(10000); // 1000 users × 10 requests
      expect(duration).toBeLessThan(50000); // 10k ops in <50s
    });

    it('should maintain responsiveness under sustained load', () => {
      const cache = new Map<string, any>();
      const MAX_SIZE = 1000;
      const accessOrder: string[] = [];
      const durations: number[] = [];

      // Simulate sustained load over time
      for (let batch = 0; batch < 100; batch++) {
        const batchStart = performance.now();
        
        // Each batch: 100 operations
        for (let i = 0; i < 100; i++) {
          const key = `key-${batch * 100 + i}`;
          
          if (cache.size >= MAX_SIZE) {
            const lruKey = accessOrder.shift();
            if (lruKey) cache.delete(lruKey);
          }
          
          cache.set(key, { value: `value-${i}` });
          accessOrder.push(key);
        }
        
        durations.push(performance.now() - batchStart);
      }

      // Check for performance degradation
      const firstBatch = durations[0];
      const lastBatch = durations[durations.length - 1];
      const degradation = (lastBatch - firstBatch) / firstBatch;

      expect(cache.size).toBe(MAX_SIZE);
      expect(degradation).toBeLessThan(0.5); // <50% degradation over time
    });
  });
});
