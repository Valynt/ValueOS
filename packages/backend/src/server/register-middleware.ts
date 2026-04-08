import compression from "compression";
import cors from "cors";
import express, { type Application, type NextFunction, type Request, type Response } from "express";

import { parseCorsAllowlist } from "@shared/config/cors";

export interface RegisterMiddlewareInput {
  app: Application;
  corsOrigins: string[];
  requestIdMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  accessLogMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  cspNonceMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  securityHeadersMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  cachingMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  csrfTokenMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  csrfProtectionMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  tracingMiddleware: null | (() => (req: Request, res: Response, next: NextFunction) => void);
  metricsMiddleware: null | (() => (req: Request, res: Response, next: NextFunction) => void);
  latencyMetricsMiddleware: null | (() => (req: Request, res: Response, next: NextFunction) => void);
  requestAuditMiddleware: () => (req: Request, res: Response, next: NextFunction) => void;
}

export function registerServerMiddleware(input: RegisterMiddlewareInput): void {
  const corsAllowlist = parseCorsAllowlist(input.corsOrigins.join(","), {
    source: "settings.security.corsOrigins",
    credentials: true,
    requireNonEmpty: true,
  });

  input.app.use(
    cors({
      origin: corsAllowlist,
      credentials: true,
    })
  );
  input.app.use(compression());

  const stripeRawParser = express.raw({
    type: "application/json",
    limit: "256kb",
  });
  const jsonParser = express.json({ limit: "100kb" });

  input.app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api/billing/webhooks")) {
      stripeRawParser(req, res, next);
    } else if (/^\/api\/crm\/[^/]+\/webhook(?:\/)?$/.test(req.path)) {
      next();
    } else {
      jsonParser(req, res, next);
    }
  });

  input.app.use(input.requestIdMiddleware);
  input.app.use(input.accessLogMiddleware);
  input.app.use(input.cspNonceMiddleware);
  input.app.use(input.securityHeadersMiddleware);
  input.app.use(input.cachingMiddleware);
  input.app.use(input.csrfTokenMiddleware);
  input.app.use((req: Request, res: Response, next: NextFunction) => {
    const stateChangingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
    if (!stateChangingMethods.has(req.method)) {
      return next();
    }

    const authHeader = String(req.headers["authorization"] ?? "");
    const hasCookieHeader =
      typeof req.headers.cookie === "string" && req.headers.cookie.trim().length > 0;

    if (/^\s*Bearer\s+/i.test(authHeader) && !hasCookieHeader) {
      return next();
    }

    return input.csrfProtectionMiddleware(req, res, next);
  });

  if (input.tracingMiddleware) {
    input.app.use(input.tracingMiddleware());
  }
  if (input.metricsMiddleware) {
    input.app.use(input.metricsMiddleware());
  }
  if (input.latencyMetricsMiddleware) {
    input.app.use(input.latencyMetricsMiddleware());
  }

  input.app.use(input.requestAuditMiddleware());
}
