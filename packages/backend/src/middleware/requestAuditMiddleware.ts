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
}

import { getTraceContextForLogging } from "../config/telemetry.js";
import { securityAuditService } from "../services/security/SecurityAuditService.js";



const DEFAULT_IGNORED_PATHS = ["/health", "/metrics"];

function getRequestId(req: Request): string {
  const headerId = req.headers["x-request-id"];
  if (Array.isArray(headerId)) {
    return headerId[0];
  }
  return (headerId as string) || randomUUID();
}

function getActor(req: Request): { id?: string; label: string } {
  const anyReq = req as AuditRequest;
  const user = anyReq.user || {};
  const headerActor = (req.headers["x-user-email"] as string) || (req.headers["x-actor"] as string);
  const label = user.email || user.name || headerActor || "anonymous";

  return {
    id: user.id || undefined,
    label: sanitizeForLogging(label) as string,
  };
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
              org: sanitizeForLogging(
                (req.headers["x-organization-id"] as string) || (req as AuditRequest).organizationId
              ),
              tenantId: sanitizeForLogging((req as AuditRequest).tenantId),
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
