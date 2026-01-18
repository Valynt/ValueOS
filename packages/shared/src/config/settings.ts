import { getEnvVar } from "../lib/env";

export const settings = {
  VITE_SUPABASE_URL: getEnvVar("VITE_SUPABASE_URL"),
  VITE_SUPABASE_ANON_KEY: getEnvVar("VITE_SUPABASE_ANON_KEY"),
  SUPABASE_SERVICE_ROLE_KEY:
    getEnvVar("SUPABASE_SERVICE_ROLE_KEY") || getEnvVar("SUPABASE_SERVICE_KEY"),
};
