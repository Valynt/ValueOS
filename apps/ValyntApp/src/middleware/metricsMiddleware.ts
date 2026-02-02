import type { NextFunction, Request, Response } from "express";
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from "prom-client";
import { getRedactionMetrics } from "@valueos/shared/lib/piiFilter";

type MetricsLabels = {
  method: string;
  route: string;
  status_code: string;
  tenant_id: string;
};

const registry = new Registry();

collectDefaultMetrics({ register: registry });

const httpRequestDurationMs = new Histogram<MetricsLabels>({
  name: "valuecanvas_http_request_duration_ms",
  help: "Duration of HTTP requests in milliseconds",
  labelNames: ["method", "route", "status_code", "tenant_id"],
  buckets: [10, 50, 100, 200, 500, 1000],
  registers: [registry],
});

const httpRequestsTotal = new Counter<MetricsLabels>({
  name: "valuecanvas_http_requests_total",
  help: "Total number of HTTP requests received",
  labelNames: ["method", "route", "status_code", "tenant_id"],
  registers: [registry],
});

const httpRequestErrors = new Counter<MetricsLabels>({
  name: "valuecanvas_http_request_errors_total",
  help: "Total number of HTTP requests that resulted in 5xx responses",
  labelNames: ["method", "route", "status_code", "tenant_id"],
  registers: [registry],
});

// Sprint 1: Audit log redaction metrics
const auditLogRedactionTotal = new Gauge({
  name: "audit_log_redaction_total",
  help: "Total number of PII/secret redactions performed in audit logs",
  registers: [registry],
});

const auditLogRedactionByType = new Gauge({
  name: "audit_log_redaction_by_type",
  help: "Number of redactions by field type",
  labelNames: ["field_type"],
  registers: [registry],
});

// Update redaction metrics periodically
setInterval(() => {
  const metrics = getRedactionMetrics();
  auditLogRedactionTotal.set(metrics.total);
  for (const [type, count] of Object.entries(metrics.byType)) {
    auditLogRedactionByType.labels({ field_type: type }).set(count);
  }
}, 5000); // Update every 5 seconds

// Sprint 3: Additional observability metrics
const webScraperRequestBlocked = new Counter({
  name: "webscraper_request_blocked_total",
  help: "Total number of web scraper requests blocked due to SSRF or other security checks",
  labelNames: ["reason"],
  registers: [registry],
});

const wsAuthFailure = new Counter({
  name: "ws_auth_failure_total",
  help: "Total number of WebSocket authentication failures",
  labelNames: ["reason"],
  registers: [registry],
});

/**
 * Increment web scraper blocked request counter
 */
export function incrementScraperBlocked(reason: string): void {
  webScraperRequestBlocked.labels({ reason }).inc();
}

/**
 * Increment WebSocket auth failure counter
 */
export function incrementWsAuthFailure(reason: string): void {
  wsAuthFailure.labels({ reason }).inc();
}

const resolveRouteLabel = (req: Request): string => {
  if (req.route?.path) {
    return `${req.baseUrl}${req.route.path}`;
  }

  return req.originalUrl?.split("?")[0] ?? "unknown";
};

export const metricsMiddleware =
  () =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (req.path === "/metrics") {
      next();
      return;
    }

    const endTimer = httpRequestDurationMs.startTimer();

    res.on("finish", () => {
      const routeLabel = resolveRouteLabel(req);
      const tenantId = (req as any).tenantId || "unknown";

      const labels: MetricsLabels = {
        method: req.method,
        route: routeLabel,
        status_code: String(res.statusCode),
        tenant_id: tenantId,
      };

      httpRequestsTotal.labels(labels).inc();
      if (res.statusCode >= 500) {
        httpRequestErrors.labels(labels).inc();
      }

      endTimer(labels);
    });

    next();
  };

export const getMetricsRegistry = (): Registry => registry;
