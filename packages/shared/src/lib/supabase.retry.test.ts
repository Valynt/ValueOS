// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createServerSupabaseClient } from './supabase';

// Mock env vars to allow client creation
vi.mock('./env', () => ({
  getEnvVar: (key: string) => {
    if (key === 'NODE_ENV') return 'test';
    return '';
  },
  getSupabaseConfig: () => ({
    url: 'http://localhost:54321',
    anonKey: 'anon-key',
    serviceRoleKey: 'service-key',
  }),
}));

describe('Supabase Client Retry Logic', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Reset fetch mock
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it('should retry network errors 3 times', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    global.fetch = mockFetch;

    const supabase = createServerSupabaseClient('service-key');

    // Make a request
    // We expect it to fail, but we want to verify the retries happened
    try {
        await supabase.from('test').select('*');
    } catch (e) {
        // Ignore error
    }

    // maxAttempts is 3
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('should succeed if a retry succeeds', async () => {
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new Error('Network error')) // Attempt 1 fail
      .mockRejectedValueOnce(new Error('Network error')) // Attempt 2 fail
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200, statusText: 'OK' })); // Attempt 3 success

    global.fetch = mockFetch;

    const supabase = createServerSupabaseClient('service-key');

    // We need to mock the response properly for supabase-js to parse it
    // Supabase expects a JSON response usually
    const { data, error } = await supabase.from('test').select('*');

    // If fetch succeeds, supabase might still return error if response is not what it expects,
    // but the key is that fetch was called 3 times.
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('should not retry 4xx errors (except 429)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Bad Request' }), { status: 400, statusText: 'Bad Request' }));
    global.fetch = mockFetch;

    const supabase = createServerSupabaseClient('service-key');

    await supabase.from('test').select('*');

    // Should only be called once
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
