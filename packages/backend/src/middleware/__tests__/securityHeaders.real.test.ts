import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cspNonceMiddleware, securityHeadersMiddleware } from '../securityHeaders';

function mockRes() {
  const headers: Record<string, string> = {};
  return {
    locals: {},
    setHeader: vi.fn((key: string, value: string) => {
      headers[key] = value;
    }),
    headers,
  };
}

describe('securityHeadersMiddleware (production)', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('generates CSP nonce without crashing', () => {
    process.env.NODE_ENV = 'production';

    const req = {} as any;
    const res = mockRes();
    const next = vi.fn();

    const nonceNext = vi.fn();

    expect(() => cspNonceMiddleware(req, res as any, nonceNext)).not.toThrow();
    expect(() => securityHeadersMiddleware(req, res as any, next)).not.toThrow();
    expect(nonceNext).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
    expect(res.locals.cspNonce).toBeDefined();
    expect(res.headers['Content-Security-Policy']).toContain(`'nonce-${res.locals.cspNonce}'`);
  });
});
