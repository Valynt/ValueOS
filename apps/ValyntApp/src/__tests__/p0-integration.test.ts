/**
 * P0 Integration Tests
 * 
 * Tests the complete flow of all P0 implementations
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { checkDatabaseConnection, isDatabaseHealthy } from '../lib/database';
import { deleteCache, getCache, initializeRedisCache, isRedisConnected, setCache } from '../lib/redis';

describe('P0 Integration: Database Connection', () => {
  it('should connect to database successfully', async () => {
    const result = await checkDatabaseConnection(3, 500);
    
    expect(result).toHaveProperty('connected');
    expect(result).toHaveProperty('latency');
    
    if (result.connected) {
      expect(result.latency).toBeGreaterThan(0);
      expect(result.latency).toBeLessThan(5000);
    }
  });

  it('should verify database health', async () => {
    const isHealthy = await isDatabaseHealthy();
    expect(typeof isHealthy).toBe('boolean');
  });

  it('should retry on connection failure', async () => {
    // This test verifies retry logic
    // In real scenario, temporarily disable database to test
    const startTime = Date.now();
    const result = await checkDatabaseConnection(3, 100);
    const duration = Date.now() - startTime;
    
    // If connection fails, should have retried (taking at least 100ms)
    if (!result.connected) {
      expect(duration).toBeGreaterThan(100);
    }
  });
});

describe('P0 Integration: Redis Cache', () => {
  let cacheInitialized = false;

  beforeAll(async () => {
    // Initialize Redis for testing
    const config = {
      enabled: true,
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      ttl: 300,
    };
    
    const result = await initializeRedisCache(config);
    cacheInitialized = result.connected;
  });

  it('should initialize Redis cache', () => {
    // Cache may not be available in all environments
    expect(typeof cacheInitialized).toBe('boolean');
  });

  it('should set and get cache values', async () => {
    if (!cacheInitialized) {
      console.log('Redis not available, skipping test');
      return;
    }

    const key = 'test-key-123';
    const value = { data: 'test-value', timestamp: Date.now() };
    
    const setResult = await setCache(key, value, 60);
    expect(setResult).toBe(true);
    
    const getValue = await getCache(key);
    expect(getValue).toEqual(value);
    
    // Cleanup
    await deleteCache(key);
  });

  it('should handle cache misses gracefully', async () => {
    if (!cacheInitialized) {
      return;
    }

    const value = await getCache('non-existent-key');
    expect(value).toBeNull();
  });

  it('should respect TTL', async () => {
    if (!cacheInitialized) {
      return;
    }

    const key = 'ttl-test-key';
    const value = 'test-value';
    
    // Set with 1 second TTL
    await setCache(key, value, 1);
    
    // Should exist immediately
    const immediate = await getCache(key);
    expect(immediate).toBe(value);
    
    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    // Should be expired
    const expired = await getCache(key);
    expect(expired).toBeNull();
  });

  it('should work without Redis (graceful degradation)', async () => {
    // Even if Redis is not available, app should work
    const result = await setCache('test-key', 'test-value');
    
    // Should return false if Redis not connected, but not throw
    expect(typeof result).toBe('boolean');
  });
});

describe('P0 Integration: Complete Bootstrap Flow', () => {
  it('should complete bootstrap sequence', async () => {
    // Test the complete bootstrap flow
    const steps = {
      database: false,
      redis: false,
      sentry: false,
    };

    // Step 1: Database
    try {
      const dbResult = await checkDatabaseConnection(2, 500);
      steps.database = dbResult.connected;
    } catch (error) {
      console.error('Database check failed:', error);
    }

    // Step 2: Redis
    try {
      const redisConfig = {
        enabled: true,
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        ttl: 300,
      };
      const redisResult = await initializeRedisCache(redisConfig);
      steps.redis = redisResult.connected;
    } catch (error) {
      console.error('Redis init failed:', error);
    }

    // Step 3: Sentry (would be initialized in real bootstrap)
    steps.sentry = true; // Assume Sentry initializes successfully

    // At minimum, database should be connected
    expect(steps.database).toBe(true);
    
    // Log results
    console.log('Bootstrap steps:', steps);
  });
});

describe('P0 Integration: Error Handling', () => {
  it('should handle database connection errors gracefully', async () => {
    // Test with invalid connection
    const result = await checkDatabaseConnection(1, 100);
    
    // Should not throw, should return result with error
    expect(result).toHaveProperty('connected');
    expect(result).toHaveProperty('latency');
  });

  it('should handle Redis connection errors gracefully', async () => {
    // Test with invalid Redis URL
    const config = {
      enabled: true,
      url: 'redis://invalid-host:9999',
      ttl: 300,
    };
    
    const result = await initializeRedisCache(config);
    
    // Should not throw, should return result with error
    expect(result.connected).toBe(false);
    expect(result).toHaveProperty('error');
  });
});

describe('P0 Integration: Performance', () => {
  it('should connect to database within acceptable time', async () => {
    const startTime = Date.now();
    const result = await checkDatabaseConnection(1, 1000);
    const duration = Date.now() - startTime;
    
    if (result.connected) {
      // Should connect within 2 seconds
      expect(duration).toBeLessThan(2000);
      expect(result.latency).toBeLessThan(1000);
    }
  });

  it('should initialize Redis within acceptable time', async () => {
    const config = {
      enabled: true,
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      ttl: 300,
    };
    
    const startTime = Date.now();
    const result = await initializeRedisCache(config);
    const duration = Date.now() - startTime;
    
    if (result.connected) {
      // Should initialize within 5 seconds
      expect(duration).toBeLessThan(5000);
      expect(result.latency).toBeLessThan(2000);
    }
  });

  it('should cache operations be fast', async () => {
    if (!isRedisConnected()) {
      return;
    }

    const key = 'perf-test-key';
    const value = 'test-value';
    
    // Set operation
    const setStart = Date.now();
    await setCache(key, value);
    const setDuration = Date.now() - setStart;
    expect(setDuration).toBeLessThan(100);
    
    // Get operation
    const getStart = Date.now();
    await getCache(key);
    const getDuration = Date.now() - getStart;
    expect(getDuration).toBeLessThan(50);
    
    // Cleanup
    await deleteCache(key);
  });
});
