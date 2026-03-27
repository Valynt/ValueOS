// service-role:justified elevated DB access required for this service/worker
/**
 * Resources Router
 * Handles learning resources, templates, and downloadable content with tenant isolation
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createRequestSupabaseClient, type RequestScopedRlsSupabaseClient } from "@shared/lib/supabase";
import { logger } from "../../../lib/logger.js";
import { protectedProcedure, publicProcedure, router } from "../trpc.js";

// ============================================================================
// Types
// ============================================================================

interface Resource {
  id: number;
  title: string;
  description: string;
  type: string;
  url: string;
  pillarId: number | null;
  vosRole: string | null;
  createdAt: string;
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

async function getAllResources(
  client: RequestScopedRlsSupabaseClient
): Promise<Resource[]> {
  const { data, error } = await client
    .from("resources")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("Failed to get all resources", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to retrieve resources",
    });
  }

  return (data || []).map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    type: r.type,
    url: r.url,
    pillarId: r.pillar_id,
    vosRole: r.vos_role,
    createdAt: r.created_at,
  }));
}

async function getResourcesByPillar(
  client: RequestScopedRlsSupabaseClient,
  pillarId: number
): Promise<Resource[]> {
  const { data, error } = await client
    .from("resources")
    .select("*")
    .eq("pillar_id", pillarId)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("Failed to get resources by pillar", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to retrieve resources by pillar",
    });
  }

  return (data || []).map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    type: r.type,
    url: r.url,
    pillarId: r.pillar_id,
    vosRole: r.vos_role,
    createdAt: r.created_at,
  }));
}

async function getResourcesByRole(
  client: RequestScopedRlsSupabaseClient,
  vosRole: string
): Promise<Resource[]> {
  const { data, error } = await client
    .from("resources")
    .select("*")
    .eq("vos_role", vosRole)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("Failed to get resources by role", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to retrieve resources by role",
    });
  }

  return (data || []).map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    type: r.type,
    url: r.url,
    pillarId: r.pillar_id,
    vosRole: r.vos_role,
    createdAt: r.created_at,
  }));
}

// ============================================================================
// Router
// ============================================================================

export const resourcesRouter = router({
  /**
   * Get all resources
   */
  list: publicProcedure.query(async ({ ctx }) => {
    const client = getSupabaseClient(ctx);
    return await getAllResources(client);
  }),

  /**
   * Get resources for specific pillar
   */
  getByPillar: publicProcedure
    .input(z.object({ pillarId: z.number() }))
    .query(async ({ ctx, input }) => {
      const client = getSupabaseClient(ctx);
      return await getResourcesByPillar(client, input.pillarId);
    }),

  /**
   * Get resources for specific VOS role
   */
  getByRole: publicProcedure
    .input(z.object({ vosRole: z.string() }))
    .query(async ({ ctx, input }) => {
      const client = getSupabaseClient(ctx);
      return await getResourcesByRole(client, input.vosRole);
    }),

  /**
   * Track resource download
   */
  trackDownload: protectedProcedure
    .input(z.object({ resourceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const client = getSupabaseClient(ctx);

      const { error } = await client.from("resource_downloads").insert({
        user_id: ctx.user.id,
        resource_id: input.resourceId,
        organization_id: ctx.tenantId,
        downloaded_at: new Date().toISOString(),
      });

      if (error) {
        logger.error("[Academy] Failed to track resource download", {
          userId: ctx.user.id,
          resourceId: input.resourceId,
          error,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to track download",
        });
      }

      logger.info("[Academy] Resource download tracked", {
        userId: ctx.user.id,
        resourceId: input.resourceId,
      });

      return { success: true };
    }),
});
