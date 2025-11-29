import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  csrfProtectionMiddleware,
  securityHeadersMiddleware,
  sessionTimeoutMiddleware,
} from '../securityMiddleware';
import { getSecurityConfig } from '../../security/SecurityConfig';

function mockRes() {
  const headers: Record<string, string> = {};
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn((key: string, value: string) => {
      headers[key] = value;
    }),
    headers,
  };
}

describe('securityMiddlewares', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('applies security headers', () => {
    const req = {} as any;
    const res = mockRes();
    const next = vi.fn();

    securityHeadersMiddleware(req, res as any, next);

    expect(next).toHaveBeenCalled();
    const configHeaders = Object.keys(res.headers);
    expect(configHeaders.length).toBeGreaterThan(0);
  });

  it('enforces CSRF double-submit', () => {
    const res = mockRes();
    const next = vi.fn();

    const reqMissing = {
      headers: {},
      header: vi.fn(() => undefined),
    } as any;
    csrfProtectionMiddleware(reqMissing, res as any, next);
    expect(res.status).toHaveBeenCalledWith(403);

    const reqValid = {
      headers: {
        cookie: 'csrf_token=abc123',
      },
      header: vi.fn((name: string) => (name.toLowerCase() === 'x-csrf-token' ? 'abc123' : undefined)),
    } as any;
    const res2 = mockRes();
    const next2 = vi.fn();
    csrfProtectionMiddleware(reqValid, res2 as any, next2);
    expect(next2).toHaveBeenCalled();
  });

  it('enforces session idle and absolute timeouts', () => {
    const { timeout, absoluteTimeout } = getSecurityConfig().session;
    const now = Date.now();
    const baseSession = { createdAt: now - 1000, lastActivityAt: now - 1000 };

    const makeReq = (session: any) => ({ session } as any);

    const resIdle = mockRes();
    const nextIdle = vi.fn();
    const idleSession = { ...baseSession, lastActivityAt: now - (timeout + 1000) };
    sessionTimeoutMiddleware(makeReq(idleSession), resIdle as any, nextIdle);
    expect(resIdle.status).toHaveBeenCalledWith(440);

    const resAbsolute = mockRes();
    const nextAbsolute = vi.fn();
    const absoluteSession = { ...baseSession, createdAt: now - (absoluteTimeout + 1000) };
    sessionTimeoutMiddleware(makeReq(absoluteSession), resAbsolute as any, nextAbsolute);
    expect(resAbsolute.status).toHaveBeenCalledWith(440);

    const resOk = mockRes();
    const nextOk = vi.fn();
    sessionTimeoutMiddleware(makeReq(baseSession), resOk as any, nextOk);
    expect(nextOk).toHaveBeenCalled();
  });
});
