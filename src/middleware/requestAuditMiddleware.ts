import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { securityAuditService } from '../services/SecurityAuditService';
import { logger } from '../lib/logger';

const DEFAULT_IGNORED_PATHS = ['/health', '/metrics'];

function getRequestId(req: Request): string {
  const headerId = req.headers['x-request-id'];
  if (Array.isArray(headerId)) {
    return headerId[0];
  }
  return (headerId as string) || randomUUID();
}

function getActor(req: Request): { id?: string; label: string } {
  const anyReq = req as any;
  const user = anyReq.user || {};
  const headerActor = (req.headers['x-user-email'] as string) || (req.headers['x-actor'] as string);
  const label = user.email || user.name || headerActor || 'anonymous';

  return {
    id: user.id || undefined,
    label,
  };
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
      res.setHeader('X-Request-Id', ignoredRequestId);
      return next();
    }

    const requestId = getRequestId(req);
    const actor = getActor(req);
    const startedAt = Date.now();

    res.locals.requestId = requestId;
    (req as any).requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    res.on('finish', async () => {
      try {
        await securityAuditService.logRequestEvent({
          requestId,
          userId: actor.id,
          actor: actor.label,
          action: req.method.toLowerCase(),
          resource: req.baseUrl || req.originalUrl,
          requestPath: req.originalUrl,
          ipAddress: req.ip || req.socket.remoteAddress || undefined,
          userAgent: req.get('user-agent') || undefined,
          statusCode: res.statusCode,
          severity: res.statusCode >= 500 ? 'high' : 'medium',
          eventData: {
            duration_ms: Date.now() - startedAt,
            org: (req.headers['x-organization-id'] as string) || (req as any).organizationId,
            routeParams: req.params,
            query: req.query,
          },
        });
      } catch (error) {
        logger.error('Failed to write request audit event', error as Error, { requestId });
      }
    });

    next();
  };
}
