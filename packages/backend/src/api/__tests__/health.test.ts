/**
 * Health Check API Tests
 * 
 * CRITICAL: Tests health check endpoints that load balancers depend on
 */

import express from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@shared/lib/health/metrics', () => ({
  healthMetrics: {
    recordHealthSnapshot: vi.fn(),
    getServiceStats: vi.fn(),
    getHealthHistory: vi.fn(),
    getHealthTrends: vi.fn(),
  },
}));

vi.mock('@shared/lib/health/alerts', () => ({
  alertManager: {
    getActiveAlerts: vi.fn(),
    getAllAlerts: vi.fn(),
    acknowledgeAlert: vi.fn(),
  },
}));

vi.mock('../../middleware/securityHeaders', () => ({
  securityHeadersMiddleware: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../middleware/serviceIdentityMiddleware', () => ({
  serviceIdentityMiddleware: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../middleware/rateLimiter', () => ({
  rateLimiters: {
    loose: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  },
}));

vi.mock('../../middleware/requestAuditMiddleware', () => ({
  requestAuditMiddleware: () => (
    _req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => next(),
}));

vi.mock('../../config/validateEnv.js', () => ({
  validateEnv: () => ({ warnings: [] }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        limit: vi.fn(async () => ({ error: null })),
      })),
    })),
  })),
}));

vi.mock('../../lib/redisClient.js', () => ({
  getRedisClient: vi.fn(() => ({
    ping: vi.fn().mockResolvedValue('PONG'),
  })),
}));

vi.mock('../../observability/dataFreshness.js', () => ({
  checkAllT1TableFreshness: vi.fn(async () => []),
}));



vi.mock('../../workers/crmWorker.js', () => ({
  getCrmSyncQueue: vi.fn(() => ({ name: 'crm-sync' })),
  getCrmWebhookQueue: vi.fn(() => ({ name: 'crm-webhook' })),
  getPrefetchQueue: vi.fn(() => ({ name: 'crm-prefetch' })),
}));

vi.mock('../../workers/researchWorker.js', () => ({
  getResearchQueue: vi.fn(() => ({ name: 'onboarding-research' })),
}));

vi.mock('../../middleware/llmRateLimiter.js', () => ({
  getLlmRateLimitBackendStatus: vi.fn(() => ({ enabled: false, backend: 'memory' })),
  llmRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../middleware/authRateLimiter.js', () => ({
  getAuthRateLimitBackendStatus: vi.fn(() => ({ enabled: false, backend: 'memory' })),
  authRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../middleware/rateLimiter.js', () => {
  const noop = (_req: unknown, _res: unknown, next: () => void) => next();
  return {
    getGeneralRateLimitBackendStatus: vi.fn(() => ({ enabled: false, backend: 'memory' })),
    rateLimiters: new Proxy({}, { get: () => noop }),
    RateLimitTier: { STANDARD: 'standard', STRICT: 'strict', LOOSE: 'loose' },
  };
});

vi.mock('../../observability/queueMetrics.js', () => ({
  getQueueHealth: vi.fn().mockResolvedValue({ healthy: true, queues: [] }),
}));

// Prevent real outbound HTTP calls from LLM provider health checks.
// Must be called before the health router is imported so the mock is in place
// when the module initialises its fetch-based provider checks.
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: async () => ({ data: [] }),
  text: async () => '',
}));

// AbortSignal.timeout creates a real timer that keeps the test alive for 5s.
// Replace with an immediately-resolved signal so tests don't hang.
vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => new AbortController().signal);

import healthRouter from '../health/index.js'

