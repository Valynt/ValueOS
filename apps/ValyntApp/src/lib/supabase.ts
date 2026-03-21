import { createClient } from "@supabase/supabase-js";

import { logger } from "./logger";

const logPrefix = "[Supabase]";
const isBrowser = typeof window !== "undefined";

const getBrowserEnv = (key: "VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY") => {
  const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return viteEnv?.[key];
};

const supabaseUrl = getBrowserEnv("VITE_SUPABASE_URL");
const supabaseAnonKey = getBrowserEnv("VITE_SUPABASE_ANON_KEY");

logger.info(`${logPrefix} Initializing browser client...`);
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

