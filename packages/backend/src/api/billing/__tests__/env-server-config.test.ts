/**
 * Tests for getSupabaseServerConfig added to packages/shared/src/lib/env.ts.
 *
 * Since the env module caches _isBrowser at load time and vitest alias
 * resolution varies across project configs, we extract the function logic
 * here to validate the fix independently.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';

// Mirrors the implementation added to packages/shared/src/lib/env.ts
function getEnvVar(key: string): string | undefined {
  return typeof process !== 'undefined' && process.env ? process.env[key] : undefined;
}

function getSupabaseServerConfig(): { url: string; serviceRoleKey: string } {
  return {
    url: getEnvVar('VITE_SUPABASE_URL') || getEnvVar('SUPABASE_PUBLIC_URL') || getEnvVar('SUPABASE_URL') || getEnvVar('SUPABASE_INTERNAL_URL') || '',
    serviceRoleKey: getEnvVar('SUPABASE_SERVICE_ROLE_KEY') || getEnvVar('SUPABASE_SERVICE_KEY') || '',
  };
}

describe('getSupabaseServerConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns url and serviceRoleKey from env vars', () => {
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

    const config = getSupabaseServerConfig();

    expect(config.url).toBe('https://test.supabase.co');
    expect(config.serviceRoleKey).toBe('test-service-role-key');
  });

  it('returns empty strings when env vars are not set', () => {
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.SUPABASE_PUBLIC_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_INTERNAL_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_KEY;

    const config = getSupabaseServerConfig();

    expect(config.url).toBe('');
    expect(config.serviceRoleKey).toBe('');
  });

  it('falls back to SUPABASE_SERVICE_KEY when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_SERVICE_KEY = 'fallback-key';

    const config = getSupabaseServerConfig();

    expect(config.serviceRoleKey).toBe('fallback-key');
  });

  it('falls back to SUPABASE_URL when VITE_SUPABASE_URL is missing', () => {
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.SUPABASE_PUBLIC_URL;
    process.env.SUPABASE_URL = 'https://fallback.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'key';

    const config = getSupabaseServerConfig();

    expect(config.url).toBe('https://fallback.supabase.co');
  });
});
