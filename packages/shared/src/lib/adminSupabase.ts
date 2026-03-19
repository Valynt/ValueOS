/**
 * Restricted Admin Supabase Client
 *
 * Singleton service-role client with access logging.
 * Import-restricted to approved modules only:
 *   - services/auth
 *   - workers/
 *   - webhook handlers
 *   - cron jobs
 *
 * For tenant-scoped operations, use createRequestRlsSupabaseClient() instead.
 * service-role:justified
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "./env";

let adminClient: SupabaseClient | null = null;

const callerLog: Array<{ caller: string; timestamp: string }> = [];
const MAX_LOG_ENTRIES = 1000;

function captureCallerInfo(): string {
  const stack = new Error().stack ?? "";
  const lines = stack.split("\n").filter((l) => l.includes("at "));
  // Skip internal frames (getAdminSupabaseClient, captureCallerInfo)
  const callerLine = lines[2] ?? lines[1] ?? "unknown";
  return callerLine.trim();
}

/**
 * Get the singleton admin (service-role) Supabase client.
 * Every call is logged with a stack trace for audit purposes.
 *
 * Prefer createRequestRlsSupabaseClient() for tenant-scoped operations.
 */
export function getAdminSupabaseClient(): SupabaseClient {
  const caller = captureCallerInfo();

  if (callerLog.length >= MAX_LOG_ENTRIES) {
    callerLog.shift();
  }
  callerLog.push({ caller, timestamp: new Date().toISOString() });

  if (adminClient) {
    return adminClient;
  }

  if (typeof window !== "undefined") {
    throw new Error(
      "Admin Supabase client cannot be used in browser environment",
    );
  }

  const { url, serviceRoleKey } = getSupabaseConfig();

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Admin Supabase client requires VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  adminClient = createClient(url, serviceRoleKey, {
    db: { schema: "public" },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}

/**
 * Get recent admin client access log entries for audit.
 */
export function getAdminAccessLog(): ReadonlyArray<{
  caller: string;
  timestamp: string;
}> {
  return [...callerLog];
}

/**
 * Reset the singleton for testing purposes only.
 */
export function _resetAdminClient(): void {
  adminClient = null;
  callerLog.length = 0;
}
