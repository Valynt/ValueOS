import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js';
import { settings } from '../config/settings';

const supabaseUrl = settings.VITE_SUPABASE_URL;
const supabaseAnonKey = settings.VITE_SUPABASE_ANON_KEY;

// The settings file already fails fast, so this check is redundant, but kept for clarity.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase configuration is missing in the centralized settings.');
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
