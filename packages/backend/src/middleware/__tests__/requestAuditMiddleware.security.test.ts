import { beforeEach, describe, expect, it, vi } from 'vitest';

const { logRequestEventMock } = vi.hoisted(() => {
  return { logRequestEventMock: vi.fn(async () => undefined) };
});

vi.mock('../../services/security/SecurityAuditService.js', () => ({
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

// We need to import after mocking
import { requestAuditMiddleware } from '../requestAuditMiddleware';

describe('requestAuditMiddleware Security Reproduction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails to redact otp in query params', async () => {
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
      headers: {},
      socket: { remoteAddress: '10.0.0.1' },
      ip: '10.0.0.1',
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

    const loggedEvent = logRequestEventMock.mock.calls[0][0];

    // This expects the OTP to be redacted, so if it's NOT redacted (which is the current state),
    // the value will be '123456' and expect.stringContaining('[REDACTED') will fail.
    // Wait, I want to assert that it IS redacted, and demonstrate that it fails currently.
    expect(loggedEvent.eventData.query).toEqual({
      otp: expect.stringContaining('[REDACTED'),
    });
  });

  it('fails to redact Bearer tokens in query params with non-sensitive keys', async () => {
    const middleware = requestAuditMiddleware();
    let finishHandler: (() => void | Promise<void>) | null = null;

    const req = {
      method: 'GET',
      baseUrl: '/api/resource',
      originalUrl: '/api/resource',
      path: '/api/resource',
      query: {
        payload: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
      },
      params: {},
      headers: {},
      socket: { remoteAddress: '10.0.0.1' },
      ip: '10.0.0.1',
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
    await finishHandler?.();

    const loggedEvent = logRequestEventMock.mock.calls[0][0];

    expect(loggedEvent.eventData.query).toEqual({
      payload: expect.stringContaining('[REDACTED'),
    });
  });
});
