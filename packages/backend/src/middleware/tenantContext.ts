import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AsyncLocalStorage } from "async_hooks";
import { createLogger } from "@shared/lib/logger";
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

/**
 * Middleware to extract and verify Tenant Context Token (TCT)
 */
export const tenantContextMiddleware = (enforce = true) => {
  const tctSecret = assertValidTctSecret();

  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers["x-tenant-context"];

    if (!authHeader) {
      if (enforce) {
        return res.status(401).json({ error: "Missing X-Tenant-Context header" });
      }
      return next();
    }

    const token = Array.isArray(authHeader) ? authHeader[0] : authHeader;

    try {
      const decoded = jwt.verify(token, tctSecret) as TCTPayload;
      const requestTenantId = (req as any).tenantId as string | undefined;
      const requestUserId = (req as any).user?.id as string | undefined;

      if (requestTenantId && decoded.tid !== requestTenantId) {
        logger.warn("Tenant context tenant mismatch", {
          expected: requestTenantId,
          received: decoded.tid,
        });
        return res.status(403).json({ error: "Tenant context mismatch" });
      }

      if (requestUserId && decoded.sub !== requestUserId) {
        logger.warn("Tenant context user mismatch", {
          expected: requestUserId,
          received: decoded.sub,
        });
        return res.status(403).json({ error: "Tenant context mismatch" });
      }

      // Store in AsyncLocalStorage for propagation
      tenantContextStorage.run(decoded, () => {
        // Also attach to request for convenience
        (req as any).tenantContext = decoded;
        next();
      });
    } catch (error) {
      logger.error("Invalid TCT", error);
      if (enforce) {
        return res.status(401).json({ error: "Invalid Tenant Context Token" });
      }
      next();
    }
  };
};

/**
 * Helper to get current tenant context
 */
export const getCurrentTenantContext = (): TCTPayload | undefined => {
  return tenantContextStorage.getStore();
};
