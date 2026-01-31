import registry, { httpRequestDuration } from "../lib/metrics/httpMetrics";

/**
 * Express middleware factory to record request durations using prom-client histogram.
 */
export function metricsMiddleware() {
  return (req: any, res: any, next: any) => {
    const end = httpRequestDuration.startTimer({
      handler: req.path || "unknown",
      method: req.method,
    });
    res.on("finish", () => {
      end({ status: String(res.statusCode) });
    });
    next();
  };
}

export function getMetricsRegistry() {
  return registry;
}
