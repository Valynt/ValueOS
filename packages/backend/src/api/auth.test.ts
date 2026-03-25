import express from 'express';
import request from 'supertest';

import router from './auth.js'

vi.mock("../lib/supabase.js");

// Bypass CSRF and rate limiting so tests reach the route handler
vi.mock('../middleware/securityMiddleware', () => ({
  csrfProtectionMiddleware: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  csrfTokenMiddleware: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  securityHeadersMiddleware: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../middleware/rateLimiter.js', () => ({
  authRateLimiter: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  rateLimiters: {
    standard: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
    strict: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  },
  RateLimitTier: { STANDARD: 'standard', STRICT: 'strict' },
}));

vi.mock('../middleware/requestAuditMiddleware.js', () => ({
  requestAuditMiddleware: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

describe('auth api router', () => {
  const app = express().use(express.json()).use('/api/auth', router);

  it('rejects login with missing credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    // Route is implemented — missing email/password returns 400
    expect([400, 422]).toContain(res.status);
  });

  it('rejects password reset with missing email', async () => {
    const res = await request(app).post('/api/auth/password/reset').send({});
    // Route is implemented — missing email returns 400
    expect([400, 422]).toContain(res.status);
  });
});
