import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Use environment variables or defaults
const supabaseUrl = process.env.SUPABASE_URL || "https://example.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || "example-key";

export const createServerSupabaseClient = () => {
  return createClient(supabaseUrl, supabaseKey);
};

// Shared singleton client for legacy call sites/tests that import { supabase }
export const supabase = createServerSupabaseClient();

// Alias for backward compatibility
export const getSupabaseClient = (): SupabaseClient => supabase;
