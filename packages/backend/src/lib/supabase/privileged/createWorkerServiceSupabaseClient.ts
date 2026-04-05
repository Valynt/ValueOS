import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { assertRealSupabaseAllowed } from '../../../../test/runtimeGuards';

import type { ServiceRoleJustification } from './policy';

export interface WorkerServiceSupabaseClientOptions {
  justification: ServiceRoleJustification;
}

export function createWorkerServiceSupabaseClient(
  options: WorkerServiceSupabaseClientOptions,
): SupabaseClient {
  void options.justification;

  if (process.env.VITEST) {
    assertRealSupabaseAllowed('createWorkerServiceSupabaseClient');
  }

  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}
