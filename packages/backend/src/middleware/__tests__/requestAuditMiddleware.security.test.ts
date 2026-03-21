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

import { requestAuditMiddleware } from '../requestAuditMiddleware';

describe('requestAuditMiddleware security coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redacts otp values in query params', async () => {
    const middleware = requestAuditMiddleware();
    let finishHandler: (() => void | Promise<void>) | null = null;

    const req = {
      method: 'GET',
      baseUrl: '/api/verify',
      originalUrl: '/api/verify?otp=123456',
      path: '/api/verify',
      query: {
        otp: '123456',
      },
      params: {},
      headers: {},
      socket: { remoteAddress: '10.0.0.1' },
      ip: '10.0.0.1',
      get: vi.fn(() => 'test-agent'),
    };

    const res = {
      statusCode: 200,
      locals: {},
      setHeader: vi.fn(),
      on: vi.fn((event: string, handler: () => void | Promise<void>) => {
        if (event === 'finish') {
          finishHandler = handler;
        }
      }),
    };

    middleware(req as never, res as never, vi.fn());
    await finishHandler?.();

    const loggedEvent = logRequestEventMock.mock.calls[0][0];
    expect(loggedEvent.eventData.query).toEqual({
      otp: expect.stringContaining('[REDACTED'),
    });
  });

  it('redacts bearer tokens in query params with non-sensitive keys', async () => {
    const middleware = requestAuditMiddleware();
    let finishHandler: (() => void | Promise<void>) | null = null;

    const req = {
      method: 'GET',
      baseUrl: '/api/resource',
      originalUrl: '/api/resource',
      path: '/api/resource',
      query: {
        payload: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature',
      },
      params: {},
      headers: {},
      socket: { remoteAddress: '10.0.0.1' },
      ip: '10.0.0.1',
      get: vi.fn(() => 'test-agent'),
    };

    const res = {
      statusCode: 200,
      locals: {},
      setHeader: vi.fn(),
      on: vi.fn((event: string, handler: () => void | Promise<void>) => {
        if (event === 'finish') {
          finishHandler = handler;
        }
      }),
    };

    middleware(req as never, res as never, vi.fn());
    await finishHandler?.();

    const loggedEvent = logRequestEventMock.mock.calls[0][0];
    expect(loggedEvent.eventData.query).toEqual({
      payload: expect.stringContaining('[REDACTED'),
    });
  });
});
