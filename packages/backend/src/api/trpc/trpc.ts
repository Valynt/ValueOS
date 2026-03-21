import { initTRPC, TRPCError } from "@trpc/server";
import type { Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "../../lib/logger.js";

export interface AppTrpcContext {
  req: Request;
  res: Response;
  user: {
    id: string;
    email?: string;
    organizationId?: string;
    tenantId?: string;
    role?: string;
    roles?: string[];
    userMetadata?: {
      fullName?: string;
      name?: string;
      avatarUrl?: string;
      role?: string;
    };
  } | null;
  tenantId?: string;
  supabase?: SupabaseClient;
}

const t = initTRPC.context<AppTrpcContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    logger.warn("[App tRPC] Unauthorized access attempt", {
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
