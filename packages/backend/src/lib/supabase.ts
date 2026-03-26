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

import type { SupabaseClient } from "@supabase/supabase-js";

export {
  createBrowserSupabaseClient,
  createRequestRlsSupabaseClient,
  createRequestSupabaseClient,
  createServiceRoleSupabaseClient,
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
  return createRequestSupabaseClient({ accessToken: userAccessToken });
};

/**
 * @deprecated Hard-fail: service-role access must route through
 * src/lib/supabase/privileged/* with explicit scope + justification metadata.
 */
export const createServerSupabaseClient = (): ServiceRoleSupabaseClient => {
  throw new Error(
    "createServerSupabaseClient is deprecated and blocked. Use src/lib/supabase/privileged/* factories with service-role justification metadata."
  );
};

/**
 * @deprecated Hard-fail: service-role access must route through
 * src/lib/supabase/privileged/* with explicit scope + justification metadata.
 */
export const getSupabaseClient = (): ServiceRoleSupabaseClient => {
  throw new Error(
    "getSupabaseClient is deprecated and blocked. Use src/lib/supabase/privileged/* factories with service-role justification metadata."
  );
};

/**
 * @deprecated Hard-fail: broad service-role proxy is blocked.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get() {
    throw new Error(
      "supabase export is deprecated and blocked. Use createRequestSupabaseClient/getRequestSupabaseClient in request paths or src/lib/supabase/privileged/* factories for allowlisted service-role operations."
    );
  },
  apply() {
    throw new Error(
      "supabase export is deprecated and blocked. Use createRequestSupabaseClient/getRequestSupabaseClient in request paths or src/lib/supabase/privileged/* factories for allowlisted service-role operations."
    );
  },
}) as SupabaseClient;

export type { SupabaseClient };
