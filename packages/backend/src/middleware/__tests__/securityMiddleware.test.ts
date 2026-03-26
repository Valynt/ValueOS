import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cspNonceMiddleware,
  csrfProtectionMiddleware,
  issueCsrfTokenForBinding,
  securityHeadersMiddleware,
} from '../securityMiddleware';

vi.mock("../../lib/supabase.js");

function mockRes() {
  const headers: Record<string, string | string[]> = {};
  return {
    locals: {},
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn((key: string, value: string | string[]) => {
      headers[key] = value;
    }),
    getHeader: vi.fn((key: string) => headers[key]),
    headers,
  };
}

function csrfCookieValueFromSetCookie(setCookie: string | string[]): string {
  const cookieHeader = Array.isArray(setCookie) ? setCookie[setCookie.length - 1] : setCookie;
  const tokenPart = cookieHeader.split(';', 1)[0];
  return tokenPart.split('=', 2)[1] ?? '';
}

describe('securityMiddlewares', () => {
  beforeEach(() => {
    vi.useRealTimers();
    process.env.TCT_SECRET = 'test-csrf-secret';
    delete process.env.CSRF_SECRET;
  });

  it('applies strict CSP headers with nonce and no unsafe-inline script policy', () => {
    const req = {} as any;
    const res = mockRes();
    const nonceNext = vi.fn();
    const next = vi.fn();

    cspNonceMiddleware(req, res as any, nonceNext);
    securityHeadersMiddleware(req, res as any, next);

    expect(nonceNext).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
    const csp = res.headers['Content-Security-Policy'];
    expect(csp).toContain("script-src 'self' 'nonce-");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  it('rejects tampered CSRF token payloads', () => {
    const resForToken = mockRes();
    const token = issueCsrfTokenForBinding(resForToken as any, { userId: 'user-1', sessionId: 'session-1' });
    const tampered = `${token.slice(0, -1)}x`;

    const req = {
      method: 'POST',
      sessionId: 'session-1',
      user: { id: 'user-1' },
      headers: {
        cookie: `csrf_token=${tampered}`,
      },
      header: vi.fn((name: string) => (name.toLowerCase() === 'x-csrf-token' ? tampered : undefined)),
    } as any;

    const res = mockRes();
    const next = vi.fn();

    csrfProtectionMiddleware(req, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rejects stale CSRF tokens based on issuance timestamp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-26T00:00:00.000Z'));

    const resForToken = mockRes();
    const token = issueCsrfTokenForBinding(resForToken as any, { userId: 'user-1' });

    vi.setSystemTime(new Date('2026-03-26T02:00:00.000Z'));

    const req = {
      method: 'POST',
      user: { id: 'user-1' },
      headers: {
        cookie: `csrf_token=${token}`,
      },
      header: vi.fn((name: string) => (name.toLowerCase() === 'x-csrf-token' ? token : undefined)),
    } as any;

    const res = mockRes();
    const next = vi.fn();

    csrfProtectionMiddleware(req, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rejects cross-session CSRF token reuse', () => {
    const resForToken = mockRes();
    const token = issueCsrfTokenForBinding(resForToken as any, { userId: 'user-1', sessionId: 'session-1' });

    const req = {
      method: 'POST',
      sessionId: 'session-2',
      user: { id: 'user-1' },
      headers: {
        cookie: `csrf_token=${token}`,
      },
      header: vi.fn((name: string) => (name.toLowerCase() === 'x-csrf-token' ? token : undefined)),
    } as any;

    const res = mockRes();
    const next = vi.fn();

    csrfProtectionMiddleware(req, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rejects replay attempts after token rotation', () => {
    const oldTokenRes = mockRes();
    const oldToken = issueCsrfTokenForBinding(oldTokenRes as any, { userId: 'user-1' });

    const newTokenRes = mockRes();
    issueCsrfTokenForBinding(newTokenRes as any, { userId: 'user-1' });
    const rotatedToken = csrfCookieValueFromSetCookie(newTokenRes.headers['Set-Cookie'] as string | string[]);

    const req = {
      method: 'POST',
      user: { id: 'user-1' },
      headers: {
        cookie: `csrf_token=${rotatedToken}`,
      },
      header: vi.fn((name: string) => (name.toLowerCase() === 'x-csrf-token' ? oldToken : undefined)),
    } as any;

    const res = mockRes();
    const next = vi.fn();

    csrfProtectionMiddleware(req, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('accepts a valid signed CSRF token', () => {
    const resForToken = mockRes();
    const token = issueCsrfTokenForBinding(resForToken as any, { userId: 'user-1', sessionId: 'session-1' });

    const req = {
      method: 'POST',
      sessionId: 'session-1',
      user: { id: 'user-1' },
      headers: {
        cookie: `csrf_token=${token}`,
      },
      header: vi.fn((name: string) => (name.toLowerCase() === 'x-csrf-token' ? token : undefined)),
    } as any;

    const res = mockRes();
    const next = vi.fn();

    csrfProtectionMiddleware(req, res as any, next);

    expect(next).toHaveBeenCalled();
  });
});
