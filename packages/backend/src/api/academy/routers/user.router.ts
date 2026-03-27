// service-role:justified elevated DB access required for this service/worker
/**
 * User Router
 * Handles user profile updates and preferences with tenant isolation
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createRequestSupabaseClient, type RequestScopedRlsSupabaseClient } from "@shared/lib/supabase";
import { logger } from "../../../lib/logger.js";
import { protectedProcedure, router } from "../trpc.js";

// ============================================================================
// Types
// ============================================================================

interface User {
  id: string;
  name: string | null;
  email: string | null;
  vosRole: string | null;
  maturityLevel: number | null;
}

// ============================================================================
// Helpers
// ============================================================================

function getSupabaseClient(ctx: { supabase?: RequestScopedRlsSupabaseClient; accessToken?: string }) {
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

// ============================================================================
// Database Operations
// ============================================================================

async function updateUserVosRole(
  client: RequestScopedRlsSupabaseClient,
  userId: string,
  vosRole: string
): Promise<void> {
  const { error } = await client.from("users").update({ vos_role: vosRole }).eq("id", userId);

  if (error) {
    logger.error("Failed to update user VOS role", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to update VOS role",
    });
  }
}

async function updateUserMaturityLevel(
  client: RequestScopedRlsSupabaseClient,
  userId: string,
  level: number
): Promise<void> {
  const { error } = await client.from("users").update({ maturity_level: level }).eq("id", userId);

  if (error) {
    logger.error("Failed to update user maturity level", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to update maturity level",
    });
  }
}

async function getUserById(
  client: RequestScopedRlsSupabaseClient,
  userId: string
): Promise<User | null> {
  const { data, error } = await client
    .from("users")
    .select("id, name, email, vos_role, maturity_level")
    .eq("id", userId)
    .single();

  if (error) {
    logger.error("Failed to get user", error);
    return null;
  }

  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    vosRole: data.vos_role,
    maturityLevel: data.maturity_level,
  };
}

// ============================================================================
// Router
// ============================================================================

export const userRouter = router({
  /**
   * Get current user profile
   */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const client = getSupabaseClient(ctx);
    return await getUserById(client, ctx.user.id);
  }),

  /**
   * Update user's VOS role
   */
  updateVosRole: protectedProcedure
    .input(
      z.object({
        vosRole: z.enum(["Sales", "CS", "Marketing", "Product", "Executive", "VE"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const client = getSupabaseClient(ctx);
      await updateUserVosRole(client, ctx.user.id, input.vosRole);
      return { success: true };
    }),

  /**
   * Update user's maturity level
   */
  updateMaturityLevel: protectedProcedure
    .input(
      z.object({
        level: z.number().min(0).max(5),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const client = getSupabaseClient(ctx);
      await updateUserMaturityLevel(client, ctx.user.id, input.level);
      return { success: true };
    }),
});
