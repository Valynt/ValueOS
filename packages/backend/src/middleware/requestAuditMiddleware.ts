import { randomUUID } from "crypto";

import { runWithContext } from "@shared/lib/context";
import { logger } from "@shared/lib/logger";
import { sanitizeForLogging } from "@shared/lib/piiFilter";
import { NextFunction, Request, Response } from "express";

import { getTraceContextForLogging } from "../config/telemetry.js";
import { securityAuditService } from "../services/SecurityAuditService.js";
import {
  extractAuditActorContext,
  extractAuditNetworkContext,
  extractAuditResourceContext,
  requiredAuditPayloadSchema,
} from "../services/security/auditPayloadContract.js";



const DEFAULT_IGNORED_PATHS = ["/health", "/metrics"];

function getRequestId(req: Request): string {
  const headerId = req.headers["x-request-id"];
  if (Array.isArray(headerId)) {
    return headerId[0];
  }
  return (headerId as string) || randomUUID();
}


export function requestAuditMiddleware(options?: { ignoredPaths?: string[] }) {
  const ignoredPaths = options?.ignoredPaths || DEFAULT_IGNORED_PATHS;

  return (req: Request, res: Response, next: NextFunction) => {
    if ((req as any)._auditMiddlewareAttached) {
      return next();
    }

    (req as any)._auditMiddlewareAttached = true;

    if (ignoredPaths.some((path) => req.path.startsWith(path))) {
      const ignoredRequestId = getRequestId(req);
      res.locals.requestId = ignoredRequestId;
      (req as any).requestId = ignoredRequestId;
      res.setHeader("X-Request-Id", ignoredRequestId);
      return next();
    }

    const requestId = getRequestId(req);
    const startedAt = Date.now();

    res.locals.requestId = requestId;
    (req as any).requestId = requestId;
    res.setHeader("X-Request-Id", requestId);

    // Prepare context
    const context = {
      requestId,
      userId: (req as any).user?.id,
      ...getTraceContextForLogging(),
    };

    runWithContext(context, () => {
      res.on("finish", async () => {
        const actorContext = extractAuditActorContext(req);
        const resourceContext = extractAuditResourceContext(req);
        const networkContext = extractAuditNetworkContext(req);
        const timestamp = new Date().toISOString();
        try {
          const payload = requiredAuditPayloadSchema.parse({
            actor: actorContext.actor,
            action_type: req.method.toLowerCase(),
            resource_type: sanitizeForLogging(req.baseUrl || req.path || req.originalUrl) as string,
            resource_id: resourceContext.resourceId,
            request_path: resourceContext.requestPath,
            ip_address: networkContext.ipAddress,
            user_agent: networkContext.userAgent,
            outcome: res.statusCode < 400 ? "success" : "failed",
            status_code: res.statusCode,
            timestamp,
            correlation_id: requestId,
          });

          await securityAuditService.logRequestEvent({
            ...payload,
            userId: actorContext.userId,
            severity: res.statusCode >= 500 ? "high" : "medium",
            eventData: {
              duration_ms: Date.now() - startedAt,
              org: sanitizeForLogging(
                (req.headers["x-organization-id"] as string) || (req as any).organizationId
              ),
              tenantId: sanitizeForLogging((req as any).tenantId),
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
