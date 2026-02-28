/**
 * Tests for DomainValidator
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { domainCache } from '../src/cache';
import { domainDatabase } from '../src/database';
import { DomainValidator } from '../src/validator';

// Mock dependencies
vi.mock('../src/cache', () => ({
  domainCache: {
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn(),
    getStats: vi.fn(),
  },
}));

vi.mock('../src/database', () => ({
  domainDatabase: {
    isDomainVerified: vi.fn(),
    getVerifiedDomainsCount: vi.fn(),
  },
}));

describe('DomainValidator', () => {
  let validator: DomainValidator;

  beforeEach(() => {
    validator = new DomainValidator();
    vi.clearAllMocks();
  });

  describe('verifyDomain', () => {
    it('should return false for invalid domain format', async () => {
      const result = await validator.verifyDomain('invalid domain');
      
      expect(result.verified).toBe(false);
      expect(result.cached).toBe(false);
    });

    it('should normalize domain to lowercase', async () => {
      vi.mocked(domainCache.get).mockReturnValue(null);
      vi.mocked(domainDatabase.isDomainVerified).mockResolvedValue(true);
      
      await validator.verifyDomain('EXAMPLE.COM');
      
      expect(domainDatabase.isDomainVerified).toHaveBeenCalledWith('example.com');
    });

    it('should return cached result when available', async () => {
      vi.mocked(domainCache.get).mockReturnValue(true);
      
      const result = await validator.verifyDomain('example.com');
      
      expect(result.verified).toBe(true);
      expect(result.cached).toBe(true);
      expect(domainDatabase.isDomainVerified).not.toHaveBeenCalled();
    });

    it('should query database when cache miss', async () => {
      vi.mocked(domainCache.get).mockReturnValue(null);
      vi.mocked(domainDatabase.isDomainVerified).mockResolvedValue(true);
      
      const result = await validator.verifyDomain('example.com');
      
      expect(result.verified).toBe(true);
      expect(result.cached).toBe(false);
      expect(domainDatabase.isDomainVerified).toHaveBeenCalledWith('example.com');
    });

    it('should cache database result', async () => {
      vi.mocked(domainCache.get).mockReturnValue(null);
      vi.mocked(domainDatabase.isDomainVerified).mockResolvedValue(true);
      
      await validator.verifyDomain('example.com');
      
      expect(domainCache.set).toHaveBeenCalledWith('example.com', true);
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(domainCache.get).mockReturnValue(null);
      vi.mocked(domainDatabase.isDomainVerified).mockRejectedValue(new Error('Database error'));
      
      const result = await validator.verifyDomain('example.com');
      
      expect(result.verified).toBe(false);
      expect(domainCache.set).toHaveBeenCalledWith('example.com', false);
    });

    it('should measure duration', async () => {
      vi.mocked(domainCache.get).mockReturnValue(true);
      
      const result = await validator.verifyDomain('example.com');
      
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('domain format validation', () => {
    it('should accept valid domains', async () => {
      const validDomains = [
        'example.com',
        'sub.example.com',
        'app.acme.com',
        'test-domain.com',
        'a.b.c.d.example.com',
      ];

      vi.mocked(domainCache.get).mockReturnValue(true);

      for (const domain of validDomains) {
        const result = await validator.verifyDomain(domain);
        expect(result.verified).toBe(true);
      }
    });

    it('should reject invalid domains', async () => {
      const invalidDomains = [
        'invalid domain',
        'domain',
        '-invalid.com',
        'invalid-.com',
        'invalid..com',
        '.invalid.com',
        'invalid.com.',
        '',
      ];

      for (const domain of invalidDomains) {
        const result = await validator.verifyDomain(domain);
        expect(result.verified).toBe(false);
      }
    });
  });

  describe('getStats', () => {
    it('should return combined statistics', async () => {
      vi.mocked(domainCache.getStats).mockReturnValue({
        size: 10,
        maxSize: 100,
        ttlSeconds: 300,
      });
      vi.mocked(domainDatabase.getVerifiedDomainsCount).mockResolvedValue(50);
      
      const stats = await validator.getStats();
      
      expect(stats.cacheSize).toBe(10);
      expect(stats.cacheMaxSize).toBe(100);
      expect(stats.cacheTtlSeconds).toBe(300);
      expect(stats.verifiedDomainsCount).toBe(50);
    });
  });

  describe('clearCache', () => {
    it('should clear cache and return count', () => {
      vi.mocked(domainCache.clear).mockReturnValue(42);
      
      const count = validator.clearCache();
      
      expect(count).toBe(42);
      expect(domainCache.clear).toHaveBeenCalled();
    });
  });
});
