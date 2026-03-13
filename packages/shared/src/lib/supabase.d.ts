import { SupabaseClient } from "@supabase/supabase-js";

declare let supabase: SupabaseClient | null;
export { supabase };
export declare function getSupabaseClient(): SupabaseClient;

interface RequestWithSupabase {
  headers?: { authorization?: string | string[] };
  supabase?: SupabaseClient;
  supabaseUser?: unknown;
  user?: unknown;
}

export declare function createRequestSupabaseClient(req: RequestWithSupabase): SupabaseClient;
export declare function getRequestSupabaseClient(req: RequestWithSupabase): SupabaseClient;
export declare function createServerSupabaseClient(serviceKey?: string): SupabaseClient;
//# sourceMappingURL=supabase.d.ts.map