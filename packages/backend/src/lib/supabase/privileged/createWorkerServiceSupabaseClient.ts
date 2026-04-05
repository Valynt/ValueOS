import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type WorkerServiceRoleJustification = `service-role:justified ${string}`;

export interface CreateWorkerServiceSupabaseClientOptions {
  justification: WorkerServiceRoleJustification;
}

export function createWorkerServiceSupabaseClient(
  _options: CreateWorkerServiceSupabaseClientOptions,
): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "createWorkerServiceSupabaseClient requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}
