import { createClient } from "@supabase/supabase-js";

import { logger } from "./logger";

import { serverSettings } from "@/config/settings.server";

const logPrefix = "[Supabase]";
const isBrowser = typeof window !== "undefined";
const { VITE_SUPABASE_URL: supabaseUrl, SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRoleKey } =
  serverSettings;

let serviceRoleClient: ReturnType<typeof createClient> | null = null;

export function createServerSupabaseClient() {
  if (isBrowser) {
    throw new Error("createServerSupabaseClient() is only available in Node/server runtime.");
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    const diagnostics = [
      `${logPrefix} Missing server Supabase credentials for privileged access.`,
      `${logPrefix}   VITE_SUPABASE_URL: ${supabaseUrl ? "SET" : "MISSING"}`,
      `${logPrefix}   SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceRoleKey ? "SET" : "MISSING"}`,
      `${logPrefix} Privileged paths cannot start without service-role credentials.`,
    ].join("\n");

    logger.error(diagnostics);
    throw new Error(diagnostics);
  }

  if (!serviceRoleClient) {
    serviceRoleClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    logger.info(`${logPrefix} ✅ Service-role server client initialized`);
  }

  return serviceRoleClient;
}

export function getSupabaseClient() {
  return createServerSupabaseClient();
}
