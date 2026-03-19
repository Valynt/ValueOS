/**
 * Academy API Utilities
 * Shared helpers for tRPC academy routers
 */
import { TRPCError } from "@trpc/server";
import { createUserSupabaseClient } from "../../lib/supabase";

/**
 * Get Supabase client from context or create from access token
 */
export function getSupabaseClient(ctx: { supabase?: ReturnType<typeof createUserSupabaseClient>; accessToken?: string }) {
  if (ctx.supabase) {
    return ctx.supabase;
  }
  if (ctx.accessToken) {
    return createUserSupabaseClient(ctx.accessToken);
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "No Supabase client available",
  });
}
