import { describe, expect, it, vi } from 'vitest';

import {
  authenticateWebSocketRequest,
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

  it('falls back to tenant query parsing when claims omit tenant id', async () => {
    const ws = {
      readyState: 1,
      close: vi.fn(),
      on: vi.fn(),
      send: vi.fn(),
    } as unknown as Parameters<typeof authenticateWebSocketRequest>[0];

    const req = {
      url: '/ws/sdui?tenantId=tenant-from-query',
      headers: { authorization: 'Bearer token-123' },
      socket: { remoteAddress: '127.0.0.1' },
    } as Parameters<typeof authenticateWebSocketRequest>[1];

    const wss = { clients: new Set() } as unknown as Parameters<
      typeof authenticateWebSocketRequest
    >[2];

    await authenticateWebSocketRequest(ws, req, wss, () => 7, {
      verifyAccessToken: async () => ({
        claims: { sub: 'user-1' },
        user: { id: 'user-1' },
      }),
      extractTenantId: () => null,
      tenantResolver: { hasTenantAccess: async () => true },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      websocketLimiter: {
        evaluateMessage: () => ({ allowed: true }),
        releaseConnection: vi.fn(),
      },
      recordDroppedFrame: vi.fn(),
      recordThrottledClient: vi.fn(),
      logSecurityEvent: vi.fn(),
      wsMaxPayloadBytes: 64_000,
      wsMaxMessagesPerSecond: 30,
      wsPolicyViolationCode: 1008,
    });

    expect((ws as { close: ReturnType<typeof vi.fn> }).close).not.toHaveBeenCalled();
    expect((ws as { tenantId?: string }).tenantId).toBe('tenant-from-query');
    expect((ws as { connectionId?: string }).connectionId).toBe(
      'tenant-from-query:7'
    );
  });
});
