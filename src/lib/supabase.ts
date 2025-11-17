import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js';
import { Database } from './database.types';
import { getCsrfToken } from './security/csrf';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseOptions: SupabaseClientOptions<Database> = {
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'x-connection-pool': 'bolt-database',
      'X-CSRF-Token': getCsrfToken(),
    },
    fetch: (input, init) => fetch(input, { ...init, keepalive: true }),
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, supabaseOptions);