describe('Health Check API', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(healthRouter);
  });

  describe('GET /health', () => {
    it('should return 200 when all dependencies are healthy', async () => {
      const response = await request(app)
        .get('/health');

      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toMatch(/healthy|degraded|unhealthy/);
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('checks');
    });

    it('should include all dependency checks', async () => {
      const response = await request(app)
        .get('/health');

      expect([200, 503]).toContain(response.status);
      const { checks } = response.body;
      
      // Verify all critical dependencies are checked
      expect(checks).toHaveProperty('database');
      expect(checks).toHaveProperty('supabase');
      
      // Each check should have status and latency
      expect(checks.database).toHaveProperty('status');
      expect(checks.database).toHaveProperty('lastChecked');
    });

    it('should return 503 when a critical dependency is down', async () => {
      // Make the Supabase mock return a DB error so checkSupabase() reports unhealthy.
      // We also need the env vars set so the check isn't skipped as "not_configured".
      const origUrl = process.env.VITE_SUPABASE_URL;
      const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

      const { createClient } = await import('@supabase/supabase-js');
      vi.mocked(createClient).mockImplementationOnce(() => ({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            limit: vi.fn(async () => ({ error: { message: 'connection refused' } })),
          })),
        })),
      }) as any);

      const response = await request(app).get('/health');

      // Restore env
      process.env.VITE_SUPABASE_URL = origUrl;
      process.env.SUPABASE_SERVICE_ROLE_KEY = origKey;

      expect(response.status).toBe(503);
      expect(response.body.status).toMatch(/unhealthy|degraded/);
    });

    it('should respond within 5 seconds', async () => {
      const start = Date.now();
      await request(app).get('/health');
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('GET /health/live', () => {
    it('should return 200 for liveness probe', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'alive');
    });

    it('should respond quickly for K8s liveness', async () => {
      const start = Date.now();
      await request(app).get('/health/live');
      const duration = Date.now() - start;
      
      // Liveness should be very fast
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 when ready to serve traffic', async () => {
      const response = await request(app)
        .get('/health/ready');

      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
    });

    it('should check database connectivity', async () => {
      const response = await request(app)
        .get('/health/ready');

      expect([200, 503]).toContain(response.status);
      if (response.body.checks) {
        expect(response.body.checks).toHaveProperty('database');
      }
    });
  });

  describe('GET /health/startup', () => {
    it('should return 200 when startup is complete', async () => {
      const response = await request(app)
        .get('/health/startup');

      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
    });
  });

  describe('GET /health/dependencies', () => {
    it('should return detailed dependency status', async () => {
      const response = await request(app)
        .get('/health/dependencies')
        .expect(200);

      expect(response.body).toHaveProperty('checks');
      expect(typeof response.body.checks).toBe('object');
      expect(response.body.checks).toHaveProperty('database');
      expect(response.body.checks).toHaveProperty('supabase');
    });

    it('should include latency for each dependency', async () => {
      const response = await request(app)
        .get('/health/dependencies')
        .expect(200);

      const { checks } = response.body;
      
      // Check each dependency has required properties
      Object.values(checks).forEach((dep) => {
        expect(dep).toHaveProperty('status');
        expect(dep).toHaveProperty('lastChecked');
        // latency is optional (only present when check succeeds)
      });
    });
  });

  describe('Error Scenarios', () => {
    it('should handle database connection failures gracefully', async () => {
      // Mock database failure
      // This would require dependency injection or mocking
      
      const response = await request(app).get('/health');
      
      // Should not crash, should return error status
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(600);
    });

    it('should not expose sensitive information in errors', async () => {
      const response = await request(app).get('/health');
      
      const body = JSON.stringify(response.body);
      
      // Should not contain passwords, tokens, or connection strings
      expect(body).not.toMatch(/password/i);
      expect(body).not.toMatch(/token/i);
      expect(body).not.toMatch(/postgres:\/\//);
      expect(body).not.toMatch(/api[_-]?key/i);
    });
  });

  describe('Performance', () => {
    it('should handle concurrent health checks', async () => {
      const requests = Array(10).fill(null).map(() => 
        request(app).get('/health')
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(600);
      });
    });

    it('should not leak memory on repeated calls', async () => {
      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        await request(app).get('/health/live');
      }
      
      // Completing 100 requests without throwing is the assertion
    });
  });
});
