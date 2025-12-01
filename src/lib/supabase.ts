import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// Fail fast if Supabase is not configured
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase configuration missing!\n' +
    'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file.\n' +
    'See .env.example for reference.'
  );
}

const supabaseOptions: SupabaseClientOptions<'public'> = {
  db: {
    schema: 'public',
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
};

// Always use real Supabase client - no mocks
export const supabase = createClient(supabaseUrl, supabaseAnonKey, supabaseOptions);

export function getSupabaseClient() {
  return supabase;
}
