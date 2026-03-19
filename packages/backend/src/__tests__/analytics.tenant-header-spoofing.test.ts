/**
 * Analytics API — tenant header spoofing guard
 *
 * An unauthenticated POST /api/analytics/web-vitals that supplies an
 * x-tenant-id header must never invalidate tenant-scoped cache buckets.
 * The route must always invalidate the fixed public telemetry cache scope.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetOrLoad, mockInfo, mockInvalidateEndpoint } = vi.hoisted(() => ({
  mockGetOrLoad: vi.fn().mockResolvedValue({ success: true }),
  mockInfo: vi.fn(),
  mockInvalidateEndpoint: vi.fn().mockResolvedValue(0),
}));

vi.mock('@shared/lib/logger', () => ({
  createLogger: () => ({ info: mockInfo, warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('../services/cache/ReadThroughCacheService.js', () => ({
  ReadThroughCacheService: {
    invalidateEndpoint: mockInvalidateEndpoint,
    getOrLoad: mockGetOrLoad,
  }
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
  ValueLoopAnalytics: { record: vi.fn(), getInsights: vi.fn() },
  RecordEventInputSchema: { safeParse: vi.fn().mockReturnValue({ success: false }) },
}));

import type { Express } from 'express';
import express from 'express';
import request from 'supertest';

function makeApp(): Express {
  const app = express();
  return app;
}

describe('POST /api/analytics/web-vitals — tenant header spoofing', () => {
  let app: Express;

  beforeAll(async () => {
    const { default: analyticsRouter } = await import('../api/analytics.js');
    app = makeApp();
    app.use('/api/analytics', analyticsRouter);
  });

  beforeEach(() => {
    mockInfo.mockClear();
    mockInvalidateEndpoint.mockClear();
  });

  it('invalidates only the public telemetry scope when x-tenant-id is supplied without auth', async () => {
    const res = await request(app)
      .post('/api/analytics/web-vitals')
      .set('x-tenant-id', 'spoofed-tenant-uuid')
      .send({ name: 'LCP', value: 1200 });

    expect(res.status).toBe(200);
    expect(mockInvalidateEndpoint).toHaveBeenCalledWith("public-telemetry", "api-analytics-summary");
    expect(mockInvalidateEndpoint).not.toHaveBeenCalledWith("spoofed-tenant-uuid", "api-analytics-summary");
  });

  it('invalidates only the public telemetry scope when x-organization-id is supplied without auth', async () => {
    const res = await request(app)
      .post('/api/analytics/web-vitals')
      .set('x-organization-id', 'spoofed-org-uuid')
      .send({ name: 'FID', value: 50 });

    expect(res.status).toBe(200);
    expect(mockInvalidateEndpoint).toHaveBeenCalledWith("public-telemetry", "api-analytics-summary");
    expect(mockInvalidateEndpoint).not.toHaveBeenCalledWith("spoofed-org-uuid", "api-analytics-summary");
  });

  it('rejects payloads missing required fields regardless of tenant header', async () => {
    const res = await request(app)
      .post('/api/analytics/web-vitals')
      .set('x-tenant-id', 'spoofed-tenant-uuid')
      .send({ rating: 'good' });

    expect(res.status).toBe(400);
    expect(mockInvalidateEndpoint).not.toHaveBeenCalled();
  });
});
