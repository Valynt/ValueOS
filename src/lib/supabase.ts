import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js';
import { Database } from './database.types';
import { createProtectedFetch, getCsrfToken } from './security/csrf';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const protectedFetch = createProtectedFetch();

const supabaseOptions: SupabaseClientOptions<Database> = {
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'x-connection-pool': 'bolt-database',
      'X-CSRF-Token': getCsrfToken(),
    },
    fetch: (input, init) =>
      protectedFetch(input, {
        ...init,
        keepalive: true,
        credentials: 'include',
      }),
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
};

function createMockSupabase() {
  const notConfiguredError = () => new Error('Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');

  const mockQuery = () => ({
    select: () => ({ data: null, error: notConfiguredError() }),
    maybeSingle: () => ({ data: null, error: notConfiguredError() }),
    single: () => ({ data: null, error: notConfiguredError() }),
    insert: () => ({ data: null, error: notConfiguredError() }),
    update: () => ({ data: null, error: notConfiguredError() }),
    eq: () => mockQuery(),
    contains: () => mockQuery(),
    ilike: () => mockQuery(),
    order: () => mockQuery(),
    range: () => ({ data: null, error: notConfiguredError() }),
  });

  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: notConfiguredError() }),
    },
    from: () => mockQuery(),
  };
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, supabaseOptions)
  : (createMockSupabase() as unknown as ReturnType<typeof createClient<Database>>);

export function getSupabaseClient() {
  return supabase;
}
