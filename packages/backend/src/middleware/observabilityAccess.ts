import { NextFunction, Request, Response } from "express";

import { auditLogService } from "../services/security/AuditLogService.js";

export function requireObservabilityAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tenantId = req.tenantId ?? req.user?.tenant_id;
    const requestedTenantId = typeof req.query.tenantId === "string" ? req.query.tenantId : tenantId;
    const requestedEnvironment = typeof req.query.environment === "string" ? req.query.environment : process.env.NODE_ENV;
    const roleSet = new Set((req.user?.roles ?? []).map((role) => role.toLowerCase()));

    const hasObservabilityRole = roleSet.has("admin") || roleSet.has("platform_operator") || roleSet.has("security_analyst");
    const allowedEnvironments = new Set(["development", "staging"]);
    if (roleSet.has("admin") || roleSet.has("platform_operator")) {
      allowedEnvironments.add("production");
    }

    const tenantAllowed = Boolean(tenantId && requestedTenantId && tenantId === requestedTenantId);
    const environmentAllowed = Boolean(requestedEnvironment && allowedEnvironments.has(requestedEnvironment));

    if (!hasObservabilityRole || !tenantAllowed || !environmentAllowed) {
      if (tenantId) {
        await auditLogService.logAudit({
          userId: req.user?.id ?? "system",
          userName: req.user?.email ?? "unknown",
          userEmail: req.user?.email ?? "unknown@valueos.local",
          action: "observability_access_denied",
          resourceType: "observability",
          resourceId: requestedTenantId ?? "unknown",
          status: "failed",
          requestPath: req.path,
          ipAddress: req.ip,
          userAgent: req.get("user-agent") ?? undefined,
          correlationId: req.requestId,
          details: {
            required_scope: { tenant: tenantId, environment: Array.from(allowedEnvironments) },
            requested_scope: { tenant: requestedTenantId, environment: requestedEnvironment },
            roles: Array.from(roleSet),
          },
        });
      }

      res.status(403).json({
        error: "Forbidden",
        message: "Observability access requires tenant-scoped role and environment entitlement",
      });
      return;
    }

    next();
  };
}
