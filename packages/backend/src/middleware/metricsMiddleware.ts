import registry, { httpRequestDuration } from "../lib/metrics/httpMetrics";

/**
 * Express middleware to record request durations using prom-client histogram
 */
export function metricsMiddleware(req: any, res: any, next: any) {
  const end = httpRequestDuration.startTimer({
    handler: req.path || "unknown",
    method: req.method,
  });
  res.on("finish", () => {
    end({ status: String(res.statusCode) });
  });
  next();
}

export function getMetricsRegistry() {
  return registry;
}
