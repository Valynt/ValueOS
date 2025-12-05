import { createHistogram } from '../config/telemetry';
import { logger } from '../lib/logger';

const WINDOW_SIZE = 120;
const latencyWindows = new Map<string, number[]>();
const criticalRoutes = ['/api/llm/chat', '/api/billing', '/api/queue'];

const latencyHistogram = createHistogram(
  'api.request.duration',
  'Duration of API requests in milliseconds'
);

function recordDuration(route: string, duration: number) {
  const bucket = latencyWindows.get(route) || [];
  bucket.push(duration);
  if (bucket.length > WINDOW_SIZE) {
    bucket.shift();
  }
  latencyWindows.set(route, bucket);
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

export function getLatencySnapshot() {
  const snapshot: Record<string, { p50: number; p95: number; count: number }> = {};

  latencyWindows.forEach((durations, route) => {
    snapshot[route] = {
      p50: percentile(durations, 50),
      p95: percentile(durations, 95),
      count: durations.length,
    };
  });

  return snapshot;
}

export function latencyMetricsMiddleware() {
  return (req: any, res: any, next: any) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const routeKey = criticalRoutes.find((route) => req.path.startsWith(route)) || req.path;

      recordDuration(routeKey, duration);
      latencyHistogram.record(duration, {
        'http.route': routeKey,
        'http.method': req.method,
        'http.status_code': res.statusCode,
      });

      if (criticalRoutes.includes(routeKey)) {
        const snapshot = getLatencySnapshot();
        logger.debug('API latency updated', {
          route: routeKey,
          duration_ms: duration,
          p95_ms: snapshot[routeKey]?.p95,
        });
      }
    });

    next();
  };
}
