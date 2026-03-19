import * as client from "prom-client";

import registry from "./httpMetrics.js";

export const cacheRequestsTotal = new client.Counter({
  name: "valuecanvas_cache_requests_total",
  help: "Cache lookups partitioned by cache and outcome",
  labelNames: ["cache_name", "cache_namespace", "cache_layer", "outcome"],
  registers: [registry],
});

export const cacheLoaderDurationMs = new client.Histogram({
  name: "valuecanvas_cache_loader_duration_ms",
  help: "Duration of cache miss loaders in milliseconds",
  labelNames: ["cache_name", "cache_namespace"],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [registry],
});

export const cacheCoalescedWaitersTotal = new client.Counter({
  name: "valuecanvas_cache_coalesced_waiters_total",
  help: "Total cache requests that joined an in-flight single-flight load",
  labelNames: ["cache_name", "cache_namespace"],
  registers: [registry],
});

export const groundTruthCacheInvalidationBatchesTotal = new client.Counter({
  name: "valuecanvas_ground_truth_cache_invalidation_batches_total",
  help: "Total ground truth cache invalidation delete batches",
  labelNames: ["mode"],
  registers: [registry],
});

export const groundTruthCacheInvalidationKeysTotal = new client.Counter({
  name: "valuecanvas_ground_truth_cache_invalidation_keys_total",
  help: "Total ground truth cache keys deleted during invalidation",
  labelNames: ["mode"],
  registers: [registry],
});

export const groundTruthCacheInvalidationDurationMs = new client.Histogram({
  name: "valuecanvas_ground_truth_cache_invalidation_duration_ms",
  help: "Duration of ground truth cache invalidation in milliseconds",
  labelNames: ["mode"],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [registry],
});
