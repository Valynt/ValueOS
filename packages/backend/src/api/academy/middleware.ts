/**
 * Academy tRPC Middleware
 * Express middleware to handle tRPC requests for Academy API
 */
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import type { Request, Response } from "express";

import { createUserSupabaseClient } from "../../lib/supabase.js";
import { academyRouter } from "./index.js";
import type { AcademyContext } from "./trpc.js";

export function createAcademyContext({
  req,
  res,
}: {
  req: Request;
  res: Response;
}): AcademyContext {
  // Extract user from the request (set by auth middleware)
  const user = req.user
    ? {
        id: req.user.id,
        email: req.user.email,
        organizationId: req.organizationId,
      }
    : null;

  // Get user-scoped Supabase client for RLS enforcement
  let supabase = req.supabase;
  let accessToken: string | undefined;

  if (!supabase && req.session) {
    const token = (req.session as Record<string, unknown> | undefined)?.access_token;
    if (typeof token === "string") {
      accessToken = token;
      supabase = createUserSupabaseClient(token);
    }
  }

  return {
    req,
    res,
    user,
    tenantId: req.organizationId,
    supabase,
    accessToken,
  };
}

export const academyTrpcMiddleware = createExpressMiddleware({
  router: academyRouter,
  createContext: createAcademyContext,
});
