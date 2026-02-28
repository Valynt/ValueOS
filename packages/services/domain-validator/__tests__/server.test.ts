/**
 * Integration tests for server endpoints
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { domainValidator } from '../src/validator';
import { domainDatabase } from '../src/database';

// Mock dependencies
vi.mock('../src/validator', () => ({
  domainValidator: {
    verifyDomain: vi.fn(),
    getStats: vi.fn(),
    clearCache: vi.fn(),
  },
}));

vi.mock('../src/database', () => ({
  domainDatabase: {
    healthCheck: vi.fn(),
  },
}));

describe('Server Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /verify', () => {
    it('should return 400 when domain parameter is missing', async () => {
      const response = await request(app).get('/verify');
      
      expect(response.status).toBe(400);
      expect(response.text).toContain('Domain parameter required');
    });

    it('should return 200 when domain is verified', async () => {
      vi.mocked(domainValidator.verifyDomain).mockResolvedValue({
        verified: true,
        cached: false,
        duration: 10,
      });
      
      const response = await request(app).get('/verify?domain=example.com');
      
      expect(response.status).toBe(200);
      expect(response.text).toBe('OK');
    });

    it('should return 404 when domain is not verified', async () => {
      vi.mocked(domainValidator.verifyDomain).mockResolvedValue({
        verified: false,
        cached: false,
        duration: 10,
      });
      
      const response = await request(app).get('/verify?domain=example.com');
      
      expect(response.status).toBe(404);
      expect(response.text).toContain('Domain not verified');
    });

    it('should return 500 on internal error', async () => {
      vi.mocked(domainValidator.verifyDomain).mockRejectedValue(new Error('Internal error'));
      
      const response = await request(app).get('/verify?domain=example.com');
      
      expect(response.status).toBe(500);
      expect(response.text).toContain('Internal server error');
    });

    it('should call verifyDomain with correct domain', async () => {
      vi.mocked(domainValidator.verifyDomain).mockResolvedValue({
        verified: true,
        cached: false,
        duration: 10,
      });
      
      await request(app).get('/verify?domain=app.acme.com');
      
      expect(domainValidator.verifyDomain).toHaveBeenCalledWith('app.acme.com');
    });
  });

  describe('GET /health', () => {
    it('should return 200 when healthy', async () => {
      vi.mocked(domainDatabase.healthCheck).mockResolvedValue(true);
      vi.mocked(domainValidator.getStats).mockResolvedValue({
        cacheSize: 10,
        cacheMaxSize: 100,
        cacheTtlSeconds: 300,
        verifiedDomainsCount: 50,
      });
      
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.cache).toBeDefined();
      expect(response.body.database).toBeDefined();
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return 503 when database is unhealthy', async () => {
      vi.mocked(domainDatabase.healthCheck).mockResolvedValue(false);
      
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
      expect(response.body.reason).toContain('Database');
    });

    it('should return 503 on error', async () => {
      vi.mocked(domainDatabase.healthCheck).mockRejectedValue(new Error('Health check error'));
      
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
    });
  });

  describe('POST /cache/clear', () => {
    it('should clear cache and return count', async () => {
      vi.mocked(domainValidator.clearCache).mockReturnValue(42);
      
      const response = await request(app).post('/cache/clear');
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Cache cleared');
      expect(response.body.clearedCount).toBe(42);
    });

    it('should handle errors', async () => {
      vi.mocked(domainValidator.clearCache).mockImplementation(() => {
        throw new Error('Clear error');
      });
      
      const response = await request(app).post('/cache/clear');
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /stats', () => {
    it('should return statistics', async () => {
      vi.mocked(domainValidator.getStats).mockResolvedValue({
        cacheSize: 10,
        cacheMaxSize: 100,
        cacheTtlSeconds: 300,
        verifiedDomainsCount: 50,
      });
      
      const response = await request(app).get('/stats');
      
      expect(response.status).toBe(200);
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
      expect(response.body.cache.size).toBe(10);
      expect(response.body.database.verifiedDomains).toBe(50);
    });

    it('should handle errors', async () => {
      vi.mocked(domainValidator.getStats).mockRejectedValue(new Error('Stats error'));
      
      const response = await request(app).get('/stats');
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('404 handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/unknown');
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not found');
      expect(response.body.path).toBe('/unknown');
    });
  });
});
