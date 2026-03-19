import * as client from "prom-client";

import registry from "./httpMetrics.js";

export const cacheRequestsTotal = new client.Counter({
  name: "valuecanvas_cache_requests_total",
  help: "Cache lookups partitioned by cache and outcome",
  labelNames: ["cache_name", "outcome"],
  registers: [registry],
});

export const cacheLoaderDurationMs = new client.Histogram({
  name: "valuecanvas_cache_loader_duration_ms",
  help: "Duration of cache miss loaders in milliseconds",
  labelNames: ["cache_name"],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [registry],
});

export const cacheCoalescedWaitersTotal = new client.Counter({
  name: "valuecanvas_cache_coalesced_waiters_total",
  help: "Total cache requests that joined an in-flight single-flight load",
  labelNames: ["cache_name"],
  registers: [registry],
});
