import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
  vi.resetModules();
});

// The supabase singleton is now lazily initialised — the module import no longer
// throws. Validation fires on first client access (getSupabaseClient()), which
// is the correct point to enforce the production guard.
describe('supabase runtime config validation', () => {
  it('fails on first client access in production when Supabase secret is missing', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_KEY;

    vi.resetModules();
    const { getSupabaseClient } = await import('../supabase');
    expect(() => getSupabaseClient()).toThrow(
      /Missing required Supabase runtime configuration: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY/,
    );
  });

  it('fails on first client access in production when Supabase URL is missing', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    delete process.env.SUPABASE_URL;
    delete process.env.VITE_SUPABASE_URL;

    vi.resetModules();
    const { getSupabaseClient } = await import('../supabase');
    expect(() => getSupabaseClient()).toThrow(
      /Missing required Supabase runtime configuration: SUPABASE_URL or VITE_SUPABASE_URL/,
    );
  });
});
