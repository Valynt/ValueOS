import { createClient } from "@supabase/supabase-js";

import { logger } from "./logger";

const logPrefix = "[Supabase]";
const isBrowser = typeof window !== "undefined";

const getEnv = (key: string): string | undefined => {
  if (typeof process !== "undefined" && process.env?.[key]) {
    return process.env[key];
  }

  const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return viteEnv?.[key];
};

const supabaseUrl = getEnv("VITE_SUPABASE_URL");
const supabaseAnonKey = getEnv("VITE_SUPABASE_ANON_KEY");

logger.info(`${logPrefix} Initializing clients...`);
logger.info(`${logPrefix} Runtime: ${isBrowser ? "browser" : "node"}`);
logger.info(`${logPrefix} URL configured: ${supabaseUrl ? "YES" : "NO"}`);
logger.info(`${logPrefix} Anon key configured: ${supabaseAnonKey ? "YES" : "NO"}`);

let browserClient: ReturnType<typeof createClient> | null = null;

export const createBrowserSupabaseClient = () => {
  if (!isBrowser) {
    throw new Error(
      "createBrowserSupabaseClient() can only be used in the browser runtime.",
    );
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase browser credentials. Expected VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }

  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
    logger.info(`${logPrefix} ✅ Browser client initialized`);
  }

  return browserClient;
};

export const supabase = isBrowser ? createBrowserSupabaseClient() : null;

export function createRequestSupabaseClient(accessToken: string) {
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
}
