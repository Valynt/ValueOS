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
    const { createRequestRlsSupabaseClient } = await import('./supabase');

    expect(() => createRequestRlsSupabaseClient({ headers: {} })).toThrow(
      /will not fall back to anon or service-role credentials/,
    );
    expect(createClientSpy).not.toHaveBeenCalled();
  });

  it('rejects server-side RLS client creation when the bearer token is blank', async () => {
    const { createRequestRlsSupabaseClient } = await import('./supabase');

    expect(() =>
      createRequestRlsSupabaseClient({ headers: { authorization: 'Bearer   ' } }),
    ).toThrow(/will not fall back to anon or service-role credentials/);
    expect(createClientSpy).not.toHaveBeenCalled();
  });

  it('rejects service-role client creation when the service role key is missing even if insecure fallback env is set', async () => {
    process.env.ALLOW_INSECURE_ANON_SERVER_CLIENT = 'true';
    const { createServiceRoleSupabaseClient } = await import('./supabase');

    expect(() => createServiceRoleSupabaseClient()).toThrow(
      /service role key is required for elevated server-side operations/,
    );
    expect(createClientSpy).not.toHaveBeenCalled();
  });
});
