import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js';
import { settings } from '../config/settings';

// Client-side configuration - only uses anon key
const supabaseUrl = settings.VITE_SUPABASE_URL;
const supabaseAnonKey = settings.VITE_SUPABASE_ANON_KEY;

// Validate required client-side configuration
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase client configuration is missing. Required: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
}

const supabaseOptions: SupabaseClientOptions<'public'> = {
  db: {
    schema: 'public',
  },
  auth: {
    autoRefreshToken: true,
    persistSession: false, // Disable localStorage persistence for security
    detectSessionInUrl: true,
  },
};

// Client-side Supabase client - safe for browser
export const supabase = createClient(supabaseUrl, supabaseAnonKey, supabaseOptions);

export function getSupabaseClient() {
  return supabase;
}

// Server-side Supabase client - for backend services only
// This should NEVER be used in client-side code
export function createServerSupabaseClient(serviceKey?: string) {
  const serverKey = serviceKey || settings.SUPABASE_SERVICE_KEY;

  if (!serverKey) {
    throw new Error('Supabase service key is required for server-side operations');
  }

  if (typeof window !== 'undefined') {
    throw new Error('Server Supabase client cannot be used in browser environment');
  }

  const serverOptions: SupabaseClientOptions<'public'> = {
    db: {
      schema: 'public',
    },
    auth: {
      autoRefreshToken: false, // Server-side doesn't need auto-refresh
    },
  };

  return createClient(supabaseUrl, serverKey, serverOptions);
}
