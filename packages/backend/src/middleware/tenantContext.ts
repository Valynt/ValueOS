import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AsyncLocalStorage } from "async_hooks";
import { createLogger } from "@shared/lib/logger";

const logger = createLogger({ component: "TenantContextMiddleware" });
const tctSecret = process.env.TCT_SECRET || "default-tct-secret-change-me";

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
