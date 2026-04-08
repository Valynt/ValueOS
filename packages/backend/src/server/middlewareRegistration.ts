import compression from "compression";
import cors from "cors";
import express from "express";
import type { Application, NextFunction, Request, Response } from "express";

import type { parseCorsAllowlist } from "@shared/config/cors";

interface MiddlewareRegistrationDependencies {
  parseCorsAllowlistFn: typeof parseCorsAllowlist;
  corsOriginsCsv: string;
  tracingMiddleware: null | (() => ReturnType<Application["use"]>);
  metricsMiddleware: null | (() => ReturnType<Application["use"]>);
  latencyMetricsMiddleware: null | (() => ReturnType<Application["use"]>);
  requestIdMiddleware: ReturnType<typeof express.json>;
  accessLogMiddleware: ReturnType<typeof express.json>;
  cspNonceMiddleware: ReturnType<typeof express.json>;
  securityHeadersMiddleware: ReturnType<typeof express.json>;
  cachingMiddleware: ReturnType<typeof express.json>;
  csrfTokenMiddleware: ReturnType<typeof express.json>;
  csrfProtectionMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  requestAuditMiddleware: ReturnType<typeof express.json>;
}

export function registerCoreMiddleware(
  app: Application,
  deps: MiddlewareRegistrationDependencies
): void {
  const corsOrigins = deps.parseCorsAllowlistFn(deps.corsOriginsCsv, {
    source: "settings.security.corsOrigins",
    credentials: true,
    requireNonEmpty: true,
  });

  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
    })
  );
  app.use(compression());

  const stripeRawParser = express.raw({
    type: "application/json",
    limit: "256kb",
  });
  const jsonParser = express.json({ limit: "100kb" });

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api/billing/webhooks")) {
      stripeRawParser(req, res, next);
    } else if (/^\/api\/crm\/[^/]+\/webhook(?:\/)?$/.test(req.path)) {
      next();
    } else {
      jsonParser(req, res, next);
    }
  });

  app.use(deps.requestIdMiddleware);
  app.use(deps.accessLogMiddleware);
  app.use(deps.cspNonceMiddleware);
  app.use(deps.securityHeadersMiddleware);
  app.use(deps.cachingMiddleware);
  app.use(deps.csrfTokenMiddleware);

  app.use((req: Request, res: Response, next: NextFunction) => {
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

    return deps.csrfProtectionMiddleware(req, res, next);
  });

  if (deps.tracingMiddleware) {
    app.use(deps.tracingMiddleware());
  }
  if (deps.metricsMiddleware) {
    app.use(deps.metricsMiddleware());
  }
  if (deps.latencyMetricsMiddleware) {
    app.use(deps.latencyMetricsMiddleware());
  }

  app.use(deps.requestAuditMiddleware);
}
