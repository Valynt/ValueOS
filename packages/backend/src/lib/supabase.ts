import { createClient, SupabaseClient } from "@supabase/supabase-js";

import { getValidatedSupabaseRuntimeConfig } from "./env";

/**
 * Creates a Supabase client authenticated as the calling user via their JWT.
 * RLS policies are enforced — use this for all normal API request paths.
 *
 * @param userAccessToken - The user's JWT from the Authorization header.
 */
export const createUserSupabaseClient = (userAccessToken: string): SupabaseClient => {
  const { url, anonKey } = getValidatedSupabaseRuntimeConfig();
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${userAccessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

/**
 * Creates a Supabase client using the service_role key, which bypasses RLS.
 *
 * RESTRICTED USE — allowed only in:
 *   - AuthService / AdminUserService / AdminRoleService
 *   - TenantProvisioning / TenantDeletionService
 *   - Background workers and cron jobs
 *   - SecurityAuditService
 *
 * All other call sites must use createUserSupabaseClient() so that RLS is
 * enforced. Violations are caught by the ESLint no-restricted-imports rule
 * in eslint.config.js (backendModuleBoundaryOverrides).
 */
export const createServerSupabaseClient = () => {
  const { url, serviceRoleKey } = getValidatedSupabaseRuntimeConfig();
  return createClient(url, serviceRoleKey);
};

// Lazy singleton — created on first call rather than at module load time so
// that test files which mock this module are never forced to satisfy the
// env-var guard during import.
let _supabase: SupabaseClient | undefined;

export const getSupabaseClient = (): SupabaseClient => {
  if (!_supabase) {
    _supabase = createServerSupabaseClient();
  }
  return _supabase;
};

// Named export used by the 60+ call sites that do `import { supabase } from ...`
// This is a plain object with a getter on each well-known SupabaseClient method
// group so that serialisers (vitest pretty-format, JSON.stringify) never trigger
// the env-var guard. The real client is only created on first method call.
export const supabase = {
  get auth() { return getSupabaseClient().auth; },
  get storage() { return getSupabaseClient().storage; },
  get realtime() { return getSupabaseClient().realtime; },
  from: (...args: Parameters<SupabaseClient['from']>) => getSupabaseClient().from(...args),
  rpc: (...args: Parameters<SupabaseClient['rpc']>) => getSupabaseClient().rpc(...args),
  channel: (...args: Parameters<SupabaseClient['channel']>) => getSupabaseClient().channel(...args),
  removeChannel: (...args: Parameters<SupabaseClient['removeChannel']>) => getSupabaseClient().removeChannel(...args),
  getChannels: () => getSupabaseClient().getChannels(),
  removeAllChannels: () => getSupabaseClient().removeAllChannels(),
} as unknown as SupabaseClient;
