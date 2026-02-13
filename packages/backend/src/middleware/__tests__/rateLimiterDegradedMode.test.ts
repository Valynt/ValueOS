import { describe, expect, it, vi } from 'vitest';
import { createRateLimiter } from '../rateLimiter.js'

const mockReq = (overrides: any = {}) => {
  const headers = overrides.headers || {};
  return {
    user: overrides.user || undefined,
    headers,
    header: (name: string) => headers[name.toLowerCase()],
    get: (name: string) => headers[name.toLowerCase()],
    tenantId: overrides.tenantId,
    ip: overrides.ip || '1.1.1.1',
    socket: { remoteAddress: overrides.remoteAddress || '1.1.1.1' },
    path: overrides.path || '/test',
    method: overrides.method || 'GET',
  } as any;
};

const makeRes = () => {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader: vi.fn((name: string, value: string | number) => {
      headers[name] = String(value);
    }),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
};

describe('rateLimiter degraded mode policy', () => {
  it('fails closed for auth routes regardless of tier in distributed mode', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalOverride = process.env.RATE_LIMIT_ALLOW_SENSITIVE_MEMORY_FALLBACK;
    process.env.NODE_ENV = 'production';
    delete process.env.RATE_LIMIT_ALLOW_SENSITIVE_MEMORY_FALLBACK;

    const limiter = createRateLimiter('loose');

    const res = makeRes();
    const next = vi.fn();
    await limiter(mockReq({ path: '/auth/login', method: 'GET' }), res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.headers['X-RateLimit-Enforcement']).toBe('degraded-protective');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'RATE_LIMIT_DEGRADED_PROTECTION' })
    );

    process.env.NODE_ENV = originalNodeEnv;
    if (originalOverride === undefined) {
      delete process.env.RATE_LIMIT_ALLOW_SENSITIVE_MEMORY_FALLBACK;
    } else {
      process.env.RATE_LIMIT_ALLOW_SENSITIVE_MEMORY_FALLBACK = originalOverride;
    }
  });

  it('allows non-sensitive read routes to continue in degraded mode', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalOverride = process.env.RATE_LIMIT_ALLOW_SENSITIVE_MEMORY_FALLBACK;
    process.env.NODE_ENV = 'production';
    delete process.env.RATE_LIMIT_ALLOW_SENSITIVE_MEMORY_FALLBACK;

    const limiter = createRateLimiter('standard');

    const res = makeRes();
    const next = vi.fn();
    await limiter(mockReq({ path: '/public/status', method: 'GET' }), res as any, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalledWith(503);
    expect(res.headers['X-RateLimit-Remaining']).toBeDefined();

    process.env.NODE_ENV = originalNodeEnv;
    if (originalOverride === undefined) {
      delete process.env.RATE_LIMIT_ALLOW_SENSITIVE_MEMORY_FALLBACK;
    } else {
      process.env.RATE_LIMIT_ALLOW_SENSITIVE_MEMORY_FALLBACK = originalOverride;
    }
  });

  it('allows sensitive memory fallback only when explicit operator override is set', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalOverride = process.env.RATE_LIMIT_ALLOW_SENSITIVE_MEMORY_FALLBACK;
    process.env.NODE_ENV = 'production';
    process.env.RATE_LIMIT_ALLOW_SENSITIVE_MEMORY_FALLBACK = 'true';

    const limiter = createRateLimiter('standard');

    const res = makeRes();
    const next = vi.fn();
    await limiter(mockReq({ path: '/admin/users', method: 'GET' }), res as any, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalledWith(503);
    expect(res.headers['X-RateLimit-Remaining']).toBeDefined();

    process.env.NODE_ENV = originalNodeEnv;
    if (originalOverride === undefined) {
      delete process.env.RATE_LIMIT_ALLOW_SENSITIVE_MEMORY_FALLBACK;
    } else {
      process.env.RATE_LIMIT_ALLOW_SENSITIVE_MEMORY_FALLBACK = originalOverride;
    }
  });
});
