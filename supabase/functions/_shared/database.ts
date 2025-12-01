/**
 * Database Client Utilities
 * Shared Supabase client creation for Edge Functions
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Create a Supabase client with service role privileges
 * Use this for operations that bypass RLS
 */
export function createServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Create a Supabase client with user context
 * Use this for operations that respect RLS
 */
export function createAuthClient(authHeader: string | null) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  if (!authHeader) {
    throw new Error('Missing authorization header');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Extract JWT from Authorization header
 */
export function extractJWT(authHeader: string | null): string {
  if (!authHeader) {
    throw new Error('Missing authorization header');
  }

  const jwt = authHeader.replace('Bearer ', '');
  if (!jwt) {
    throw new Error('Invalid authorization header format');
  }

  return jwt;
}

/**
 * Verify required environment variables
 */
export function verifyEnv(): void {
  const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter((key) => !Deno.env.get(key));

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
