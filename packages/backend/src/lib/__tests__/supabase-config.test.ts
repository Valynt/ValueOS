import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function importSupabaseModule() {
  vi.resetModules();
  return import('../supabase');
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('supabase runtime config validation', () => {
  it('fails startup in production when Supabase secret is missing', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_KEY;

    await expect(importSupabaseModule()).rejects.toThrow(
      /Missing required Supabase runtime configuration: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY/,
    );
  });

  it('fails startup in production when Supabase URL is missing', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    delete process.env.SUPABASE_URL;
    delete process.env.VITE_SUPABASE_URL;

    await expect(importSupabaseModule()).rejects.toThrow(
      /Missing required Supabase runtime configuration: SUPABASE_URL or VITE_SUPABASE_URL/,
    );
  });
});
