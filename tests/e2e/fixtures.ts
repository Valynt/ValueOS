import { test as base } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface E2EFixtures {
  supabase: SupabaseClient;
}

/**
 * Extended Playwright test with a service-role Supabase client.
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment
 * (set in the critical-workflows-gate CI lane).
 *
 * In local development, set these in a .env.e2e file or export them before
 * running `pnpm exec playwright test`.
 */
export const test = base.extend<E2EFixtures>({
  supabase: async ({}, use) => {
    const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error(
        'E2E DB assertions require SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. ' +
          'Set them in the environment before running wf-N specs.',
      );
    }

    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    await use(client);
  },
});

export { expect } from '@playwright/test';
