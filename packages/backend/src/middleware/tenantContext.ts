import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AsyncLocalStorage } from "async_hooks";
import { createLogger } from "@shared/lib/logger";
import {
  getUserTenantId,
  verifyTenantExists,
  verifyTenantMembership,
} from "@shared/lib/tenantVerification";

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
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader =
      req.header?.("x-tenant-context") ?? req.headers["x-tenant-context"];

    if (authHeader) {
      const token = Array.isArray(authHeader) ? authHeader[0] : authHeader;

      try {
        const decoded = jwt.verify(token, tctSecret) as TCTPayload;

        // Store in AsyncLocalStorage for propagation
        tenantContextStorage.run(decoded, () => {
          // Also attach to request for convenience
          (req as any).tenantContext = decoded;
          (req as any).tenantId = decoded.tid;
          (req as any).tenantSource = "tct";
          next();
        });
      } catch (error) {
        logger.error("Invalid TCT", error);
        if (enforce) {
          return res.status(401).json({ error: "Invalid Tenant Context Token" });
        }
        next();
      }
      return;
    }

    const user = (req as any).user;
    if (!user) {
      return next();
    }

    const tenantHeader =
      req.header?.("x-tenant-id") ?? req.headers["x-tenant-id"];
    let tenantId: string | undefined;
    let tenantSource: string | undefined;

    if (tenantHeader) {
      if (!(req as any).serviceIdentityVerified) {
        return res.status(403).json({
          error: "Forbidden",
          message: "Tenant header is restricted to internal service requests.",
        });
      }

      tenantId = Array.isArray(tenantHeader) ? tenantHeader[0] : tenantHeader;
      tenantSource = "service-header";
    } else if ((req as any).tenantId) {
      tenantId = (req as any).tenantId;
      tenantSource = "auth";
    } else if (user?.tenant_id) {
      tenantId = user.tenant_id;
      tenantSource = "user";
    }

    if (!tenantId && user?.id) {
      tenantId = (await getUserTenantId(user.id)) ?? undefined;
      tenantSource = tenantId ? "user-lookup" : undefined;
    }

    if (!tenantId) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Tenant context is required.",
      });
    }

    const tenantExists = await verifyTenantExists(tenantId);
    if (!tenantExists) {
      return res.status(404).json({
        error: "Not Found",
        message: "Tenant not found or inactive.",
      });
    }

    const belongsToTenant = await verifyTenantMembership(user.id, tenantId);
    if (!belongsToTenant) {
      return res.status(403).json({
        error: "Forbidden",
        message: "User does not belong to tenant.",
      });
    }

    (req as any).tenantId = tenantId;
    (req as any).tenantSource = tenantSource;
    next();
  };
};

/**
 * Helper to get current tenant context
 */
export const getCurrentTenantContext = (): TCTPayload | undefined => {
  return tenantContextStorage.getStore();
};
