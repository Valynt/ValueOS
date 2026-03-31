/**
 * Analytics API — Tenant Header Spoofing Guard (TDD)
 *
 * P0 Security Requirement: Unauthenticated analytics endpoints must never
 * allow tenant-scoped cache invalidation via header spoofing.
 *
 * Expected Behavior:
 * - Unauthenticated requests: always use "public-telemetry" cache scope
 * - Tenant headers (x-tenant-id, x-organization-id): ignored for cache invalidation
 * - Valid payloads: accepted and logged to public telemetry
 * - Invalid payloads: rejected with 400, no cache invalidation
 * - Authenticated requests: may use tenant-scoped cache (separate test suite)
 *
 * INVARIANT: No unauthenticated request may trigger tenant-scoped cache invalidation.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockInvalidateEndpoint, mockGetOrLoad, mockRecord } = vi.hoisted(() => ({
  mockInvalidateEndpoint: vi.fn().mockResolvedValue(0),
  mockGetOrLoad: vi.fn().mockResolvedValue({ success: true }),
  mockRecord: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/cache/ReadThroughCacheService.js', () => ({
  ReadThroughCacheService: {
    invalidateEndpoint: mockInvalidateEndpoint,
    getOrLoad: mockGetOrLoad,
  }
}));

vi.mock('@shared/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('../middleware/rateLimiter.js', () => ({
  createRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../middleware/auth.js', () => ({
  optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../middleware/tenantContext.js', () => ({
  tenantContextMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../analytics/ValueLoopAnalytics.js', () => ({
  ValueLoopAnalytics: { record: mockRecord, getInsights: vi.fn() },
  RecordEventInputSchema: { safeParse: vi.fn().mockReturnValue({ success: true, data: {} }) },
}));

import type { Express } from 'express';
import express from 'express';
import request from 'supertest';

// ─── App factory ──────────────────────────────────────────────────────────────

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/analytics/web-vitals — Unauthenticated Cache Scope Enforcement', () => {
  let app: Express;

  beforeAll(async () => {
    const { default: analyticsRouter } = await import('../api/analytics.js');
    app = makeApp();
    app.use('/api/analytics', analyticsRouter);
  });

  beforeEach(() => {
    mockInvalidateEndpoint.mockClear();
    mockRecord.mockClear();
  });

  describe('Cache Invalidation Scope (Security)', () => {
    it('must invalidate public-telemetry scope when x-tenant-id header is supplied without auth', async () => {
      const res = await request(app)
        .post('/api/analytics/web-vitals')
        .set('x-tenant-id', 'spoofed-tenant-uuid')
        .send({ name: 'LCP', value: 1200 });

      expect(res.status).toBe(200);
      expect(mockInvalidateEndpoint).toHaveBeenCalledTimes(1);
      expect(mockInvalidateEndpoint).toHaveBeenCalledWith("public-telemetry", "api-analytics-summary");
    });

    it('must invalidate public-telemetry scope when x-organization-id header is supplied without auth', async () => {
      const res = await request(app)
        .post('/api/analytics/web-vitals')
        .set('x-organization-id', 'spoofed-org-uuid')
        .send({ name: 'FID', value: 50 });

      expect(res.status).toBe(200);
      expect(mockInvalidateEndpoint).toHaveBeenCalledTimes(1);
      expect(mockInvalidateEndpoint).toHaveBeenCalledWith("public-telemetry", "api-analytics-summary");
    });

    it('must NOT invalidate tenant-scoped cache when x-tenant-id is spoofed', async () => {
      await request(app)
        .post('/api/analytics/web-vitals')
        .set('x-tenant-id', 'legitimate-tenant-123')
        .send({ name: 'CLS', value: 0.1 });

      expect(mockInvalidateEndpoint).not.toHaveBeenCalledWith("legitimate-tenant-123", expect.any(String));
      expect(mockInvalidateEndpoint).not.toHaveBeenCalledWith(expect.stringContaining('tenant'), expect.any(String));
    });

    it('must NOT invalidate organization-scoped cache when x-organization-id is spoofed', async () => {
      await request(app)
        .post('/api/analytics/web-vitals')
        .set('x-organization-id', 'legitimate-org-456')
        .send({ name: 'TTFB', value: 800 });

      expect(mockInvalidateEndpoint).not.toHaveBeenCalledWith("legitimate-org-456", expect.any(String));
      expect(mockInvalidateEndpoint).not.toHaveBeenCalledWith(expect.stringContaining('org'), expect.any(String));
    });

    it('must use public-telemetry scope regardless of multiple spoofed headers', async () => {
      await request(app)
        .post('/api/analytics/web-vitals')
        .set('x-tenant-id', 'tenant-a')
        .set('x-organization-id', 'org-b')
        .set('x-workspace-id', 'workspace-c')
        .send({ name: 'FCP', value: 1500 });

      expect(mockInvalidateEndpoint).toHaveBeenCalledWith("public-telemetry", "api-analytics-summary");
      expect(mockInvalidateEndpoint).toHaveBeenCalledTimes(1);
    });

    it('must use public-telemetry scope when no tenant headers are provided', async () => {
      await request(app)
        .post('/api/analytics/web-vitals')
        .send({ name: 'INP', value: 200 });

      expect(mockInvalidateEndpoint).toHaveBeenCalledWith("public-telemetry", "api-analytics-summary");
    });
  });

  describe('Payload Validation', () => {
    it('must reject payloads missing required name field', async () => {
      const res = await request(app)
        .post('/api/analytics/web-vitals')
        .set('x-tenant-id', 'spoofed-tenant-uuid')
        .send({ value: 1200, rating: 'good' }); // missing name

      expect(res.status).toBe(400);
      expect(mockInvalidateEndpoint).not.toHaveBeenCalled();
    });

    it('must reject payloads missing required value field', async () => {
      const res = await request(app)
        .post('/api/analytics/web-vitals')
        .send({ name: 'LCP', rating: 'good' }); // missing value

      expect(res.status).toBe(400);
      expect(mockInvalidateEndpoint).not.toHaveBeenCalled();
    });

    it('must reject payloads with empty body', async () => {
      const res = await request(app)
        .post('/api/analytics/web-vitals')
        .send({});

      expect(res.status).toBe(400);
      expect(mockInvalidateEndpoint).not.toHaveBeenCalled();
    });

    it('must reject payloads with null values', async () => {
      const res = await request(app)
        .post('/api/analytics/web-vitals')
        .send({ name: null, value: null });

      expect(res.status).toBe(400);
      expect(mockInvalidateEndpoint).not.toHaveBeenCalled();
    });

    it('must reject payloads with wrong data types', async () => {
      const res = await request(app)
        .post('/api/analytics/web-vitals')
        .send({ name: 123, value: 'fast' }); // name should be string, value numeric

      expect(res.status).toBe(400);
      expect(mockInvalidateEndpoint).not.toHaveBeenCalled();
    });

    it('must accept valid web vitals payload with all required fields', async () => {
      const res = await request(app)
        .post('/api/analytics/web-vitals')
        .send({ name: 'LCP', value: 1200, rating: 'good' });

      expect(res.status).toBe(200);
      expect(mockInvalidateEndpoint).toHaveBeenCalledWith("public-telemetry", "api-analytics-summary");
    });

    it('must accept minimal valid payload (name + value only)', async () => {
      const res = await request(app)
        .post('/api/analytics/web-vitals')
        .send({ name: 'TTFB', value: 800 });

      expect(res.status).toBe(200);
    });
  });

  describe('Security Headers Handling', () => {
    it('must ignore x-tenant-id header for cache invalidation even if formatted like valid UUID', async () => {
      await request(app)
        .post('/api/analytics/web-vitals')
        .set('x-tenant-id', '550e8400-e29b-41d4-a716-446655440000')
        .send({ name: 'LCP', value: 1200 });

      expect(mockInvalidateEndpoint).toHaveBeenCalledWith("public-telemetry", "api-anographics-summary");
      expect(mockInvalidateEndpoint).not.toHaveBeenCalledWith("550e8400-e29b-41d4-a716-446655440000", expect.any(String));
    });

    it('must ignore case variations of tenant headers', async () => {
      await request(app)
        .post('/api/analytics/web-vitals')
        .set('X-Tenant-Id', 'spoofed-1')
        .set('X-TENANT-ID', 'spoofed-2')
        .set('x-tenant-ID', 'spoofed-3')
        .send({ name: 'CLS', value: 0.1 });

      expect(mockInvalidateEndpoint).toHaveBeenCalledWith("public-telemetry", "api-analytics-summary");
      expect(mockInvalidateEndpoint).not.toHaveBeenCalledWith('spoofed-1', expect.any(String));
      expect(mockInvalidateEndpoint).not.toHaveBeenCalledWith('spoofed-2', expect.any(String));
      expect(mockInvalidateEndpoint).not.toHaveBeenCalledWith('spoofed-3', expect.any(String));
    });

    it('must treat empty tenant headers as absent', async () => {
      await request(app)
        .post('/api/analytics/web-vitals')
        .set('x-tenant-id', '')
        .send({ name: 'FCP', value: 1500 });

      expect(mockInvalidateEndpoint).toHaveBeenCalledWith("public-telemetry", "api-analytics-summary");
    });
  });

  describe('Telemetry Recording', () => {
    it('must record valid web vitals to analytics system', async () => {
      await request(app)
        .post('/api/analytics/web-vitals')
        .send({ name: 'LCP', value: 1200, rating: 'good' });

      expect(mockRecord).toHaveBeenCalled();
      expect(mockRecord).toHaveBeenCalledWith(expect.objectContaining({
        name: 'LCP',
        value: 1200,
      }));
    });

    it('must NOT record invalid payloads to analytics system', async () => {
      await request(app)
        .post('/api/analytics/web-vitals')
        .send({ invalid: 'data' });

      expect(mockRecord).not.toHaveBeenCalled();
    });
  });

  describe('Error Response Format', () => {
    it('must return 400 with error message for invalid payloads', async () => {
      const res = await request(app)
        .post('/api/analytics/web-vitals')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('must return 200 with success indicator for valid payloads', async () => {
      const res = await request(app)
        .post('/api/analytics/web-vitals')
        .send({ name: 'LCP', value: 1200 });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });
});
