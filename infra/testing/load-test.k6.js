/**
 * k6 load test for ValueOS API
 *
 * Exercises health, auth-protected, and tenant-scoped endpoints
 * under realistic concurrency to validate P95 latency and error rate SLOs.
 *
 * Usage:
 *   k6 run --env BASE_URL=https://staging.valueos.app infra/testing/load-test.k6.js
 *
 * Environment variables:
 *   BASE_URL       — target API base URL (required)
 *   AUTH_TOKEN     — valid JWT for authenticated endpoints (optional)
 *   TENANT_ID      — tenant UUID for scoped requests (optional)
 *   VUS            — virtual users (default 50)
 *   DURATION       — sustained test window (default 2m)
 */

import { check, group, sleep } from "k6";
import http from "k6/http";
import { Rate, Trend } from "k6/metrics";

// ── custom metrics ──────────────────────────────────────────────────────────
const errorRate = new Rate("errors");
const healthLatency = new Trend("health_latency", true);
const apiLatency = new Trend("api_latency", true);
const criticalRouteLatency = new Trend("critical_route_latency", true);

// ── options ─────────────────────────────────────────────────────────────────
const vus = Number(__ENV.VUS) || 50;
const duration = __ENV.DURATION || "2m";

export const options = {
  stages: [
    { duration: "30s", target: Math.ceil(vus * 0.3) }, // ramp up
    { duration, target: vus }, // sustained window
    { duration: "30s", target: 0 }, // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<200"], // global SLO: P95 < 200ms
    errors: ["rate<0.001"], // global SLO: error rate < 0.1%
    health_latency: ["p(99)<100"], // health must be fast
    // Promotion guard: fail if critical routes breach p95 over sustained window.
    critical_route_latency: [
      {
        threshold: "p(95)<200",
        abortOnFail: true,
        delayAbortEval: "2m",
      },
    ],
  },
};

// ── helpers ─────────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL;
if (!BASE_URL) {
  throw new Error("BASE_URL environment variable is required");
}

function authHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (__ENV.AUTH_TOKEN) {
    headers.Authorization = `Bearer ${__ENV.AUTH_TOKEN}`;
  }
  return headers;
}

function trackCriticalRoute(res) {
  criticalRouteLatency.add(res.timings.duration);
  errorRate.add(res.status >= 500);
}

// ── scenarios ───────────────────────────────────────────────────────────────
export default function () {
  group("Health check", () => {
    const res = http.get(`${BASE_URL}/health`, {
      tags: { route: "/health", critical: "true" },
    });
    healthLatency.add(res.timings.duration);
    trackCriticalRoute(res);
    const ok = check(res, {
      "health 200": (r) => r.status === 200,
      "health body ok": (r) => {
        try {
          return JSON.parse(r.body).status === "ok";
        } catch {
          return false;
        }
      },
    });
    errorRate.add(!ok);
  });

  group("API endpoints", () => {
    // GET /api/health/ready (critical readiness path)
    const readiness = http.get(`${BASE_URL}/api/health/ready`, {
      headers: authHeaders(),
      tags: { route: "/api/health/ready", critical: "true" },
    });
    apiLatency.add(readiness.timings.duration);
    trackCriticalRoute(readiness);

    // Authenticated endpoints (only if token provided)
    if (__ENV.AUTH_TOKEN) {
      const analytics = http.get(`${BASE_URL}/api/analytics`, {
        headers: authHeaders(),
        tags: { route: "/api/analytics", critical: "false" },
      });
      apiLatency.add(analytics.timings.duration);
      errorRate.add(analytics.status >= 500);

      const teams = http.get(`${BASE_URL}/api/teams`, {
        headers: authHeaders(),
        tags: { route: "/api/teams", critical: "true" },
      });
      apiLatency.add(teams.timings.duration);
      trackCriticalRoute(teams);
      check(teams, {
        "teams not 500": (r) => r.status < 500,
      });
    }
  });

  sleep(0.5 + Math.random() * 1.5); // think time 0.5–2s
}

function metricValue(data, metricName, valueKey, fallback = 0) {
  return data.metrics?.[metricName]?.values?.[valueKey] ?? fallback;
}

// ── summary ─────────────────────────────────────────────────────────────────
export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    total_requests: metricValue(data, "http_reqs", "count", 0),
    rps: metricValue(data, "http_reqs", "rate", 0),
    latency_ms: {
      p50: metricValue(data, "http_req_duration", "p(50)", null),
      p95: metricValue(data, "http_req_duration", "p(95)", null),
      p99: metricValue(data, "http_req_duration", "p(99)", null),
      critical_p95: metricValue(data, "critical_route_latency", "p(95)", null),
    },
    error_rate: metricValue(data, "errors", "rate", 0),
    saturation: {
      vus_max: metricValue(data, "vus_max", "max", 0),
      dropped_iterations: metricValue(data, "dropped_iterations", "count", 0),
      blocked_p95_ms: metricValue(data, "http_req_blocked", "p(95)", 0),
    },
    thresholds_passed: Object.values(data.metrics ?? {}).every(
      (metric) => metric.thresholds == null || Object.values(metric.thresholds).every((t) => t.ok),
    ),
  };

  return {
    stdout: JSON.stringify(summary, null, 2) + "\n",
    "load-test-summary.json": JSON.stringify(summary, null, 2),
    "load-test-results.json": JSON.stringify(data, null, 2),
  };
}
