import { afterEach, describe, expect, it } from 'vitest';

import { createServerSupabaseClient } from '../supabase.js';

const originalRealIntegration = process.env.VALUEOS_TEST_REAL_INTEGRATION;

afterEach(() => {
  if (originalRealIntegration === undefined) {
    delete process.env.VALUEOS_TEST_REAL_INTEGRATION;
  } else {
    process.env.VALUEOS_TEST_REAL_INTEGRATION = originalRealIntegration;
  }
});

describe('test runtime guards', () => {
  it('fails fast when a real Supabase client is created without explicit integration mode', () => {
    delete process.env.VALUEOS_TEST_REAL_INTEGRATION;

    expect(() => createServerSupabaseClient()).toThrow(
      'Unexpected Supabase client creation during tests',
    );
  });

  it('fails fast when code attempts an unexpected outbound fetch', async () => {
    delete process.env.VALUEOS_TEST_REAL_INTEGRATION;

    await expect(globalThis.fetch('https://api.stripe.com/v1/customers')).rejects.toThrow(
      'Unexpected outbound fetch during tests',
    );
  });
});
