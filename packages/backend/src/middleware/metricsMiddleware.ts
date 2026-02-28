import { Request, Response, NextFunction } from "express";
import registry, { httpRequestDuration, httpRequestsTotal } from "../lib/metrics/httpMetrics.js";

/**
 * Express middleware factory to record request durations and counts.
 * Metrics use the valuecanvas_http_* naming convention to match SLO alert rules.
 */
export function metricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startMs = performance.now();
    res.on("finish", () => {
      const durationMs = performance.now() - startMs;
      const labels = {
        method: req.method,
        route: req.route?.path || req.path || "unknown",
        status_code: String(res.statusCode),
      };
      httpRequestDuration.observe(labels, durationMs);
      httpRequestsTotal.inc(labels);
    });
    next();
  };
}

export function getMetricsRegistry() {
  return registry;
}
