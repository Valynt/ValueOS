import { AsyncLocalStorage } from "async_hooks";

import { getContext, runWithContext } from "@shared/lib/context";
import { createLogger } from "@shared/lib/logger";
import {
  getUserTenantId,
  verifyTenantExists,
  verifyTenantMembership,
} from "@shared/lib/tenantVerification";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { validateEnv } from "../config/validateEnv.js";

import type { AuthenticatedRequest } from "./auth.js";

// Extended request shape used internally by this middleware
interface TenantRequest extends AuthenticatedRequest {
  session?: { expires_at?: number; expires_in?: number };
  serviceIdentityVerified?: boolean;
  tenantSource?: string;
  tenantContext?: TCTPayload;
}

const logger = createLogger({ component: "TenantContextMiddleware" });
const DEFAULT_TCT_SECRET = "default-tct-secret-change-me";

const assertValidTctSecret = (): string => {
  const secret = process.env.TCT_SECRET || DEFAULT_TCT_SECRET;
  const nodeEnv = process.env.NODE_ENV ?? "development";
  // Require explicit TCT_SECRET in all non-development environments
  if (nodeEnv !== "development" && secret === DEFAULT_TCT_SECRET) {
    validateEnv();
    throw new Error(
      "TCT_SECRET must be configured in non-development environments."
    );
  }
  // SEC-010: Warn when using the default secret even in development —
  // tokens signed with the well-known default can be forged by any developer.
  // eslint-disable-next-line security/detect-possible-timing-attacks -- not a cryptographic comparison
  if (secret === DEFAULT_TCT_SECRET) {
    logger.warn(
      "TCT_SECRET is using the default value. Tokens can be trivially forged. " +
        "Set a unique TCT_SECRET in ops/env/.env.backend.local for local development.",
      { nodeEnv }
    );
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

type TenantCandidateSource =
  | "tct"
  | "service-header"
  | "user-claim"
  | "user-lookup"
  | "request"
  | "none";

type TenantContextUser = {
  role?: string | string[];
  app_metadata?: { roles?: unknown; tier?: string };
};

const resolveRoles = (user: TenantContextUser | undefined): string[] => {
  const directRole = user?.role;
  if (Array.isArray(directRole)) {
    return directRole.filter(role => typeof role === "string");
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

const isAgentScopedRequest = (req: Request): boolean => {
  const requestPath = `${req.baseUrl ?? ""}${req.path ?? ""}`;
  return (
    requestPath.startsWith("/api/agents") ||
    requestPath.startsWith("/api/groundtruth")
  );
};

const buildRequestContext = (
  tenantId: string,
  req: Request,
  userId?: string | null
): TCTPayload => {
  const user = (req as TenantRequest).user;
  const session = (req as TenantRequest).session;
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
    const userId = (req as TenantRequest).user?.id as string | undefined;
    let tenantSource: TenantCandidateSource = "none";
    let resolvedTenantId: string | null = null;
    let tctPayload: TCTPayload | null = null;

    if (authHeader) {
      const token = Array.isArray(authHeader)
        ? (authHeader[0] ?? "")
        : authHeader;

      try {
        tctPayload = jwt.verify(token, tctSecret, {
          algorithms: ["HS256"],
        }) as unknown as TCTPayload;
        const requestTenantId = (req as TenantRequest).tenantId as
          | string
          | undefined;

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
          return res
            .status(401)
            .json({ error: "Invalid Tenant Context Token" });
        }
        return next();
      }
    }

    if (!resolvedTenantId) {
      const tenantHeader = req.header("x-tenant-id");
      if (tenantHeader) {
        if (!(req as TenantRequest).serviceIdentityVerified) {
          logger.warn("Blocked external tenant header usage", {
            userId,
            path: req.path,
          });
          return res.status(403).json({
            error: "Forbidden",
            message:
              "Tenant header is restricted to internal service requests.",
          });
        }
        resolvedTenantId = tenantHeader;
        tenantSource = "service-header";
      }
    }

    const claimTenantId =
      (req as TenantRequest).user?.tenant_id ||
      (req as TenantRequest).user?.organization_id;
    if (!resolvedTenantId && claimTenantId) {
      resolvedTenantId = claimTenantId;
      tenantSource = "user-claim";
    }

    if (!resolvedTenantId) {
      const routeTenantId = (req.params as { tenantId?: string } | undefined)
        ?.tenantId;
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

    if (
      isAgentScopedRequest(req) &&
      claimTenantId &&
      resolvedTenantId &&
      claimTenantId !== resolvedTenantId
    ) {
      logger.warn("Agent request tenant diverges from authenticated claim", {
        claimTenantId,
        resolvedTenantId,
        path: req.path,
      });
      return res.status(403).json({
        error: "tenant_mismatch",
        message: "Tenant context must match authenticated tenant claim.",
      });
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
      const isMember = await verifyTenantMembership(
        membershipUserId,
        resolvedTenantId
      );
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
      (req as TenantRequest).tenantId = resolvedTenantId;
      (req as TenantRequest).tenantSource = tenantSource;
      next();
    };

    const contextPayload =
      tctPayload ??
      buildRequestContext(resolvedTenantId, req, membershipUserId);

    // Merge tenantId into the shared AsyncLocalStorage context so the logger
    // automatically includes it in every log entry for this request.
    const existingContext = getContext() ?? {};
    const sharedContext = { ...existingContext, tenantId: resolvedTenantId };

    tenantContextStorage.run(contextPayload, () => {
      (req as TenantRequest).tenantContext = contextPayload;
      runWithContext(sharedContext, attachContext);
    });
  };
};

/**
 * Helper to get current tenant context
 */
export const getCurrentTenantContext = (): TCTPayload | undefined => {
  return tenantContextStorage.getStore();
};
