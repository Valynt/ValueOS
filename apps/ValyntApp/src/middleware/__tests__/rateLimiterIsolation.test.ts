import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRateLimiter, getRateLimitKey } from '../rateLimiter';

const mockReq = (overrides: any = {}) => {
  const headers = overrides.headers || {};
  return {
    user: overrides.user || undefined,
    headers,
    header: (name: string) => headers[name.toLowerCase()],
    get: (name: string) => headers[name.toLowerCase()],
    tenantId: overrides.tenantId,
    serviceIdentityVerified: overrides.serviceIdentityVerified,
    ip: overrides.ip || '1.1.1.1',
    socket: { remoteAddress: overrides.remoteAddress || '1.1.1.1' },
    path: overrides.path || '/test',
    method: overrides.method || 'GET',
  } as any;
};

describe('rateLimiter tenant isolation', () => {
  // Reset rate limiter state between tests
  beforeEach(() => {
    // Tests are using real timers
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('keys by tenant + user when both are present', () => {
    const key = getRateLimitKey(
      mockReq({
        user: { id: 'user-1', organizationId: 'org-1' },
        tenantId: 'org-1',
      })
    );
    expect(key).toBe('tenant:org-1:user:user-1');
  });

  it('keys by tenant + ip when tenant present and user missing', () => {
    const key = getRateLimitKey(
      mockReq({
        tenantId: 'org-2',
      })
    );
    expect(key).toBe('tenant:org-2:ip:1.1.1.1');
  });

  it('keys by ip when neither tenant nor user are present', () => {
    const key = getRateLimitKey(mockReq());
    expect(key).toBe('ip:1.1.1.1');
  });


  it('ignores forged x-tenant-id for external traffic', () => {
    const key = getRateLimitKey(
      mockReq({
        headers: { 'x-tenant-id': 'forged-tenant' },
        ip: '9.9.9.9',
      })
    );
    expect(key).toBe('ip:9.9.9.9');
  });

  it('uses x-tenant-id only for verified service identity traffic', () => {
    const key = getRateLimitKey(
      mockReq({
        headers: { 'x-tenant-id': 'service-tenant' },
        serviceIdentityVerified: true,
        ip: '9.9.9.9',
      })
    );
    expect(key).toBe('tenant:service-tenant:ip:9.9.9.9');
  });


  it('ignores forged x-forwarded-for for external traffic keying', () => {
    const key = getRateLimitKey(
      mockReq({
        headers: { 'x-forwarded-for': '203.0.113.10' },
        ip: '198.51.100.7',
      })
    );
    expect(key).toBe('ip:198.51.100.7');
  });

  it('enforces limits per tenant boundary', async () => {
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
    await limiter(mockReq({ tenantId: 'org-A' }), resA1 as any, nextA1);
    expect(resA1.headers['X-RateLimit-Remaining']).toBe('59');

    // Tenant B first request should not decrement Tenant A's remaining
    const resB1 = makeRes();
    const nextB1 = vi.fn();
    await limiter(mockReq({ tenantId: 'org-B' }), resB1 as any, nextB1);
    expect(resB1.headers['X-RateLimit-Remaining']).toBe('59');

    // Tenant A second request decrements its own quota
    const resA2 = makeRes();
    const nextA2 = vi.fn();
    await limiter(mockReq({ tenantId: 'org-A' }), resA2 as any, nextA2);
    expect(resA2.headers['X-RateLimit-Remaining']).toBe('58');
  });
});
