import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { extractCustomerAccessToken } from '../tokenTransport.js';

function buildRequest(input: {
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}): Request {
  return {
    params: input.params ?? {},
    query: input.query ?? {},
    body: input.body ?? {},
    header: vi.fn((name: string) => input.headers?.[name.toLowerCase()]),
  } as unknown as Request;
}

describe('extractCustomerAccessToken', () => {
  it('rejects path token transport', () => {
    const req = buildRequest({ params: { token: 'path-token' } });
    expect(extractCustomerAccessToken(req)).toEqual({ token: null, error: 'url_path_token_not_allowed' });
  });

  it('rejects query token transport', () => {
    const req = buildRequest({ query: { token: 'query-token' } });
    expect(extractCustomerAccessToken(req)).toEqual({ token: null, error: 'query_token_not_allowed' });
  });

  it('accepts header token transport', () => {
    const req = buildRequest({ headers: { 'x-customer-access-token': 'header-token' } });
    expect(extractCustomerAccessToken(req)).toEqual({ token: 'header-token', error: null });
  });

  it('accepts body token transport', () => {
    const req = buildRequest({ body: { token: 'body-token' } });
    expect(extractCustomerAccessToken(req)).toEqual({ token: 'body-token', error: null });
  });
});
