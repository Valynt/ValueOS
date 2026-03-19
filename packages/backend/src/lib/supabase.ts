import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createBrowserSupabaseClient,
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
  createRequestSupabaseClient,
  createServiceRoleSupabaseClient,
  getRequestSupabaseClient,
  type BrowserSafeAnonSupabaseClient,
  type RequestScopedRlsSupabaseClient,
  type ServiceRoleSupabaseClient,
};

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
