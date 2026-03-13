import { randomUUID } from "crypto";

import { runWithContext } from "@shared/lib/context";
import { logger } from "@shared/lib/logger";
import { sanitizeForLogging } from "@shared/lib/piiFilter";
import { NextFunction, Request, Response } from "express";

import { getTraceContextForLogging } from "../config/telemetry.js";
import { securityAuditService } from "../services/SecurityAuditService.js";
import { AUDIT_ACTION, AuditAction } from "../types/audit.js";

const DEFAULT_IGNORED_PATHS = ["/health", "/metrics"];

function getNormalizedRequestPath(req: Request): string {
  const base = req.baseUrl || "";
  const path = req.path || "";
  const combined = `${base}${path}`;

  if (combined) {
    return combined;
  }

  const original = req.originalUrl || "";
  const [originalPath] = original.split("?");
  return originalPath || "/";
}

function getRequestId(req: Request): string {
  const headerId = req.headers["x-request-id"];
  if (Array.isArray(headerId)) {
    return headerId[0];
  }
  return (headerId as string) || randomUUID();
}

function getActor(req: Request): { id?: string; label: string } {
  const anyReq = req as Request & { user?: { id?: string; email?: string; name?: string } };
  const user = anyReq.user || {};
  const headerActor = (req.headers["x-user-email"] as string) || (req.headers["x-actor"] as string);
  const label = user.email || user.name || headerActor || "anonymous";

  return {
    id: user.id || undefined,
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
  const normalizedPath = getNormalizedRequestPath(req);
  await securityAuditService.logRequestEvent({
    requestId: (res.locals.requestId as string) || (req.requestId as string) || getRequestId(req),
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
      org: sanitizeForLogging(
        (req.headers["x-organization-id"] as string) || (req as Request & { organizationId?: string }).organizationId
      ),
      tenantId: sanitizeForLogging(req.tenantId),
      routeParams: sanitizeForLogging(req.params),
      query: sanitizeForLogging(req.query),
      ...eventData,
    },
  });
}

export function requestAuditMiddleware(options?: { ignoredPaths?: string[] }) {
  const ignoredPaths = options?.ignoredPaths || DEFAULT_IGNORED_PATHS;

  return (req: Request, res: Response, next: NextFunction) => {
    if ((req as Request & { _auditMiddlewareAttached?: boolean })._auditMiddlewareAttached) {
      return next();
    }

    (req as Request & { _auditMiddlewareAttached?: boolean })._auditMiddlewareAttached = true;

    const requestId = (req.requestId as string | undefined) || getRequestId(req);
    res.locals.requestId = requestId;
    req.requestId = requestId;
    res.setHeader("X-Request-ID", requestId);

    const requestPath = getNormalizedRequestPath(req);
    if (ignoredPaths.some((path) => requestPath.startsWith(path)) || !requestPath.startsWith("/api/")) {
      return next();
    }

    const startedAt = Date.now();

    const context = {
      requestId,
      userId: req.user?.id,
      ...getTraceContextForLogging(),
    };

    runWithContext(context, () => {
      res.on("finish", async () => {
        try {
          await emitRequestAuditEvent(req, res, AUDIT_ACTION.API_REQUEST, "api.request", {
            duration_ms: Date.now() - startedAt,
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
