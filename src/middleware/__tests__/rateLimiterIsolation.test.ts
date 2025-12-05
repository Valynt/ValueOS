import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getRateLimitKey, createRateLimiter } from '../rateLimiter';

const mockReq = (overrides: any = {}) => {
  const headers = overrides.headers || {};
  return {
    user: overrides.user || undefined,
    headers,
    header: (name: string) => headers[name.toLowerCase()],
    get: (name: string) => headers[name.toLowerCase()],
    ip: overrides.ip || '1.1.1.1',
    socket: { remoteAddress: overrides.remoteAddress || '1.1.1.1' },
    path: overrides.path || '/test',
    method: overrides.method || 'GET',
  } as any;
};

describe('rateLimiter tenant isolation', () => {
  // Reset rate limiter state between tests
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('keys by tenant + user when both are present', () => {
    const key = getRateLimitKey(
      mockReq({
        user: { id: 'user-1', organizationId: 'org-1' },
      })
    );
    expect(key).toBe('tenant:org-1:user:user-1');
  });

  it('keys by tenant + ip when tenant header present and user missing', () => {
    const key = getRateLimitKey(
      mockReq({
        headers: { 'x-tenant-id': 'org-2' },
      })
    );
    expect(key).toBe('tenant:org-2:ip:1.1.1.1');
  });

  it('keys by ip when neither tenant nor user are present', () => {
    const key = getRateLimitKey(mockReq());
    expect(key).toBe('ip:1.1.1.1');
  });

  it('enforces limits per tenant boundary', () => {
    const limiter = createRateLimiter('standard');
    
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

    // Tenant A first request
    const resA1 = makeRes();
    const nextA1 = vi.fn();
    limiter(mockReq({ headers: { 'x-tenant-id': 'org-A' } }), resA1 as any, nextA1);
    expect(resA1.headers['X-RateLimit-Remaining']).toBe('59');

    // Tenant B first request should not decrement Tenant A's remaining
    const resB1 = makeRes();
    const nextB1 = vi.fn();
    limiter(mockReq({ headers: { 'x-tenant-id': 'org-B' } }), resB1 as any, nextB1);
    expect(resB1.headers['X-RateLimit-Remaining']).toBe('59');

    // Tenant A second request decrements its own quota
    const resA2 = makeRes();
    const nextA2 = vi.fn();
    limiter(mockReq({ headers: { 'x-tenant-id': 'org-A' } }), resA2 as any, nextA2);
    expect(resA2.headers['X-RateLimit-Remaining']).toBe('58');
  });
});
