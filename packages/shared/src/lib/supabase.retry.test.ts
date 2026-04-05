// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn(
  (url: string, key: string, options?: { global?: { headers?: Record<string, string>; fetch?: typeof fetch } }) => ({
    __url: url,
    __key: key,
    __options: options,
    from: async () => ({ data: null, error: null }),
  }),
);

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

async function loadSupabaseModule() {
  vi.resetModules();
  return import('./supabase');
}

function latestClientFetchImplementation(): typeof fetch {
  const fetchImpl = createClientMock.mock.calls.at(-1)?.[2]?.global?.fetch;
  if (!fetchImpl) {
    throw new Error('Expected Supabase client to be created with a fetch implementation');
  }
  return fetchImpl;
}

describe('createServiceRoleSupabaseClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    createClientMock.mockClear();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('retries transient network failures three times before surfacing the error', async () => {
    // Arrange
    vi.useFakeTimers();
    const failingFetch = vi.fn().mockRejectedValue(new TypeError('Network error'));
    global.fetch = failingFetch;
    const { createServiceRoleSupabaseClient } = await loadSupabaseModule();

    // Act
    createServiceRoleSupabaseClient();
    const fetchWithRetry = latestClientFetchImplementation();
    const rejectionAssertion = expect(fetchWithRetry(new Request('https://example.com'))).rejects.toThrow('Network error');
    await vi.runAllTimersAsync();

    // Assert
    await rejectionAssertion;
    expect(failingFetch).toHaveBeenCalledTimes(3);
  });

  it('throws when required service-role configuration is missing', async () => {
    // Arrange
    vi.doMock('./env', () => ({
      getSupabaseConfig: () => ({
        url: 'https://your-project.supabase.co',
        anonKey: 'anon-key',
      }),
    }));
    const { createServiceRoleSupabaseClient } = await loadSupabaseModule();

    // Act + Assert
    expect(() => createServiceRoleSupabaseClient()).toThrow(/Missing required Supabase runtime configuration/);
    expect(createClientMock).not.toHaveBeenCalled();
  });
});

describe('createRequestSupabaseClient', () => {
  beforeEach(() => {
    createClientMock.mockClear();
  });

  afterEach(() => {
    delete process.env.ALLOW_INSECURE_ANON_SERVER_CLIENT;
    vi.clearAllMocks();
  });

  it('creates an RLS client using the bearer token and decorates the request object', async () => {
    // Arrange
    const { createRequestSupabaseClient } = await loadSupabaseModule();
    const request = {
      headers: { authorization: 'Bearer user-token' },
      user: { id: 'user-1' },
    };

    // Act
    const client = createRequestSupabaseClient(request);

    // Assert
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

  it('accepts a session access token when no authorization header is provided', async () => {
    // Arrange
    const { getRequestSupabaseClient } = await loadSupabaseModule();
    const request = {
      session: { access_token: 'session-token' },
    };

    // Act
    getRequestSupabaseClient(request);

    // Assert
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

  it('rejects requests that do not provide a user token', async () => {
    // Arrange
    const { createRequestSupabaseClient } = await loadSupabaseModule();

    // Act + Assert
    expect(() => createRequestSupabaseClient({ headers: {} })).toThrow(
      'Authorization bearer token or session access token required for request-scoped Supabase client',
    );
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
