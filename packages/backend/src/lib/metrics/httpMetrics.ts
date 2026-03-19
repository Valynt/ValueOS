import * as client from "prom-client";

const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

export const httpRequestDuration = new client.Histogram({
  name: "valuecanvas_http_request_duration_ms",
  help: "Duration of HTTP requests in milliseconds",
  labelNames: ["method", "route", "status_code", "latency_class"],
  buckets: [5, 10, 25, 50, 100, 200, 500, 1000, 2000, 5000],
});

export const httpRequestTtfb = new client.Histogram({
  name: "valuecanvas_http_request_ttfb_ms",
  help: "Time to first byte for HTTP requests in milliseconds",
  labelNames: ["method", "route", "status_code", "latency_class"],
  buckets: [5, 10, 25, 50, 100, 200, 500, 1000, 2000, 5000],
});

export const httpRequestsTotal = new client.Counter({
  name: "valuecanvas_http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code", "latency_class"],
});

export const readCacheEventsTotal = new client.Counter({
  name: "valuecanvas_read_cache_events_total",
  help: "Read cache lifecycle events",
  labelNames: ["endpoint", "event"],
});

registry.registerMetric(httpRequestDuration);
registry.registerMetric(httpRequestTtfb);
registry.registerMetric(httpRequestsTotal);
registry.registerMetric(readCacheEventsTotal);

export default registry;
