import type { Request, Response, NextFunction } from 'express';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

type MetricsLabels = {
  method: string;
  route: string;
  status_code: string;
};

const registry = new Registry();

collectDefaultMetrics({ register: registry });

const httpRequestDurationMs = new Histogram<MetricsLabels>({
  name: 'valuecanvas_http_request_duration_ms',
  help: 'Duration of HTTP requests in milliseconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [10, 50, 100, 200, 500, 1000],
  registers: [registry],
});

const httpRequestsTotal = new Counter<MetricsLabels>({
  name: 'valuecanvas_http_requests_total',
  help: 'Total number of HTTP requests received',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

const httpRequestErrors = new Counter<MetricsLabels>({
  name: 'valuecanvas_http_request_errors_total',
  help: 'Total number of HTTP requests that resulted in 5xx responses',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

const resolveRouteLabel = (req: Request): string => {
  if (req.route?.path) {
    return `${req.baseUrl}${req.route.path}`;
  }

  return req.originalUrl?.split('?')[0] ?? 'unknown';
};

export const metricsMiddleware = () =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (req.path === '/metrics') {
      next();
      return;
    }

    const endTimer = httpRequestDurationMs.startTimer();

    res.on('finish', () => {
      const routeLabel = resolveRouteLabel(req);
      const labels: MetricsLabels = {
        method: req.method,
        route: routeLabel,
        status_code: String(res.statusCode),
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
