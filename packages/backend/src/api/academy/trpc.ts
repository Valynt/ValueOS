/**
 * Academy tRPC Core
 * tRPC setup for VOSAcademy API migration
 */
import { initTRPC, TRPCError } from "@trpc/server";
import type { Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "../../lib/logger.js";

export interface AcademyContext {
  req: Request;
  res: Response;
  user: {
    id: string;
    email?: string;
    organizationId?: string;
  } | null;
  tenantId?: string;
  supabase?: SupabaseClient;
  accessToken?: string;
}

const t = initTRPC.context<AcademyContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

// Protected procedure - requires authentication
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    logger.warn("[Academy tRPC] Unauthorized access attempt", {
      path: ctx.req.path,
      ip: ctx.req.ip,
    });
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

// Tenant-scoped procedure - requires tenant context
export const tenantScopedProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const tenantId = ctx.user?.organizationId;
  if (!tenantId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Tenant context required",
    });
  }
  return next({
    ctx: {
      ...ctx,
      tenantId,
    },
  });
});
