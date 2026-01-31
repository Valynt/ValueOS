import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { securityHeadersMiddleware } from '../securityHeaders.js';

describe('securityHeadersMiddleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function mockRes() {
    const headers: Record<string, string> = {};
    return {
      setHeader: vi.fn((key: string, value: string) => {
        headers[key] = value;
      }),
      headers,
      locals: {}
    };
  }

  it('should not crash in production mode (requires crypto import)', () => {
    process.env.NODE_ENV = 'production';

    const req = {} as any;
    const res = mockRes();
    const next = vi.fn();

    // This checks if the middleware executes without throwing "ReferenceError: crypto is not defined"
    try {
        securityHeadersMiddleware(req, res as any, next);
    } catch (e) {
        throw e;
    }

    expect(next).toHaveBeenCalled();
    expect(res.headers['Content-Security-Policy']).toBeDefined();
    // In production, it should have a nonce
    expect(res.headers['Content-Security-Policy']).toContain("'nonce-");
  });
});
