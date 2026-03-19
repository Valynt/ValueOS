// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn((url: string, key: string, options?: { global?: { headers?: Record<string, string>; fetch?: typeof fetch } }) => ({
  __url: url,
  __key: key,
  __options: options,
  from: async () => ({ data: null, error: null }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

vi.mock('./env', () => ({
  getSupabaseConfig: () => ({
    url: 'https://your-project.supabase.co',
    anonKey: 'anon-key',
    serviceRoleKey: 'service-key',
  }),
}));

async function loadModule() {
  vi.resetModules();
  return import('./supabase');
}

describe('Supabase client factories', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    createClientMock.mockClear();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it('retries transient failures three times for the service-role client', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError('Network error'));
    global.fetch = mockFetch;

    const { createServiceRoleSupabaseClient } = await loadModule();
    createServiceRoleSupabaseClient();

    const fetchImpl = createClientMock.mock.calls.at(-1)?.[2]?.global?.fetch;
    expect(fetchImpl).toBeDefined();

    await expect(fetchImpl!(new Request('https://example.com'))).rejects.toThrow('Network error');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('uses the anon key plus caller token for request-scoped RLS clients', async () => {
    const { createRequestSupabaseClient } = await loadModule();

    const request = {
      headers: { authorization: 'Bearer user-token' },
      user: { id: 'user-1' },
    };

    const client = createRequestSupabaseClient(request);

    expect(client).toBeDefined();
    expect(createClientMock).toHaveBeenCalledWith(
      'https://your-project.supabase.co',
      'anon-key',
      expect.objectContaining({
        global: expect.objectContaining({
          headers: { Authorization: 'Bearer user-token' },
        }),
      }),
    );
    expect(request.supabase).toBe(client);
    expect(request.supabaseUser).toEqual({ id: 'user-1' });
  });

  it('accepts session tokens for request-scoped RLS clients', async () => {
    const { getRequestSupabaseClient } = await loadModule();

    const request = {
      session: { access_token: 'session-token' },
    };

    getRequestSupabaseClient(request);

    expect(createClientMock).toHaveBeenCalledWith(
      'https://your-project.supabase.co',
      'anon-key',
      expect.objectContaining({
        global: expect.objectContaining({
          headers: { Authorization: 'Bearer session-token' },
        }),
      }),
    );
  });

  it('refuses interactive request clients without a user token even when insecure fallback envs are set', async () => {
    process.env.ALLOW_INSECURE_ANON_SERVER_CLIENT = 'true';
    const { createRequestSupabaseClient } = await loadModule();

    expect(() => createRequestSupabaseClient({ headers: {} })).toThrow(
      'Authorization bearer token or session access token required for request-scoped Supabase client',
    );
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('refuses service-role clients when the service key is missing instead of falling back to anon', async () => {
    vi.doMock('./env', () => ({
      getSupabaseConfig: () => ({
        url: 'https://your-project.supabase.co',
        anonKey: 'anon-key',
      }),
    }));

    const { createServiceRoleSupabaseClient } = await loadModule();

    expect(() => createServiceRoleSupabaseClient()).toThrow(
      'Supabase service role key is required for server-side operations',
    );
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
