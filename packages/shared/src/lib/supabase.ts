import { createClient, type SupabaseClientOptions } from "@supabase/supabase-js";
import { settings } from "../config/settings";

// Client-side configuration - only uses anon key
const supabaseUrl = settings.VITE_SUPABASE_URL;
const supabaseAnonKey = settings.VITE_SUPABASE_ANON_KEY;

// Validate required client-side configuration
let supabase: any = null;
if (supabaseUrl && supabaseAnonKey) {
  const supabaseOptions: SupabaseClientOptions<"public"> = {
    db: {
      schema: "public",
    },
    auth: {
      autoRefreshToken: true,
      persistSession: false, // We handle persistence manually via SecureTokenManager for rotation support
      detectSessionInUrl: true,
    },
  };

  // Client-side Supabase client - safe for browser
  supabase = createClient(supabaseUrl, supabaseAnonKey, supabaseOptions);
} else {
  console.warn("Supabase client configuration is missing. Billing features will be disabled.");
}

export { supabase };

export function getSupabaseClient() {
  if (!supabase) {
    throw new Error("Supabase client not configured. Billing features are disabled.");
  }
  return supabase;
}

// Server-side Supabase client - for backend services only
// This should NEVER be used in client-side code
export function createServerSupabaseClient(serviceKey?: string) {
  const serverKey =
    serviceKey || settings.SUPABASE_SERVICE_ROLE_KEY || settings.VITE_SUPABASE_ANON_KEY;

  if (!serverKey) {
    throw new Error("Supabase service key is required for server-side operations");
  }

  if (
    typeof window !== "undefined" &&
    typeof process !== "undefined" &&
    process.env.NODE_ENV !== "test" &&
    !process.env.VITEST
  ) {
    throw new Error("Server Supabase client cannot be used in browser environment");
  }

  const serverOptions: SupabaseClientOptions<"public"> = {
    db: {
      schema: "public",
    },
    auth: {
      autoRefreshToken: false, // Server-side doesn't need auto-refresh
    },
  };

  return createClient(supabaseUrl, serverKey, serverOptions);
}
