import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js';
import { Database } from './database.types';

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
    },
    fetch: (input, init) => fetch(input, { ...init, keepalive: true }),
  },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, supabaseOptions);
