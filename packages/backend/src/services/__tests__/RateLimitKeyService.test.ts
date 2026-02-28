import { describe, expect, it } from 'vitest';

import { RateLimitKeyService } from '../RateLimitKeyService.js'

describe('RateLimitKeyService', () => {
  const options = { service: 'api', tier: 'standard' };

  it('ignores spoofed tenant header when service identity is not verified', () => {
    const req = {
      headers: { 'x-tenant-id': 'tenant-spoof' },
      ip: '10.0.0.1',
    } as any;

    const key = RateLimitKeyService.generateKey(req, options);

    expect(key).toBe('rl:api:standard:10.0.0.1');
  });

  it('prefers explicit request tenantId over internal header', () => {
    const req = {
      headers: { 'x-tenant-id': 'tenant-header' },
      tenantId: 'tenant-preferred',
      serviceIdentityVerified: true,
      ip: '10.0.0.2',
    } as any;

    const key = RateLimitKeyService.generateKey(req, options);

    expect(key).toBe('rl:api:standard:tenant-preferred:10.0.0.2');
  });

  it('uses tenant header for verified internal service requests', () => {
    const req = {
      headers: { 'x-tenant-id': 'tenant-internal' },
      serviceIdentityVerified: true,
      ip: '10.0.0.3',
    } as any;

    const key = RateLimitKeyService.generateKey(req, options);

    expect(key).toBe('rl:api:standard:tenant-internal:10.0.0.3');
  });
});
