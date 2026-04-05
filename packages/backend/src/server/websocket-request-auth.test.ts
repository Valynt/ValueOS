import { describe, expect, it } from 'vitest';

import {
  getRequestedTenantId,
  getWebSocketToken,
  parseBearerToken,
} from './websocket-request-auth.js';

describe('websocket-request-auth seams', () => {
  it('parses valid bearer token headers', () => {
    expect(parseBearerToken('Bearer abc-123')).toBe('abc-123');
    expect(parseBearerToken(['Bearer xyz'])).toBe('xyz');
  });

  it('rejects malformed bearer token headers', () => {
    expect(parseBearerToken(undefined)).toBeNull();
    expect(parseBearerToken('Basic token')).toBeNull();
    expect(parseBearerToken('Bearer   ')).toBeNull();
  });

  it('extracts websocket token from authorization header only', () => {
    const req = {
      headers: {
        authorization: 'Bearer ws-token',
      },
    } as Parameters<typeof getWebSocketToken>[0];

    expect(getWebSocketToken(req)).toBe('ws-token');
  });

  it('reads requested tenant id from supported query param aliases', () => {
    const reqWithTenantId = { url: '/ws/sdui?tenantId=tenant-a' } as Parameters<typeof getRequestedTenantId>[0];
    const reqWithTenantUnderscore = {
      url: '/ws/sdui?tenant_id=tenant-b',
    } as Parameters<typeof getRequestedTenantId>[0];
    const reqWithOrganization = {
      url: '/ws/sdui?organization_id=tenant-c',
    } as Parameters<typeof getRequestedTenantId>[0];

    expect(getRequestedTenantId(reqWithTenantId)).toBe('tenant-a');
    expect(getRequestedTenantId(reqWithTenantUnderscore)).toBe('tenant-b');
    expect(getRequestedTenantId(reqWithOrganization)).toBe('tenant-c');
  });
});
