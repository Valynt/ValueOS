import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createBrowserSupabaseClient,
  createRequestRlsSupabaseClient,
  createRequestSupabaseClient,
  createServiceRoleSupabaseClient,
  getRequestSupabaseClient,
  type BrowserSafeAnonSupabaseClient,
  type RequestScopedRlsSupabaseClient,
  type ServiceRoleSupabaseClient,
} from "@shared/lib/supabase";

import { getValidatedSupabaseRuntimeConfig } from "./env";
import { assertRealSupabaseAllowed } from "../test/runtimeGuards";

export {
  createBrowserSupabaseClient,
  createRequestRlsSupabaseClient,
  createRequestSupabaseClient,
  getRequestSupabaseClient,
  type BrowserSafeAnonSupabaseClient,
  type RequestScopedRlsSupabaseClient,
};

export type { ServiceRoleSupabaseClient };

/**
 * @deprecated Prefer createRequestSupabaseClient({ accessToken }) so the RLS-safe
 * monorepo helper is explicit at the call site.
 */
export const createUserSupabaseClient = (userAccessToken: string): RequestScopedRlsSupabaseClient => {
  if (process.env.VITEST) {
    assertRealSupabaseAllowed("createUserSupabaseClient");
  }

  return createRequestSupabaseClient({ accessToken: userAccessToken });
};

/**
 * @deprecated Prefer createServiceRoleSupabaseClient() so service-role usage is
 * explicit at the call site.
 */
export const createServerSupabaseClient = (): ServiceRoleSupabaseClient => {
  if (process.env.VITEST) {
    assertRealSupabaseAllowed("createServerSupabaseClient");
  }

  getValidatedSupabaseRuntimeConfig();
  return createServiceRoleSupabaseClient();
};

let serviceRoleSingleton: ServiceRoleSupabaseClient | undefined;

/**
 * @deprecated Import a scoped privileged module from
 * `src/lib/supabase/privileged/*` instead of the general-purpose
 * `src/lib/supabase` module.
 */
export const getSupabaseClient = (): ServiceRoleSupabaseClient => {
  if (process.env.VITEST) {
    assertRealSupabaseAllowed("getSupabaseClient");
  }

  if (!serviceRoleSingleton) {
    getValidatedSupabaseRuntimeConfig();
    serviceRoleSingleton = createServiceRoleSupabaseClient();
  }
  return serviceRoleSingleton;
};

/**
 * @deprecated The broad service-role proxy bypasses RLS and should not be used
 * in new code. Use request-scoped clients by default and privileged modules
 * (`src/lib/supabase/privileged/*`) for the limited allowlisted operations.
 */
export const supabase = {
  get auth() { return getSupabaseClient().auth; },
  get storage() { return getSupabaseClient().storage; },
  get realtime() { return getSupabaseClient().realtime; },
  from: (...args: Parameters<SupabaseClient["from"]>) => getSupabaseClient().from(...args),
  rpc: (...args: Parameters<SupabaseClient["rpc"]>) => getSupabaseClient().rpc(...args),
  channel: (...args: Parameters<SupabaseClient["channel"]>) => getSupabaseClient().channel(...args),
  removeChannel: (...args: Parameters<SupabaseClient["removeChannel"]>) => getSupabaseClient().removeChannel(...args),
  getChannels: () => getSupabaseClient().getChannels(),
  removeAllChannels: () => getSupabaseClient().removeAllChannels(),
} as unknown as SupabaseClient;

export type { SupabaseClient };
