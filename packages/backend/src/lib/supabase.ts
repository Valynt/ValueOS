import { createClient, SupabaseClient } from "@supabase/supabase-js";

import { getValidatedSupabaseRuntimeConfig } from "./env";

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
