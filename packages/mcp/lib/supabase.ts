/**
 * MCP Supabase Client
 *
 * Provides a service-role client for background synchronization tasks in MCP CRM adapters.
 * Configured identically to the backend's createServiceRoleSupabaseClient.
 */

import {
  createClient,
  SupabaseClient,
  SupabaseClientOptions,
} from "@supabase/supabase-js";

let serviceRoleSupabaseClient: SupabaseClient | null = null;

function getBaseSupabaseOptions(): SupabaseClientOptions<"public"> {
  return {
    db: {
      schema: "public",
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  };
}

export function getSupabaseClient(): SupabaseClient {
  if (!serviceRoleSupabaseClient) {
    const supabaseUrl =
      process.env.SUPABASE_URL || "https://example.supabase.co";
    const supabaseKey =
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      "example-key";

    serviceRoleSupabaseClient = createClient(
      supabaseUrl,
      supabaseKey,
      getBaseSupabaseOptions()
    );
  }

  return serviceRoleSupabaseClient;
}

/**
 * Proxy to maintain backward compatibility with existing imports
 * while still lazily instantiating the client.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property, receiver) {
    return Reflect.get(getSupabaseClient(), property, receiver);
  },
});

export default supabase;
