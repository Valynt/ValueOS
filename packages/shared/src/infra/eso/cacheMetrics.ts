import { metrics } from "@opentelemetry/api";

const meter = metrics.getMeter("valueos.shared.eso");

export const esoCacheHitRateCounter = meter.createCounter("valueos_eso_cache_requests_total", {
  description: "Total ESO cache requests partitioned by outcome for Grafana hit-rate dashboards.",
});

export const esoCacheMissLatencyHistogram = meter.createHistogram("valueos_eso_cache_miss_latency_ms", {
  description: "Duration in milliseconds for ESO cache miss and stale refresh loader executions.",
  unit: "ms",
});

export const esoCacheStampedeCounter = meter.createCounter("valueos_eso_cache_stampede_total", {
  description: "Total ESO cache requests that joined an in-flight or distributed refresh/load.",
});

export const esoCacheStaleRefreshCounter = meter.createCounter("valueos_eso_cache_stale_refresh_total", {
  description: "Total ESO cache stale refresh lifecycle events.",
});
