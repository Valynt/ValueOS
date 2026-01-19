import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AsyncLocalStorage } from "async_hooks";
import { createLogger } from "@shared/lib/logger";
import {
  getUserTenantId,
  verifyTenantExists,
  verifyTenantMembership,
} from "@shared/lib/tenantVerification";
import { validateEnv } from "../config/validateEnv";

const logger = createLogger({ component: "TenantContextMiddleware" });
const DEFAULT_TCT_SECRET = "default-tct-secret-change-me";
const LEGACY_DEFAULT_TCT_SECRET = "default-jwt-secret-replace-me-in-production";
const INVALID_TCT_SECRETS = new Set([DEFAULT_TCT_SECRET, LEGACY_DEFAULT_TCT_SECRET]);
const TCT_ERROR_MESSAGE = "TCT_SECRET must be configured and cannot use the default placeholder in production";

const resolveTctSecret = (): string => process.env.TCT_SECRET || DEFAULT_TCT_SECRET;

const assertValidTctSecret = (): string => {
  const { errors } = validateEnv();
  const hasTctError = errors.some((error) => error.includes("TCT_SECRET"));
  if (hasTctError) {
    const message =
      "TCT_SECRET must be configured and cannot use the default placeholder in production";
    logger.error(message);
    throw new Error(message);
  }

  const secret = resolveTctSecret();
  if (process.env.NODE_ENV === "production" && INVALID_TCT_SECRETS.has(secret)) {
    const message =
      "TCT_SECRET must be configured and cannot use the default placeholder in production";
    logger.error(message);
    throw new Error(message);
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
      const token = Array.isArray(authHeader) ? authHeader[0] : authHeader;

      try {
        tctPayload = jwt.verify(token, tctSecret) as TCTPayload;
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
        return res.status(403).json({
          error: "Forbidden",
          message: "User does not belong to tenant.",
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

    if (tctPayload) {
      tenantContextStorage.run(tctPayload, () => {
        (req as any).tenantContext = tctPayload;
        attachContext();
      });
      return;
    }

    attachContext();
  };
};

/**
 * Helper to get current tenant context
 */
export const getCurrentTenantContext = (): TCTPayload | undefined => {
  return tenantContextStorage.getStore();
};
