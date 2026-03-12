/**
 * DSR API — actorId guard tests
 *
 * Verifies that /export and /erase return 401 when the auth middleware
 * fails to populate req.userId (actorId), preventing audit records with
 * actor="unknown" from being written for high-severity DSR events.
 */

import { describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

vi.mock('../../lib/supabase.js', () => ({
  supabase: {},
  createServerSupabaseClient: vi.fn(() => ({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn().mockReturnThis(),
  })),
}));

vi.mock('@shared/lib/supabase', () => ({
  createServerSupabaseClient: vi.fn(() => ({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn().mockReturnThis(),
  })),
}));

vi.mock('@shared/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('../../middleware/auth.js', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../middleware/rbac.js', () => ({
  requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../middleware/tenantContext.js', () => ({
  tenantContextMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../middleware/secureRouter.js', async () => {
  const express = (await import('express')).default;
  return { createSecureRouter: () => express.Router() };
});

vi.mock('../../middleware/rateLimiter.js', () => ({
  createRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  RateLimitTier: { STANDARD: 'standard', STRICT: 'strict' },
}));

import request from 'supertest';
import express from 'express';

// ─── App factory ──────────────────────────────────────────────────────────────

async function makeApp(reqOverrides: Record<string, unknown> = {}) {
  const app = express();
  app.use(express.json());

  // Inject request context that middleware would normally set
  app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    Object.assign(req, { tenantId: 'tenant-abc', requestId: 'req-001', ...reqOverrides });
    next();
  });

  const { default: dsrRouter } = await import('../dataSubjectRequests.js');
  app.use('/api/dsr', dsrRouter);
  return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DSR /export — actorId guard', () => {
  it('returns 401 when userId is not set on request (actorId missing)', async () => {
    // userId deliberately absent — simulates broken middleware chain
    const app = await makeApp({ tenantId: 'tenant-abc', userId: undefined });

    const res = await request(app)
      .post('/api/dsr/export')
      .send({ email: 'user@example.com' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication required');
  });

  it('does not return 401 when userId is present', async () => {
    // userId present — guard should pass (will 404 because user not in DB)
    const app = await makeApp({ tenantId: 'tenant-abc', userId: 'actor-123' });

    const res = await request(app)
      .post('/api/dsr/export')
      .send({ email: 'user@example.com' });

    // 404 (user not found) means the guard passed — not 401
    expect(res.status).not.toBe(401);
  });
});

describe('DSR /erase — actorId guard', () => {
  it('returns 401 when userId is not set on request (actorId missing)', async () => {
    const app = await makeApp({ tenantId: 'tenant-abc', userId: undefined });

    const res = await request(app)
      .post('/api/dsr/erase')
      .send({ email: 'user@example.com' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication required');
  });

  it('does not return 401 when userId is present', async () => {
    const app = await makeApp({ tenantId: 'tenant-abc', userId: 'actor-123' });

    const res = await request(app)
      .post('/api/dsr/erase')
      .send({ email: 'user@example.com' });

    expect(res.status).not.toBe(401);
  });
});
