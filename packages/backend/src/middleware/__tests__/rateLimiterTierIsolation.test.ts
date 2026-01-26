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

describe('rateLimiter tier isolation', () => {
  it('separates counters for different tiers even for same user', () => {
    const strictLimiter = createRateLimiter('strict', { max: 5 });
    const standardLimiter = createRateLimiter('standard', { max: 60 });

    const userReq = mockReq({ user: { id: 'user-xyz' } });

    // 1. Hit strict limiter
    const resStrict = makeRes();
    const nextStrict = vi.fn();
    strictLimiter(userReq, resStrict as any, nextStrict);

    // Strict limit is 5. Used 1. Remaining 4.
    expect(resStrict.headers['X-RateLimit-Remaining']).toBe('4');

    // 2. Hit standard limiter
    const resStandard = makeRes();
    const nextStandard = vi.fn();
    standardLimiter(userReq, resStandard as any, nextStandard);

    // Standard limit is 60. Used 1. Remaining 59.
    // If they collided, this would be 60 - 2 = 58 (if they shared the count 2).
    // Or if strict used standard's limit, it would be weird.

    // Correct behavior: Independent counters.
    expect(resStandard.headers['X-RateLimit-Remaining']).toBe('59');

    // 3. Hit strict again
    const resStrict2 = makeRes();
    strictLimiter(userReq, resStrict2 as any, nextStrict);
    // Should be 3 remaining
    expect(resStrict2.headers['X-RateLimit-Remaining']).toBe('3');
  });
});
