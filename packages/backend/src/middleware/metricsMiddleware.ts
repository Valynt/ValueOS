/**
 * Metrics Middleware
 */

export function metricsMiddleware(req: any, res: any, next: any) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
}

export function getMetricsRegistry() {
  return {};
}
