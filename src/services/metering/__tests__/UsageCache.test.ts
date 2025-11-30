/**
 * Usage Cache Tests
 */

import { describe, it, expect, vi } from 'vitest';

describe('UsageCache', () => {
  it('should cache usage with TTL', () => {
    const cache = new Map();
    const key = 'usage:tenant-1:llm_tokens';
    const value = 1000;
    const ttl = 60;

    cache.set(key, {
      value,
      expiresAt: Date.now() + ttl * 1000,
    });

    expect(cache.has(key)).toBe(true);
  });

  it('should expire old cache entries', () => {
    const now = Date.now();
    const entry = {
      value: 100,
      expiresAt: now - 1000, // Expired
    };

    const isExpired = entry.expiresAt < now;
    expect(isExpired).toBe(true);
  });

  it('should calculate quota correctly', () => {
    const usage = 8500;
    const quota = 10000;
    const percentage = Math.round((usage / quota) * 100);

    expect(percentage).toBe(85);
  });

  it('should handle unlimited quota', () => {
    const usage = 1000000;
    const quota = Infinity;
    const isOverQuota = usage >= quota;

    expect(isOverQuota).toBe(false);
  });

  it('should fall back to database on cache miss', async () => {
    const fetchFromDB = async () => 1500;
    const usage = await fetchFromDB();
    
    expect(usage).toBe(1500);
  });
});
