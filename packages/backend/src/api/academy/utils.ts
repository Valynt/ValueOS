/**
 * Academy API Utilities
 * Shared helpers for tRPC academy routers
 */
import { TRPCError } from "@trpc/server";
import { createRequestSupabaseClient, type RequestScopedRlsSupabaseClient } from "@shared/lib/supabase";

/**
 * Get Supabase client from context or create from access token
 */
export function getSupabaseClient(ctx: { supabase?: RequestScopedRlsSupabaseClient; accessToken?: string }) {
  if (ctx.supabase) {
    return ctx.supabase;
  }
  if (ctx.accessToken) {
    return createRequestSupabaseClient({ accessToken: ctx.accessToken });
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "No Supabase client available",
  });
}
