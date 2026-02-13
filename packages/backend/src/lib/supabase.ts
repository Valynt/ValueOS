import { createClient, SupabaseClient } from "@supabase/supabase-js";

import { getValidatedSupabaseRuntimeConfig } from "./env";

export const createServerSupabaseClient = () => {
  const { url, serviceRoleKey } = getValidatedSupabaseRuntimeConfig();
  return createClient(url, serviceRoleKey);
};

// Shared singleton client for legacy call sites/tests that import { supabase }
export const supabase = createServerSupabaseClient();

// Alias for backward compatibility
export const getSupabaseClient = (): SupabaseClient => supabase;
