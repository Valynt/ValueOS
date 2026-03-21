import { createExpressMiddleware } from "@trpc/server/adapters/express";
import type { Request, Response } from "express";

import { appRouter } from "./index.js";
import type { AppTrpcContext } from "./trpc.js";

export function createAppTrpcContext({
  req,
  res,
}: {
  req: Request;
  res: Response;
}): AppTrpcContext {
  return {
    req,
    res,
    user: req.user
      ? {
          id: req.user.id,
          email: req.user.email,
          organizationId:
            typeof req.organizationId === "string"
              ? req.organizationId
              : typeof req.user.organization_id === "string"
                ? req.user.organization_id
                : undefined,
          tenantId:
            typeof req.tenantId === "string"
              ? req.tenantId
              : typeof req.user.tenant_id === "string"
                ? req.user.tenant_id
                : undefined,
          role: typeof req.user.role === "string" ? req.user.role : undefined,
          roles: Array.isArray(req.user.roles)
            ? req.user.roles.filter((role): role is string => typeof role === "string")
            : [],
          userMetadata: req.user.user_metadata
            ? {
                fullName:
                  typeof req.user.user_metadata.full_name === "string"
                    ? req.user.user_metadata.full_name
                    : undefined,
                name:
                  typeof req.user.user_metadata.name === "string"
                    ? req.user.user_metadata.name
                    : undefined,
                avatarUrl:
                  typeof req.user.user_metadata.avatar_url === "string"
                    ? req.user.user_metadata.avatar_url
                    : undefined,
                role:
                  typeof req.user.user_metadata.role === "string"
                    ? req.user.user_metadata.role
                    : undefined,
              }
            : undefined,
        }
      : null,
    tenantId: typeof req.tenantId === "string" ? req.tenantId : undefined,
    supabase: req.supabase,
  };
}

export const appTrpcMiddleware = createExpressMiddleware({
  router: appRouter,
  createContext: createAppTrpcContext,
});
