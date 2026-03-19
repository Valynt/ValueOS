import { createClient } from "@supabase/supabase-js";

import { logger } from "./logger";

const logPrefix = "[Supabase]";

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const supabaseUrl = viteEnv?.VITE_SUPABASE_URL;
const supabaseAnonKey = viteEnv?.VITE_SUPABASE_ANON_KEY;

logger.info(`${logPrefix} Initializing browser client...`);
logger.info(`${logPrefix} URL configured: ${supabaseUrl ? "YES" : "NO"}`);
logger.info(`${logPrefix} Anon key configured: ${supabaseAnonKey ? "YES" : "NO"}`);

let browserClient: ReturnType<typeof createClient> | null = null;

export const createBrowserSupabaseClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase browser credentials. Expected VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
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

export const supabase = createBrowserSupabaseClient();

export function createRequestSupabaseClient(accessToken: string) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase request-scoped credentials. Expected VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
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
