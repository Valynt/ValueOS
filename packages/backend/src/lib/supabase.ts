import {
  createRequestRlsSupabaseClient,
  createRequestSupabaseClient,
  createServiceRoleSupabaseClient,
  getRequestSupabaseClient,
  type RequestScopedRlsSupabaseClient,
  type ServiceRoleSupabaseClient,
} from "@shared/lib/supabase";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "./logger.js";
import { createCounter } from "./observability/index.js";

// Test-environment guard — imported lazily to avoid pulling test utilities into
// production bundles. Only active when vitest is running.
function assertNotTestEnv(caller: string): void {
  if (
    typeof process !== "undefined" &&
    process.env["VITEST"] &&
    !process.env["VALUEOS_TEST_REAL_INTEGRATION"] &&
    !process.env["VALUEOS_TEST_ALLOW_SUPABASE"]
  ) {
    throw new Error(
      `Unexpected Supabase client creation during tests (${caller}). Mock src/lib/supabase.ts or set VALUEOS_TEST_REAL_INTEGRATION=true for an explicit integration run.`
    );
  }
}

export {
  assertNotTestEnv,
  createRequestRlsSupabaseClient,
  createRequestSupabaseClient,
  createServiceRoleSupabaseClient,
  getRequestSupabaseClient,
  type RequestScopedRlsSupabaseClient,
};
export type { ServiceRoleSupabaseClient };

const deprecatedSupabaseCompatCounter = createCounter(
  "deprecated_supabase_api_usage_total",
  "Deprecated backend Supabase compatibility API usage by callsite",
  ["api", "callsite"]
);

const deprecatedSupabaseWarningOnceByCallsite = new Set<string>();
const DEPRECATION_WARNING_CODE = "VOS_DEPRECATED_SUPABASE_COMPAT";

function resolveDeprecatedCallsite(): string {
  const stack = new Error().stack ?? "";
  const frame = stack
    .split("\n")
    .slice(2)
    .map(line => line.trim())
    .find(
      line =>
        !line.includes("src/lib/supabase.ts") &&
        !line.includes("src/lib/supabase.js")
    );

  return frame ?? "unknown";
}

function logDeprecatedCompatUsage(
  api: "createServerSupabaseClient" | "getSupabaseClient"
): void {
  const callsite = resolveDeprecatedCallsite();

  deprecatedSupabaseCompatCounter.inc({ api, callsite });

  const onceKey = `${api}:${callsite}`;
  if (deprecatedSupabaseWarningOnceByCallsite.has(onceKey)) {
    return;
  }

  deprecatedSupabaseWarningOnceByCallsite.add(onceKey);

  logger.warn("supabase.compat.deprecated_api_forwarded", {
    api,
    callsite,
    compatibility_mode: "temporary_forward_to_createServiceRoleSupabaseClient",
    migration_target: "src/lib/supabase/privileged/*",
    required_justification_format: "service-role:justified <reason>",
  });

  process.emitWarning(
    `[DEPRECATED] ${api} forwarded to createServiceRoleSupabaseClient() from ${callsite}. Migrate to src/lib/supabase/privileged/* factories with explicit justification literals.`,
    {
      code: DEPRECATION_WARNING_CODE,
      type: "DeprecationWarning",
    }
  );
}

/**
 * @deprecated Prefer createRequestSupabaseClient({ accessToken }) so the RLS-safe
 * monorepo helper is explicit at the call site.
 */
export const createUserSupabaseClient = (
  userAccessToken: string
): RequestScopedRlsSupabaseClient => {
  return createRequestSupabaseClient({ accessToken: userAccessToken });
};

/**
 * @deprecated Temporary compatibility shim. This now forwards to
 * createServiceRoleSupabaseClient() with deprecation telemetry so backend startup
 * remains unblocked while callsites migrate to src/lib/supabase/privileged/*.
 */
export const createServerSupabaseClient = (): ServiceRoleSupabaseClient => {
  assertNotTestEnv("createServerSupabaseClient");
  logDeprecatedCompatUsage("createServerSupabaseClient");
  return createServiceRoleSupabaseClient();
};

/**
 * @deprecated Temporary compatibility shim. This now forwards to
 * createServiceRoleSupabaseClient() with deprecation telemetry so backend startup
 * remains unblocked while callsites migrate to src/lib/supabase/privileged/*.
 */
export const getSupabaseClient = (): ServiceRoleSupabaseClient => {
  assertNotTestEnv("getSupabaseClient");
  logDeprecatedCompatUsage("getSupabaseClient");
  return createServiceRoleSupabaseClient();
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
