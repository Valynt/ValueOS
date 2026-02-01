/**
 * Unified Supabase Client Factory
 *
 * Single source of truth for Supabase client creation across all packages.
 * Prevents inconsistent initialization with varying defaults.
 *
 * Usage:
 *   import { createSupabaseClient, createServerSupabaseClient } from "@valueos/shared/supabase";
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Local Supabase demo keys (safe to commit - only work with local instance)
const LOCAL_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const LOCAL_SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export interface SupabaseConfig {
  url: string;
  anonKey?: string;
  serviceRoleKey?: string;
}

/**
 * Detect if running in browser environment
 */
function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.document !== "undefined";
}

/**
 * Detect if running in local development
 */
function isLocalDev(): boolean {
  if (isBrowser()) {
    // Browser: check Vite env
    return (
      (import.meta as any)?.env?.DEV === true || (import.meta as any)?.env?.MODE === "development"
    );
  }
  // Node: check NODE_ENV
  return process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
}

/**
 * Get Supabase configuration from environment
 */
export function getSupabaseConfig(): SupabaseConfig {
  if (isBrowser()) {
    // Browser environment - use VITE_ prefixed vars
    const env = (import.meta as any)?.env || {};
    return {
      url: env.VITE_SUPABASE_URL || "",
      anonKey: env.VITE_SUPABASE_ANON_KEY || "",
    };
  }

  // Server environment - use process.env
  return {
    url: process.env.SUPABASE_URL || "",
    anonKey: process.env.SUPABASE_ANON_KEY || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "",
  };
}

/**
 * Validate Supabase configuration
 */
export function validateSupabaseConfig(config: SupabaseConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.url) {
    errors.push("SUPABASE_URL is not configured");
  } else if (!config.url.startsWith("http://") && !config.url.startsWith("https://")) {
    errors.push(`Invalid SUPABASE_URL format: ${config.url}`);
  }

  if (!config.anonKey && isBrowser()) {
    errors.push("SUPABASE_ANON_KEY is required for browser clients");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Create a Supabase client for browser use (uses anon key)
 *
 * CRITICAL: This client uses the anon key and respects RLS.
 * Never use service_role key in browser!
 */
export function createSupabaseClient(options?: {
  url?: string;
  anonKey?: string;
}): SupabaseClient | null {
  const config = getSupabaseConfig();
  const url = options?.url || config.url;
  const anonKey = options?.anonKey || config.anonKey;

  // In local dev, use demo keys if not configured
  const finalUrl = url || (isLocalDev() ? "http://localhost:54321" : "");
  const finalKey = anonKey || (isLocalDev() ? LOCAL_SUPABASE_ANON_KEY : "");

  if (!finalUrl || !finalKey) {
    console.error(
      "[Supabase] Client not initialized. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
    );
    return null;
  }

  return createClient(finalUrl, finalKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: isBrowser(),
      detectSessionInUrl: isBrowser(),
    },
  });
}

/**
 * Create a Supabase server client (uses service_role key)
 *
 * CRITICAL: This client bypasses RLS!
 * Only use for:
 * - AuthService
 * - TenantProvisioning
 * - CronJobs/Background workers
 */
export function createServerSupabaseClient(options?: {
  url?: string;
  serviceRoleKey?: string;
}): SupabaseClient {
  if (isBrowser()) {
    throw new Error("createServerSupabaseClient cannot be used in browser environment");
  }

  const config = getSupabaseConfig();
  const url = options?.url || config.url;
  const serviceRoleKey = options?.serviceRoleKey || config.serviceRoleKey;

  // In local dev, use demo keys if not configured
  const finalUrl = url || (isLocalDev() ? "http://localhost:54321" : "");
  const finalKey = serviceRoleKey || (isLocalDev() ? LOCAL_SUPABASE_SERVICE_ROLE_KEY : "");

  if (!finalUrl || !finalKey) {
    throw new Error(
      "[Supabase] Server client not initialized. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(finalUrl, finalKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Get or create singleton client (for backwards compatibility)
 */
let browserClient: SupabaseClient | null = null;
let serverClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (isBrowser()) {
    if (!browserClient) {
      browserClient = createSupabaseClient();
    }
    return browserClient;
  }
  return null;
}

export function getServerSupabaseClient(): SupabaseClient {
  if (!serverClient) {
    serverClient = createServerSupabaseClient();
  }
  return serverClient;
}
