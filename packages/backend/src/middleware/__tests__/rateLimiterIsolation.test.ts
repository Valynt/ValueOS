import { afterEach, describe, expect, it, vi } from 'vitest';

import { getRateLimitKey } from '../rateLimiter.js';

const mockReq = (overrides: {
  user?: { id: string; organizationId?: string };
  tenantId?: string;
  ip?: string;
} = {}) => {
  const headers: Record<string, string> = {};
  return {
    user: overrides.user,
    headers,
    header: (name: string) => headers[name.toLowerCase()],
    get: (name: string) => headers[name.toLowerCase()],
    tenantId: overrides.tenantId,
    ip: overrides.ip ?? '1.1.1.1',
    socket: { remoteAddress: overrides.ip ?? '1.1.1.1' },
    path: '/test',
    method: 'GET',
  } as any;
};

afterEach(() => {
  vi.useRealTimers();
});

describe('getRateLimitKey', () => {
  it('includes tenant and user when both are present', () => {
    const key = getRateLimitKey(
      mockReq({ user: { id: 'user-1' }, tenantId: 'org-1' })
    );
    // Key must contain both identifiers so requests from different tenants
    // or different users within the same tenant are counted separately.
    expect(key).toContain('org-1');
    expect(key).toContain('user-1');
  });

  it('includes tenant and ip when tenant is present but user is absent', () => {
    const key = getRateLimitKey(mockReq({ tenantId: 'org-2' }));
    expect(key).toContain('org-2');
    expect(key).toContain('1.1.1.1');
  });

  it('falls back to ip-only when neither tenant nor user are present', () => {
    const key = getRateLimitKey(mockReq());
    expect(key).toContain('1.1.1.1');
    // Must not contain a tenant segment that could cause cross-tenant collision
    expect(key).not.toContain('org-');
  });

  it('produces different keys for different tenants with the same user id', () => {
    const keyA = getRateLimitKey(mockReq({ user: { id: 'user-1' }, tenantId: 'org-A' }));
    const keyB = getRateLimitKey(mockReq({ user: { id: 'user-1' }, tenantId: 'org-B' }));
    expect(keyA).not.toBe(keyB);
  });

  it('produces different keys for different users within the same tenant', () => {
    const keyA = getRateLimitKey(mockReq({ user: { id: 'user-1' }, tenantId: 'org-1' }));
    const keyB = getRateLimitKey(mockReq({ user: { id: 'user-2' }, tenantId: 'org-1' }));
    expect(keyA).not.toBe(keyB);
  });

  it('produces different keys for different ips when no tenant is present', () => {
    const keyA = getRateLimitKey(mockReq({ ip: '10.0.0.1' }));
    const keyB = getRateLimitKey(mockReq({ ip: '10.0.0.2' }));
    expect(keyA).not.toBe(keyB);
  });
});
