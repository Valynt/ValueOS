import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  attachCSRFFetchInterceptor,
  clearAllCSRFTokens,
  deleteCSRFCookie,
} from '../CSRFProtection';

describe('CSRF fetch interceptor', () => {
  beforeEach(() => {
    clearAllCSRFTokens();
    deleteCSRFCookie();
    vi.restoreAllMocks();
  });

  it('injects CSRF headers for mutating requests while leaving safe methods untouched', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    // @ts-expect-error override fetch for test
    global.fetch = mockFetch;

    attachCSRFFetchInterceptor();

    await fetch('/read', { method: 'GET' });
    await fetch('/write', { method: 'POST' });

    const getHeaders = new Headers(mockFetch.mock.calls[0][1]?.headers);
    const postHeaders = new Headers(mockFetch.mock.calls[1][1]?.headers);

    expect(getHeaders.has('X-CSRF-Token')).toBe(false);
    expect(postHeaders.get('X-CSRF-Token')).toBeTruthy();
  });
});
