import { randomUUID } from "crypto";

import { runWithContext } from "@shared/lib/context";
import { logger } from "@shared/lib/logger";
import { sanitizeForLogging } from "@shared/lib/piiFilter";
import { NextFunction, Request, Response } from "express";

import type { AuthenticatedRequest } from "./auth.js";

interface AuditRequest extends AuthenticatedRequest {
  _auditMiddlewareAttached?: boolean;
  requestId?: string;
  organizationId?: string;
  tenantId?: string;
}

import { getTraceContextForLogging } from "../config/telemetry.js";
import { securityAuditService } from "../services/post-v1/SecurityAuditService.js";
import type { AuditAction } from "../types/audit.js";



const DEFAULT_IGNORED_PATHS = ["/health", "/metrics"];

function getRequestId(req: Request): string {
  const headerId = req.headers["x-request-id"];
  if (Array.isArray(headerId)) {
    return headerId[0];
  }
  return (headerId as string) || randomUUID();
}

function getTrustedOrganizationId(req: Request): string | undefined {
  const auditReq = req as AuditRequest;
  return (
    auditReq.organizationId ??
    (typeof auditReq.user?.organization_id === "string" ? auditReq.user.organization_id : undefined) ??
    auditReq.tenantId ??
    (typeof auditReq.user?.tenant_id === "string" ? auditReq.user.tenant_id : undefined)
  );
}

function getTrustedTenantId(req: Request): string | undefined {
  const auditReq = req as AuditRequest;
  return (
    auditReq.tenantId ??
    auditReq.organizationId ??
    (typeof auditReq.user?.tenant_id === "string" ? auditReq.user.tenant_id : undefined) ??
    (typeof auditReq.user?.organization_id === "string" ? auditReq.user.organization_id : undefined)
  );
}

function getActor(req: Request): { id?: string; label: string } {
  // Actor identity must come exclusively from verified JWT claims on req.user.
  // x-user-email and x-actor headers are caller-controlled and must not be
  // trusted for audit attribution.
  const user = (req as AuditRequest).user ?? {};
  const label = (user.email as string | undefined)
    ?? (user.name as string | undefined)
    ?? "anonymous";

  return {
    id: user.id ?? undefined,
    label: sanitizeForLogging(label) as string,
  };
}

export async function emitRequestAuditEvent(
  req: Request,
  res: Response,
  action: AuditAction,
  eventType: string,
  eventData?: Record<string, unknown>
): Promise<void> {
  const actor = getActor(req);
  const normalizedPath = (req as AuditRequest).path || req.originalUrl;
  await securityAuditService.logRequestEvent({
    requestId: (res.locals.requestId as string) || (req as AuditRequest).requestId || getRequestId(req),
    userId: actor.id,
    actor: actor.label,
    action,
    resource: sanitizeForLogging(normalizedPath) as string,
    requestPath: sanitizeForLogging(normalizedPath) as string,
    ipAddress: req.ip || req.socket.remoteAddress || undefined,
    userAgent: req.get("user-agent") || undefined,
    statusCode: res.statusCode,
    severity: res.statusCode >= 500 ? "high" : "medium",
    eventType,
    eventData: {
      method: req.method,
      org: sanitizeForLogging(getTrustedOrganizationId(req)),
      tenantId: sanitizeForLogging(getTrustedTenantId(req)),
      routeParams: sanitizeForLogging(req.params),
      query: sanitizeForLogging(req.query),
      ...eventData,
    },
  });
}

export function requestAuditMiddleware(options?: { ignoredPaths?: string[] }) {
  const ignoredPaths = options?.ignoredPaths || DEFAULT_IGNORED_PATHS;

  return (req: Request, res: Response, next: NextFunction) => {
    if ((req as AuditRequest)._auditMiddlewareAttached) {
      return next();
    }

    (req as AuditRequest)._auditMiddlewareAttached = true;

    if (ignoredPaths.some((path) => req.path.startsWith(path))) {
      const ignoredRequestId = getRequestId(req);
      res.locals.requestId = ignoredRequestId;
      (req as AuditRequest).requestId = ignoredRequestId;
      res.setHeader("X-Request-Id", ignoredRequestId);
      return next();
    }

    const requestId = getRequestId(req);
    const startedAt = Date.now();

    res.locals.requestId = requestId;
    (req as AuditRequest).requestId = requestId;
    res.setHeader("X-Request-Id", requestId);

    // Prepare context
    const context = {
      requestId,
      userId: (req as AuditRequest).user?.id,
      ...getTraceContextForLogging(),
    };

    runWithContext(context, () => {
      res.on("finish", async () => {
        const actor = getActor(req);
        try {
          await securityAuditService.logRequestEvent({
            requestId,
            userId: actor.id,
            actor: actor.label,
            action: req.method.toLowerCase(),
            // Avoid persisting raw URLs that may include sensitive query strings.
            resource: sanitizeForLogging(req.baseUrl || req.path || req.originalUrl) as string,
            requestPath: sanitizeForLogging(req.path || req.originalUrl) as string,
            ipAddress: req.ip || req.socket.remoteAddress || undefined,
            userAgent: req.get("user-agent") || undefined,
            statusCode: res.statusCode,
            severity: res.statusCode >= 500 ? "high" : "medium",
            eventData: {
              duration_ms: Date.now() - startedAt,
              org: sanitizeForLogging(getTrustedOrganizationId(req)),
              tenantId: sanitizeForLogging(getTrustedTenantId(req)),
              routeParams: sanitizeForLogging(req.params),
              query: sanitizeForLogging(req.query),
            },
          });
        } catch (error) {
          logger.error("Failed to write request audit event", error as Error, {
            requestId,
          });
        }
      });

      next();
    });
  };
}
