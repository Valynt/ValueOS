import { Request, Response, NextFunction } from "express";
import { createLogger } from "@shared/lib/logger";
import {
  getUserTenantId,
  verifyTenantExists,
  verifyTenantMembership,
} from "@shared/lib/tenantVerification";

const logger = createLogger({ component: "TenantContextMiddleware" });

type TenantSource = "service-header" | "user-claim" | "user-lookup" | "route-param";

interface TenantRequest extends Request {
  tenantId?: string;
  tenantSource?: TenantSource;
  serviceIdentityVerified?: boolean;
  user?: { id?: string; tenant_id?: string };
}

/**
 * Middleware to resolve tenant context from X-Tenant-Id and user claims.
 */
export const tenantContextMiddleware = (enforce = true) => {
  return async (req: TenantRequest, res: Response, next: NextFunction) => {
    const headerTenant = req.header("x-tenant-id")?.trim();
    const routeTenant = req.params?.tenantId as string | undefined;

    let tenantId: string | undefined;
    let tenantSource: TenantSource | undefined;

    if (headerTenant) {
      if (!req.serviceIdentityVerified) {
        return res.status(403).json({
          error: "Forbidden",
          message: "Tenant header is restricted to internal service requests.",
        });
      }
      tenantId = headerTenant;
      tenantSource = "service-header";
    } else if (routeTenant) {
      tenantId = routeTenant;
      tenantSource = "route-param";
    } else if (req.user?.tenant_id) {
      tenantId = req.user.tenant_id;
      tenantSource = "user-claim";
    } else if (req.user?.id) {
      const lookupTenant = await getUserTenantId(req.user.id);
      if (lookupTenant) {
        tenantId = lookupTenant;
        tenantSource = "user-lookup";
      }
    }

    if (!tenantId) {
      if (!enforce) {
        return next();
      }
      return next();
    }

    const tenantExists = await verifyTenantExists(tenantId);
    if (!tenantExists) {
      return res.status(404).json({
        error: "Not Found",
        message: "Tenant not found or inactive.",
      });
    }

    if (req.user?.id) {
      const belongsToTenant = await verifyTenantMembership(req.user.id, tenantId);
      if (!belongsToTenant) {
        return res.status(403).json({
          error: "Forbidden",
          message: "User does not belong to tenant.",
        });
      }
    }

    req.tenantId = tenantId;
    req.tenantSource = tenantSource;
    logger.debug("Tenant context resolved", { tenantId, tenantSource });
    return next();
  };
};
