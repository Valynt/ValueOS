import { beforeEach, describe, expect, it, vi } from 'vitest';

import {

vi.mock("../../lib/supabase.js");
  cspNonceMiddleware,
  csrfProtectionMiddleware,
  securityHeadersMiddleware,
} from '../securityMiddleware';

function mockRes() {
  const headers: Record<string, string> = {};
  return {
    locals: {},
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


});
