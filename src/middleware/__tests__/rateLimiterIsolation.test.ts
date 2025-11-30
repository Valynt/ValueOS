import { describe, it, expect, vi } from 'vitest';
import { getRateLimitKey, createRateLimiter } from '../rateLimiter';

const mockReq = (overrides: any = {}) =>
  ({
    user: overrides.user || undefined,
    headers: overrides.headers || {},
    ip: overrides.ip || '1.1.1.1',
    socket: { remoteAddress: overrides.remoteAddress || '1.1.1.1' },
    path: overrides.path || '/test',
    method: overrides.method || 'GET',
  } as any);

describe('rateLimiter tenant isolation', () => {
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
    const res: any = {
      headers: {},
      setHeader: vi.fn(function (name: string, value: string) {
        this.headers[name] = value;
      }),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    // Tenant A first request
    limiter(mockReq({ headers: { 'x-tenant-id': 'org-A' } }), res, next);
    expect(res.headers['X-RateLimit-Remaining']).toBe(59);

    // Tenant B first request should not decrement Tenant A's remaining
    const resB: any = { ...res, headers: {}, setHeader: res.setHeader.bind({ headers: {} }) };
    const nextB = vi.fn();
    limiter(mockReq({ headers: { 'x-tenant-id': 'org-B' } }), resB, nextB);
    expect(resB.headers['X-RateLimit-Remaining']).toBe(59);

    // Tenant A second request decrements its own quota
    const resA2: any = { ...res, headers: {}, setHeader: res.setHeader.bind({ headers: {} }) };
    const nextA2 = vi.fn();
    limiter(mockReq({ headers: { 'x-tenant-id': 'org-A' } }), resA2, nextA2);
    expect(resA2.headers['X-RateLimit-Remaining']).toBe(58);
  });
});
