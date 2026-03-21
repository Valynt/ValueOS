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

describe('shared supabase auth guards', () => {
  beforeEach(() => {
    createClientSpy.mockClear();
    delete process.env.ALLOW_INSECURE_ANON_SERVER_CLIENT;
  });

  it('rejects server-side RLS client creation when no bearer token is present', async () => {
    const { createRequestSupabaseClient } = await import('./supabase');

    expect(() => createRequestSupabaseClient({ headers: {} })).toThrow(
      /Authorization bearer token or session access token required for request-scoped Supabase client/,
    );
    expect(createClientSpy).not.toHaveBeenCalled();
  });

  it('rejects server-side RLS client creation when the bearer token is blank', async () => {
    const { createRequestSupabaseClient } = await import('./supabase');

    expect(() =>
      createRequestSupabaseClient({ headers: { authorization: 'Bearer   ' } }),
    ).toThrow(/Authorization bearer token or session access token required for request-scoped Supabase client/);
    expect(createClientSpy).not.toHaveBeenCalled();
  });

  it('rejects service-role client creation when the service role key is missing even if insecure fallback env is set', async () => {
    process.env.ALLOW_INSECURE_ANON_SERVER_CLIENT = 'true';
    const { createServiceRoleSupabaseClient } = await import('./supabase');

    expect(() => createServiceRoleSupabaseClient()).toThrow(
      /Supabase service role key is required/,
    );
    expect(createClientSpy).not.toHaveBeenCalled();
  });
});
