// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientSpy = vi.fn(() => ({ mocked: true }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientSpy,
}));

vi.mock('./env', () => ({
  getSupabaseConfig: () => ({
    url: 'https://valueos.supabase.co',
    anonKey: 'anon-key',
    serviceRoleKey: '',
  }),
}));

describe('Supabase auth guard behavior', () => {
  beforeEach(() => {
    createClientSpy.mockClear();
    delete process.env.ALLOW_INSECURE_ANON_SERVER_CLIENT;
  });

  it.each([
    {
      caseName: 'authorization header is missing',
      request: { headers: {} },
    },
    {
      caseName: 'authorization header has an empty bearer token',
      request: { headers: { authorization: 'Bearer   ' } },
    },
  ])('rejects request-scoped client creation when $caseName', async ({ request }) => {
    // Arrange
    const { createRequestSupabaseClient } = await import('./supabase');

    // Act + Assert
    expect(() => createRequestSupabaseClient(request)).toThrow(
      /Authorization bearer token or session access token required for request-scoped Supabase client/,
    );
    expect(createClientSpy).not.toHaveBeenCalled();
  });

  it('rejects service-role client creation when service credentials are unavailable', async () => {
    // Arrange
    process.env.ALLOW_INSECURE_ANON_SERVER_CLIENT = 'true';
    const { createServiceRoleSupabaseClient } = await import('./supabase');

    // Act + Assert
    expect(() => createServiceRoleSupabaseClient()).toThrow(/Missing required Supabase runtime configuration/);
    expect(createClientSpy).not.toHaveBeenCalled();
  });
});
