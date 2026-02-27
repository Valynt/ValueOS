import { beforeEach, describe, expect, it, vi } from 'vitest';

const logRequestEventMock = vi.fn(async () => undefined);

vi.mock('../../services/SecurityAuditService.js', () => ({
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

const { requestAuditMiddleware } = await import('../requestAuditMiddleware');

describe('requestAuditMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redacts sensitive query and route params before persisting audit events', async () => {
    const middleware = requestAuditMiddleware();

    let finishHandler: (() => void | Promise<void>) | null = null;

    const req = {
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
      headers: {
        'x-user-email': 'admin@example.com',
      },
      socket: { remoteAddress: '10.0.0.1' },
      ip: '10.0.0.1',
      tenantId: 'tenant-42',
      get: vi.fn(() => 'test-agent'),
    } as any;

    const res = {
      statusCode: 200,
      locals: {},
      setHeader: vi.fn(),
      on: vi.fn((event: string, handler: () => void | Promise<void>) => {
        if (event === 'finish') {
          finishHandler = handler;
        }
      }),
    } as any;

    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(finishHandler).not.toBeNull();

    await finishHandler?.();

    expect(logRequestEventMock).toHaveBeenCalledTimes(1);

    const loggedEvent = logRequestEventMock.mock.calls[0][0];
    expect(loggedEvent.resource).toBe('/api/customer');
    expect(loggedEvent.requestPath).toBe('/api/customer/value-case/secret-token');
    expect(loggedEvent.actor).toContain('[REDACTED');
    expect(loggedEvent.eventData.query).toEqual({
      email: expect.stringContaining('[REDACTED'),
      token: expect.stringContaining('[REDACTED'),
      page: '1',
    });
    expect(loggedEvent.eventData.routeParams).toEqual({
      token: expect.stringContaining('[REDACTED'),
    });
    expect(loggedEvent.eventData.tenantId).toBe('tenant-42');
  });
});
