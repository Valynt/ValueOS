import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RateLimitKeyService } from '../RateLimitKeyService.js'

describe('RateLimitKeyService', () => {
  const options = { service: 'api', tier: 'standard' };

  // TRUSTED_PROXY_COUNT is baked in at module load time via a static field
  // initialiser. Tests use socket.remoteAddress (the default path when
  // TRUSTED_PROXY_COUNT=0) rather than req.ip.

  it('ignores spoofed tenant header when service identity is not verified', () => {
    const req = {
      headers: { 'x-tenant-id': 'tenant-spoof' },
      socket: { remoteAddress: '10.0.0.1' },
    } as any;

    const key = RateLimitKeyService.generateKey(req, options);

    expect(key).toBe('rl:api:standard:10.0.0.1');
  });

  it('prefers explicit request tenantId over internal header', () => {
    const req = {
      headers: { 'x-tenant-id': 'tenant-header' },
      tenantId: 'tenant-preferred',
      serviceIdentityVerified: true,
      socket: { remoteAddress: '10.0.0.2' },
    } as any;

    const key = RateLimitKeyService.generateKey(req, options);

    expect(key).toBe('rl:api:standard:tenant-preferred:10.0.0.2');
  });

  it('uses tenant header for verified internal service requests', () => {
    const req = {
      headers: { 'x-tenant-id': 'tenant-internal' },
      serviceIdentityVerified: true,
      socket: { remoteAddress: '10.0.0.3' },
    } as any;

    const key = RateLimitKeyService.generateKey(req, options);

    expect(key).toBe('rl:api:standard:tenant-internal:10.0.0.3');
  });

  describe('IP spoofing prevention (TRUSTED_PROXY_COUNT=0 default)', () => {
    it('ignores X-Forwarded-For when no trusted proxy is configured', () => {
      const req = {
        headers: { 'x-forwarded-for': '1.2.3.4' },
        socket: { remoteAddress: '10.0.0.5' },
      } as any;

      const key = RateLimitKeyService.generateKey(req, options);

      // Must use socket address, not the spoofed forwarded header
      expect(key).toContain('10.0.0.5');
      expect(key).not.toContain('1.2.3.4');
    });

    it('ignores X-Real-IP when no trusted proxy is configured', () => {
      const req = {
        headers: { 'x-real-ip': '5.6.7.8' },
        socket: { remoteAddress: '10.0.0.6' },
      } as any;

      const key = RateLimitKeyService.generateKey(req, options);

      expect(key).toContain('10.0.0.6');
      expect(key).not.toContain('5.6.7.8');
    });

    it('uses context.ip when explicitly provided (internal/test override)', () => {
      const req = {
        headers: { 'x-forwarded-for': '1.2.3.4' },
        socket: { remoteAddress: '10.0.0.7' },
      } as any;

      const key = RateLimitKeyService.generateKey(req, options, { ip: '9.9.9.9' });

      expect(key).toContain('9.9.9.9');
    });
  });

  describe('IP extraction with TRUSTED_PROXY_COUNT > 0', () => {
    beforeEach(() => {
      vi.stubEnv('TRUSTED_PROXY_COUNT', '1');
    });
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('uses the client IP from X-Forwarded-For (single proxy hop)', () => {
      // XFF: client → proxy appends its view → header = "client, proxy-egress"
      // With 1 trusted proxy, idx = 2 - 1 - 1 = 0 → first entry is the client.
      const req = {
        headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
        socket: { remoteAddress: '10.0.0.1' },
      } as any;

      const key = RateLimitKeyService.generateKey(req, options);

      expect(key).toContain('203.0.113.5');
      expect(key).not.toContain('10.0.0.1');
    });

    it('uses X-Real-IP when X-Forwarded-For is absent and proxy count is 1', () => {
      const req = {
        headers: { 'x-real-ip': '203.0.113.9' },
        socket: { remoteAddress: '10.0.0.2' },
      } as any;

      const key = RateLimitKeyService.generateKey(req, options);

      expect(key).toContain('203.0.113.9');
    });

    it('falls back to socket address when XFF has fewer entries than trusted hops', () => {
      // With TRUSTED_PROXY_COUNT=1 but an empty XFF, idx would be -1 → fall back.
      const req = {
        headers: {},
        socket: { remoteAddress: '10.0.0.3' },
      } as any;

      const key = RateLimitKeyService.generateKey(req, options);

      expect(key).toContain('10.0.0.3');
    });

    it('handles array-valued X-Forwarded-For header', () => {
      const req = {
        headers: { 'x-forwarded-for': ['203.0.113.7, 10.0.0.4'] },
        socket: { remoteAddress: '10.0.0.4' },
      } as any;

      const key = RateLimitKeyService.generateKey(req, options);

      expect(key).toContain('203.0.113.7');
    });
  });

  describe('IP extraction with TRUSTED_PROXY_COUNT = 2', () => {
    beforeEach(() => {
      vi.stubEnv('TRUSTED_PROXY_COUNT', '2');
    });
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('selects the correct client IP when two proxy hops are trusted', () => {
      // XFF: "client, internal-lb, edge-proxy" — 2 trusted hops → idx = 3-2-1 = 0
      const req = {
        headers: { 'x-forwarded-for': '203.0.113.1, 10.1.0.1, 10.2.0.1' },
        socket: { remoteAddress: '10.2.0.1' },
      } as any;

      const key = RateLimitKeyService.generateKey(req, options);

      expect(key).toContain('203.0.113.1');
    });

    it('does NOT use X-Real-IP when proxy count is 2', () => {
      // X-Real-IP is only trusted when TRUSTED_PROXY_COUNT === 1.
      const req = {
        headers: { 'x-real-ip': '203.0.113.99' },
        socket: { remoteAddress: '10.0.0.5' },
      } as any;

      const key = RateLimitKeyService.generateKey(req, options);

      // Falls back to socket, not X-Real-IP
      expect(key).toContain('10.0.0.5');
      expect(key).not.toContain('203.0.113.99');
    });
  });
});
