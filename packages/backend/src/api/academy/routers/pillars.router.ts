/**
 * Pillars Router
 * Handles VOS pillar content and metadata with tenant isolation
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { RequestScopedRlsSupabaseClient } from "@shared/lib/supabase";
import { logger } from "../../../lib/logger.js";
import { protectedProcedure, publicProcedure, router } from "../trpc.js";
// service-role:justified worker/service requires elevated DB access for background processing
import { getSupabaseClient } from "../utils.js";

// ============================================================================
// Types
// ============================================================================

export interface Pillar {
  id: number;
  number: number;
  title: string;
  description: string;
  icon: string;
  color: string;
}

// ============================================================================
// Database operations
// ============================================================================

async function getAllPillarsFromDB(client: RequestScopedRlsSupabaseClient): Promise<Pillar[]> {
  const { data, error } = await client
    .from("academy_pillars")
    .select("id, number, title, description, icon, color")
    .order("number");

  if (error) {
    logger.error("Failed to fetch pillars", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to fetch pillars",
    });
  }

  return data || [];
}

async function getPillarByNumberFromDB(
  client: RequestScopedRlsSupabaseClient,
  number: number
): Promise<Pillar | null> {
  const { data, error } = await client
    .from("academy_pillars")
    .select("id, number, title, description, icon, color")
    .eq("number", number)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null; // Not found
    }
    logger.error("Failed to fetch pillar by number", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to fetch pillar",
    });
  }

  return data;
}

async function getPillarByIdFromDB(
  client: RequestScopedRlsSupabaseClient,
  id: number
): Promise<Pillar | null> {
  const { data, error } = await client
    .from("academy_pillars")
    .select("id, number, title, description, icon, color")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null; // Not found
    }
    logger.error("Failed to fetch pillar by id", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to fetch pillar",
    });
  }

  return data;
}

// ============================================================================
// Router
// ============================================================================

export const pillarsRouter = router({
  /**
   * Get all pillars
   */
  list: publicProcedure.query(async ({ ctx }) => {
    const client = getSupabaseClient(ctx);
    return await getAllPillarsFromDB(client);
  }),

  /**
   * Get pillar by ID
   */
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const client = getSupabaseClient(ctx);
      const pillar = await getPillarByIdFromDB(client, input.id);
      if (!pillar) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Pillar with id ${input.id} not found`,
        });
      }
      return pillar;
    }),

  /**
   * Get pillar by number (1-10)
   */
  getByNumber: publicProcedure
    .input(z.object({ pillarNumber: z.number() }))
    .query(async ({ input, ctx }) => {
      const client = getSupabaseClient(ctx);
      const pillar = await getPillarByNumberFromDB(client, input.pillarNumber);
      if (!pillar) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Pillar with number ${input.pillarNumber} not found`,
        });
      }
      return pillar;
    }),

  /**
   * Get pillar content (protected - requires auth)
   * Fetches modules, lessons, and resources from database with tenant isolation
   */
  getContent: protectedProcedure
    .input(z.object({ pillarId: z.number() }))
    .query(async ({ input, ctx }) => {
      const client = getSupabaseClient(ctx);
      const pillar = await getPillarByIdFromDB(client, input.pillarId);
      if (!pillar) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Pillar with id ${input.pillarId} not found`,
        });
      }

      // Fetch modules and lessons from global tables
      const { data: modulesData, error: modulesError } = await client
        .from("academy_modules")
        .select(`
          id,
          pillar,
          title,
          description,
          display_order,
          estimated_minutes,
          academy_lessons (
            id,
            module_id,
            title,
            description,
            content_type,
            display_order,
            estimated_minutes,
            sdui_components,
            prerequisites,
            tracks,
            lab_config,
            quiz_config
          )
        `)
        .eq("pillar", input.pillarId.toString())
        .order("display_order");

      if (modulesError) {
        logger.error("Failed to fetch modules", modulesError);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch modules",
        });
      }

      // Fetch user progress for this pillar with tenant isolation
      const lessonIds = (modulesData || [])
        .flatMap((m) => m.academy_lessons || [])
        .map((l) => l.id);

      let progressData: Record<string, { status: string; completed_at: string | null }> = {};
      if (lessonIds.length > 0 && ctx.tenantId) {
        const { data: progress, error: progressError } = await client
          .from("academy_progress")
          .select("lesson_id, status, completed_at")
          .eq("organization_id", ctx.tenantId)
          .eq("user_id", ctx.user.id)
          .in("lesson_id", lessonIds);

        if (progressError) {
          logger.error("Failed to fetch progress", progressError);
        }

        if (!progressError && progress) {
          progressData = Object.fromEntries(
            progress.map((p) => [p.lesson_id, { status: p.status, completed_at: p.completed_at }])
          );
        }
      }

      // Transform modules with lessons and progress
      const modules = (modulesData || []).map((m) => ({
        id: m.id,
        pillar: parseInt(m.pillar),
        title: m.title,
        description: m.description,
        order: m.display_order,
        estimatedMinutes: m.estimated_minutes,
        lessons: (m.academy_lessons || []).map((l) => ({
          id: l.id,
          moduleId: m.id,
          title: l.title,
          description: l.description,
          contentType: l.content_type,
          order: l.display_order,
          estimatedMinutes: l.estimated_minutes,
          sduiComponents: l.sdui_components || [],
          prerequisites: l.prerequisites || [],
          tracks: l.tracks || [],
          labConfig: l.lab_config,
          quizConfig: l.quiz_config,
          progress: progressData[l.id] || { status: "not_started", completedAt: null },
        })),
      }));

      // Fetch linked resources (global table, filtered by pillar)
      const { data: resourcesData, error: resourcesError } = await client
        .from("resource_artifacts")
        .select("*")
        .contains("linked_pillars", [input.pillarId])
        .eq("deprecated", false)
        .order("name");

      if (resourcesError) {
        logger.error("Failed to fetch resources", resourcesError);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch resources",
        });
      }

      const resources = (resourcesData || []).map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        lifecycleStage: r.lifecycle_stage,
        type: r.artifact_type,
        fileUrl: r.file_url,
        version: r.version,
        deprecated: r.deprecated,
        replacedBy: r.replaced_by,
        linkedPillars: r.linked_pillars || [],
        governanceRequired: r.governance_required,
        integrityAgentValidated: r.integrity_validated,
      }));

      logger.info("[Academy] Pillar content fetched", {
        pillarId: input.pillarId,
        userId: ctx.user.id,
        moduleCount: modules.length,
        resourceCount: resources.length,
      });

      return {
        ...pillar,
        modules,
        resources,
      };
    }),
});
