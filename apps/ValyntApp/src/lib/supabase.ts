import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Robust logging for Supabase initialization
const logPrefix = "[Supabase]";
console.log(`${logPrefix} Initializing client...`);
console.log(`${logPrefix} URL configured: ${supabaseUrl ? "YES (" + supabaseUrl + ")" : "NO"}`);
console.log(
  `${logPrefix} Anon key configured: ${supabaseAnonKey ? "YES (length: " + supabaseAnonKey.length + ")" : "NO"}`
);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(`${logPrefix} ❌ Environment variables missing!`);
  console.error(`${logPrefix}   VITE_SUPABASE_URL: ${supabaseUrl || "MISSING"}`);
  console.error(`${logPrefix}   VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? "SET" : "MISSING"}`);
}

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      })
    : null;

if (supabase) {
  console.log(`${logPrefix} ✅ Client initialized successfully`);
} else {
  console.error(`${logPrefix} ❌ Client NOT initialized - missing configuration`);
}

export const getSupabaseClient = () => {
  if (!supabase) {
    throw new Error("Supabase client is not initialized. Check environment variables.");
  }
  return supabase;
};
