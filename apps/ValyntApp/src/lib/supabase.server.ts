import { createClient } from "@supabase/supabase-js";

import { logger } from "./logger";

const logPrefix = "[Supabase]";
const isBrowser = typeof window !== "undefined";

const getServerEnv = (key: string): string | undefined => {
  if (typeof process !== "undefined" && process.env?.[key]) {
    return process.env[key];
  }

  return undefined;
};

const supabaseUrl =
  getServerEnv("VITE_SUPABASE_URL") ||
  getServerEnv("SUPABASE_PUBLIC_URL") ||
  getServerEnv("SUPABASE_URL") ||
  getServerEnv("SUPABASE_INTERNAL_URL");
const supabaseAnonKey =
  getServerEnv("VITE_SUPABASE_ANON_KEY") || getServerEnv("SUPABASE_ANON_KEY");

let serviceRoleClient: ReturnType<typeof createClient> | null = null;

export const createServerSupabaseClient = () => {
  if (isBrowser) {
    throw new Error("createServerSupabaseClient() is only available in Node/server runtime.");
  }

  const supabaseServiceRoleKey = getServerEnv("SUPABASE_SERVICE_ROLE_KEY");

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
};

export const createRequestSupabaseClient = (accessToken: string) => {
  if (isBrowser) {
    throw new Error("createRequestSupabaseClient() is only available in Node/server runtime.");
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase request-scoped credentials. Expected VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }

  if (!accessToken) {
    throw new Error("createRequestSupabaseClient requires a bearer access token.");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
