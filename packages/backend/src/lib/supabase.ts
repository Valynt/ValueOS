import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createBrowserAnonSupabaseClient,
  createRequestRlsSupabaseClient as createCanonicalRequestRlsSupabaseClient,
  createServiceRoleSupabaseClient as createCanonicalServiceRoleSupabaseClient,
  type SupabaseRequestLike,
} from "@shared/lib/supabase";

import { assertRealSupabaseAllowed } from "../test/runtimeGuards";

export {
  createBrowserAnonSupabaseClient,
  type BrowserAnonSupabaseClientFactory,
  type RequestRlsSupabaseClientFactory,
  type ServiceRoleSupabaseClientFactory,
  type SupabaseRequestLike,
} from "@shared/lib/supabase";

export const createRequestRlsSupabaseClient = (
  input: SupabaseRequestLike | string,
): SupabaseClient => {
  if (process.env.VITEST) {
    assertRealSupabaseAllowed("createRequestRlsSupabaseClient");
  }

  return createCanonicalRequestRlsSupabaseClient(input);
};

export const createServiceRoleSupabaseClient = (): SupabaseClient => {
  if (process.env.VITEST) {
    assertRealSupabaseAllowed("createServiceRoleSupabaseClient");
  }

  return createCanonicalServiceRoleSupabaseClient();
};

let serviceRoleSupabaseClient: SupabaseClient | undefined;

export const getServiceRoleSupabaseClient = (): SupabaseClient => {
  if (!serviceRoleSupabaseClient) {
    serviceRoleSupabaseClient = createServiceRoleSupabaseClient();
  }

  return serviceRoleSupabaseClient;
};

/**
 * @deprecated Use createRequestRlsSupabaseClient().
 */
export const createUserSupabaseClient = (userAccessToken: string): SupabaseClient => {
  return createRequestRlsSupabaseClient(userAccessToken);
};

/**
 * @deprecated Use createServiceRoleSupabaseClient().
 */
export const createServerSupabaseClient = (): SupabaseClient => {
  return createServiceRoleSupabaseClient();
};

/**
 * @deprecated Use getServiceRoleSupabaseClient().
 */
export const getSupabaseClient = (): SupabaseClient => {
  return getServiceRoleSupabaseClient();
};

export const supabase = {
  get auth() {
    return getServiceRoleSupabaseClient().auth;
  },
  get storage() {
    return getServiceRoleSupabaseClient().storage;
  },
  get realtime() {
    return getServiceRoleSupabaseClient().realtime;
  },
  from: (...args: Parameters<SupabaseClient["from"]>) => getServiceRoleSupabaseClient().from(...args),
  rpc: (...args: Parameters<SupabaseClient["rpc"]>) => getServiceRoleSupabaseClient().rpc(...args),
  channel: (...args: Parameters<SupabaseClient["channel"]>) => getServiceRoleSupabaseClient().channel(...args),
  removeChannel: (...args: Parameters<SupabaseClient["removeChannel"]>) =>
    getServiceRoleSupabaseClient().removeChannel(...args),
  getChannels: () => getServiceRoleSupabaseClient().getChannels(),
  removeAllChannels: () => getServiceRoleSupabaseClient().removeAllChannels(),
} as unknown as SupabaseClient;
