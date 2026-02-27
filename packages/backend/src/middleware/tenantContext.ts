import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AsyncLocalStorage } from "async_hooks";
import { createLogger } from "@shared/lib/logger";
import {
  getUserTenantId,
  verifyTenantExists,
  verifyTenantMembership,
} from "@shared/lib/tenantVerification";
import { validateEnv } from "../config/validateEnv.js"

const logger = createLogger({ component: "TenantContextMiddleware" });
const DEFAULT_TCT_SECRET = "default-tct-secret-change-me";

const assertValidTctSecret = (): string => {
  const secret = process.env.TCT_SECRET || DEFAULT_TCT_SECRET;
  const nodeEnv = process.env.NODE_ENV ?? "development";
  // Require explicit TCT_SECRET in all non-development environments
  if (nodeEnv !== "development" && secret === DEFAULT_TCT_SECRET) {
    validateEnv();
    throw new Error("TCT_SECRET must be configured in non-development environments.");
  }
  return secret;
};

export interface TCTPayload {
  iss: string;
  sub: string;
  tid: string;
  roles: string[];
  tier: string;
  exp: number;
}

export const tenantContextStorage = new AsyncLocalStorage<TCTPayload>();

type TenantCandidateSource = "tct" | "service-header" | "user-claim" | "user-lookup" | "request" | "none";

type TenantContextUser = {
  role?: string | string[];
  app_metadata?: { roles?: unknown; tier?: string };
};

const resolveRoles = (user: TenantContextUser | undefined): string[] => {
  const directRole = user?.role;
  if (Array.isArray(directRole)) {
    return directRole.filter((role) => typeof role === "string");
  }
  if (typeof directRole === "string" && directRole.length > 0) {
    return [directRole];
  }
  const metadataRoles = user?.app_metadata?.roles;
  if (Array.isArray(metadataRoles)) {
    return metadataRoles.filter((role: unknown) => typeof role === "string");
  }
  return [];
};

const buildRequestContext = (
  tenantId: string,
  req: Request,
  userId?: string | null
): TCTPayload => {
  const user = (req as any).user;
  const session = (req as any).session;
  const roles = resolveRoles(user);
  const exp =
    (session?.expires_at as number | undefined) ??
    (session?.expires_in
      ? Math.floor(Date.now() / 1000) + Number(session.expires_in)
      : undefined) ??
    Math.floor(Date.now() / 1000) + 3600;

  return {
    iss: "jwt",
    sub: userId || "service",
    tid: tenantId,
    roles,
    tier: user?.app_metadata?.tier ?? "unknown",
    exp,
  };
};

/**
 * Middleware to extract and verify Tenant Context Token (TCT)
 */
export const tenantContextMiddleware = (enforce = true) => {
  const tctSecret = assertValidTctSecret();

  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers["x-tenant-context"];
    const userId = (req as any).user?.id as string | undefined;
    let tenantSource: TenantCandidateSource = "none";
    let resolvedTenantId: string | null = null;
    let tctPayload: TCTPayload | null = null;

    if (authHeader) {
      const token = Array.isArray(authHeader) ? authHeader[0] ?? '' : authHeader;

      try {
        tctPayload = jwt.verify(token, tctSecret, { algorithms: ["HS256"] }) as unknown as TCTPayload;
        const requestTenantId = (req as any).tenantId as string | undefined;

        if (requestTenantId && tctPayload.tid !== requestTenantId) {
          logger.warn("Tenant context tenant mismatch", {
            expected: requestTenantId,
            received: tctPayload.tid,
          });
          return res.status(403).json({ error: "Tenant context mismatch" });
        }

        if (userId && tctPayload.sub !== userId) {
          logger.warn("Tenant context user mismatch", {
            expected: userId,
            received: tctPayload.sub,
          });
          return res.status(403).json({ error: "Tenant context mismatch" });
        }

        resolvedTenantId = tctPayload.tid;
        tenantSource = "tct";
      } catch (error) {
        logger.error("Invalid TCT", error);
        if (enforce) {
          return res.status(401).json({ error: "Invalid Tenant Context Token" });
        }
        return next();
      }
    }

    if (!resolvedTenantId) {
      const tenantHeader = req.header("x-tenant-id");
      if (tenantHeader) {
        if (!(req as any).serviceIdentityVerified) {
          logger.warn("Blocked external tenant header usage", {
            userId,
            path: req.path,
          });
          return res.status(403).json({
            error: "Forbidden",
            message: "Tenant header is restricted to internal service requests.",
          });
        }
        resolvedTenantId = tenantHeader;
        tenantSource = "service-header";
      }
    }

    if (!resolvedTenantId) {
      const claimTenantId = (req as any).user?.tenant_id || (req as any).user?.organization_id;
      if (claimTenantId) {
        resolvedTenantId = claimTenantId;
        tenantSource = "user-claim";
      }
    }

    if (!resolvedTenantId) {
      const routeTenantId = (req.params as { tenantId?: string } | undefined)?.tenantId;
      if (routeTenantId) {
        resolvedTenantId = routeTenantId;
        tenantSource = "request";
      }
    }

    if (!resolvedTenantId && userId) {
      const userTenantId = await getUserTenantId(userId);
      if (userTenantId) {
        resolvedTenantId = userTenantId;
        tenantSource = "user-lookup";
      }
    }

    if (!resolvedTenantId) {
      if (enforce) {
        return res.status(403).json({
          error: "tenant_required",
          message: "Tenant context is required.",
        });
      }
      return next();
    }

    const tenantExists = await verifyTenantExists(resolvedTenantId);
    if (!tenantExists) {
      logger.warn("Tenant context resolved to inactive or unknown tenant", {
        userId,
        tenantId: resolvedTenantId,
        source: tenantSource,
      });
      return res.status(404).json({
        error: "Not Found",
        message: "Tenant not found or inactive.",
      });
    }

    const membershipUserId = tctPayload?.sub ?? userId;
    if (membershipUserId) {
      const isMember = await verifyTenantMembership(membershipUserId, resolvedTenantId);
      if (!isMember) {
        logger.warn("Tenant membership verification failed", {
          userId: membershipUserId,
          tenantId: resolvedTenantId,
          source: tenantSource,
        });
        return res.status(404).json({
          error: "Not Found",
          message: "Resource not found.",
        });
      }
    } else if (enforce) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Tenant membership could not be verified.",
      });
    }

    const attachContext = () => {
      (req as any).tenantId = resolvedTenantId;
      (req as any).tenantSource = tenantSource;
      next();
    };

    const contextPayload = tctPayload ?? buildRequestContext(resolvedTenantId, req, membershipUserId);
    tenantContextStorage.run(contextPayload, () => {
      (req as any).tenantContext = contextPayload;
      attachContext();
    });
  };
};

/**
 * Helper to get current tenant context
 */
export const getCurrentTenantContext = (): TCTPayload | undefined => {
  return tenantContextStorage.getStore();
};
