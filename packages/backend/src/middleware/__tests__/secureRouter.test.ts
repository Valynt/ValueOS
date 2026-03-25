import { describe, expect, it } from 'vitest';

import { createSecureRouter } from '../secureRouter.js'

vi.mock("../../lib/supabase.js");
vi.mock("../../security/RedisSessionStore.js", () => ({
  getSessionStore: () => ({ get: vi.fn(), set: vi.fn(), destroy: vi.fn() }),
}));
vi.mock("../auth.js", () => ({
  verifyAccessToken: vi.fn().mockResolvedValue({ sub: 'user-1' }),
}));
vi.mock("../rateLimiter.js", () => ({
  rateLimiters: {
    standard: function rateLimiter(_req: unknown, _res: unknown, next: () => void) { next(); },
    strict: function rateLimiter(_req: unknown, _res: unknown, next: () => void) { next(); },
  },
  RateLimitTier: { STANDARD: 'standard', STRICT: 'strict' },
}));

function hasMiddleware(router: any, name: string): boolean {
  return router.stack?.some((layer: any) => (layer.name || '').includes(name));
}

describe('createSecureRouter', () => {
  it('adds standard security middlewares and rate limiter', () => {
    const router = createSecureRouter('standard');
    expect(hasMiddleware(router, 'securityHeadersMiddleware')).toBe(true);
    expect(hasMiddleware(router, 'serviceIdentityMiddleware')).toBe(true);
    expect(hasMiddleware(router, 'csrfProtectionMiddleware')).toBe(true);
    expect(hasMiddleware(router, 'sessionTimeoutMiddleware')).toBe(true);
    expect(hasMiddleware(router, 'rateLimiter')).toBe(true);
  });
});

