import { beforeEach, describe, expect, it, vi } from 'vitest';

const { logRequestEventMock } = vi.hoisted(() => ({
  logRequestEventMock: vi.fn(async () => undefined),
}));

vi.mock('../../services/post-v1/SecurityAuditService.js', () => ({
  securityAuditService: {
    logRequestEvent: logRequestEventMock,
  },
}));

vi.mock('../../config/telemetry.js', () => ({
  getTraceContextForLogging: () => ({}),
}));

vi.mock('@shared/lib/context', () => ({
  runWithContext: (_ctx: unknown, callback: () => void) => callback(),
}));

const { emitRequestAuditEvent, requestAuditMiddleware } = await import('../requestAuditMiddleware');

type FinishHandler = (() => void | Promise<void>) | null;

function buildReq(overrides: Record<string, unknown> = {}) {
  return {
    method: 'GET',
    baseUrl: '/api/customer',
    originalUrl: '/api/customer/value-case/secret-token?email=user@example.com&token=abc123',
    path: '/api/customer/value-case/secret-token',
    query: {
      email: 'user@example.com',
      token: 'abc123',
      page: '1',
    },
    params: {
      token: 'secret-token',
    },
    headers: {},
    socket: { remoteAddress: '10.0.0.1' },
    ip: '10.0.0.1',
    tenantId: 'tenant-42',
    organizationId: 'org-42',
    get: vi.fn(() => 'test-agent'),
    ...overrides,
  };
}

function buildRes(onFinish?: (handler: () => void | Promise<void>) => void) {
  return {
    statusCode: 200,
    locals: {},
    setHeader: vi.fn(),
    on: vi.fn((event: string, handler: () => void | Promise<void>) => {
      if (event === 'finish') {
        onFinish?.(handler);
      }
    }),
  };
}

describe('requestAuditMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redacts sensitive query and route params before persisting audit events', async () => {
    const middleware = requestAuditMiddleware();

    let finishHandler: FinishHandler = null;
    const req = buildReq({
      headers: {
        'x-user-email': 'admin@example.com',
      },
    });
    const res = buildRes((handler) => {
      finishHandler = handler;
    });
    const next = vi.fn();

    middleware(req as never, res as never, next);

    expect(next).toHaveBeenCalled();
    expect(finishHandler).not.toBeNull();

    await finishHandler?.();

    expect(logRequestEventMock).toHaveBeenCalledTimes(1);

    const loggedEvent = logRequestEventMock.mock.calls[0][0];
    expect(loggedEvent.resource).toBe('/api/customer');
    expect(loggedEvent.action).toBe('get');
    expect(loggedEvent.requestPath).toBe('/api/customer/value-case/secret-token');
    expect(loggedEvent.actor).toBe('anonymous');
    expect(loggedEvent.eventData.query).toEqual({
      email: expect.stringContaining('[REDACTED'),
      token: expect.stringContaining('[REDACTED'),
      page: '1',
    });
    expect(loggedEvent.eventData.routeParams).toEqual({
      token: expect.stringContaining('[REDACTED'),
    });
    expect(loggedEvent.eventData.org).toBe('org-42');
    expect(loggedEvent.eventData.tenantId).toBe('tenant-42');
  });

  it('ignores forged x-organization-id headers when trusted request context is present', async () => {
    const middleware = requestAuditMiddleware();

    let finishHandler: FinishHandler = null;
    const req = buildReq({
      headers: {
        'x-organization-id': 'forged-org',
      },
      tenantId: 'trusted-tenant',
      organizationId: 'trusted-org',
      user: {
        id: 'user-123',
        tenant_id: 'claim-tenant',
        organization_id: 'claim-org',
        email: 'owner@example.com',
      },
    });
    const res = buildRes((handler) => {
      finishHandler = handler;
    });

    middleware(req as never, res as never, vi.fn());
    await finishHandler?.();

    const loggedEvent = logRequestEventMock.mock.calls[0][0];
    expect(loggedEvent.actor).toBe('[REDACTED]');
    expect(loggedEvent.eventData.org).toBe('trusted-org');
    expect(loggedEvent.eventData.tenantId).toBe('trusted-tenant');
    expect(loggedEvent.eventData.org).not.toBe('forged-org');
    expect(loggedEvent.eventData.tenantId).not.toBe('forged-org');
  });

  it('uses trusted request properties for emitted audit events even when a forged header is present', async () => {
    const req = buildReq({
      method: 'POST',
      path: '/api/admin/provision',
      originalUrl: '/api/admin/provision',
      headers: {
        'x-organization-id': 'forged-org',
      },
      tenantId: 'trusted-tenant',
      organizationId: 'trusted-org',
      user: {
        id: 'user-456',
        tenant_id: 'claim-tenant',
        organization_id: 'claim-org',
        email: 'admin@example.com',
      },
    });
    const res = {
      statusCode: 202,
      locals: {
        requestId: 'request-123',
      },
    };

    await emitRequestAuditEvent(
      req as never,
      res as never,
      'create',
      'admin.provision',
      { feature: 'tenant-provisioning' },
    );

    expect(logRequestEventMock).toHaveBeenCalledTimes(1);
    const loggedEvent = logRequestEventMock.mock.calls[0][0];
    expect(loggedEvent.requestId).toBe('request-123');
    expect(loggedEvent.actor).toBe('[REDACTED]');
    expect(loggedEvent.eventData.org).toBe('trusted-org');
    expect(loggedEvent.eventData.tenantId).toBe('trusted-tenant');
    expect(loggedEvent.eventData.feature).toBe('tenant-provisioning');
  });
});
