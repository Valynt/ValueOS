import { beforeEach, describe, expect, it, vi } from 'vitest';

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

  it('injects X-CSRF-Token for fetch(new Request("/write", { method: "POST" }))', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    // @ts-expect-error override fetch for test
    global.fetch = mockFetch;

    attachCSRFFetchInterceptor();

    // eslint-disable-next-line no-restricted-globals
    await fetch(new Request(new URL('/write', window.location.origin), { method: 'POST' }));

    const requestInit = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = new Headers(requestInit?.headers);

    expect(headers.get('X-CSRF-Token')).toBeTruthy();
  });

  it('does not inject X-CSRF-Token for fetch(new Request("/read", { method: "GET" }))', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    // @ts-expect-error override fetch for test
    global.fetch = mockFetch;

    attachCSRFFetchInterceptor();

    // eslint-disable-next-line no-restricted-globals
    await fetch(new Request(new URL('/read', window.location.origin), { method: 'GET' }));

    const requestInit = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = new Headers(requestInit?.headers);

    expect(headers.has('X-CSRF-Token')).toBe(false);
  });

  it('treats init.method as authoritative over Request.method', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    // @ts-expect-error override fetch for test
    global.fetch = mockFetch;

    attachCSRFFetchInterceptor();

    // eslint-disable-next-line no-restricted-globals
    await fetch(new Request(new URL('/write', window.location.origin), { method: 'POST' }), { method: 'GET' });

    const requestInit = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = new Headers(requestInit?.headers);

    expect(headers.has('X-CSRF-Token')).toBe(false);
  });
});
