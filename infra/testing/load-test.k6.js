/**
 * k6 load test for ValueOS API
 *
 * Exercises health, auth-protected, and tenant-scoped endpoints
 * under realistic concurrency to validate latency-class SLOs.
 *
 * Latency classes:
 *   - Interactive API routes: completion p95 < 200 ms
 *   - Orchestration/LLM routes: time-to-first-byte p95 < 200 ms,
 *     completion p95 < 3000 ms
 *
 * Route classification guidance:
 *   - Keep cache-friendly CRUD/readiness routes in the interactive class.
 *   - Move `/api/llm/chat`, `/api/billing`, and `/api/queue` into the
 *     orchestration class or an async polling/streaming flow; do not hold
 *     them to the universal 200 ms completion target.
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
const interactiveCompletionLatency = new Trend(
  "interactive_completion_latency",
  true,
);
const orchestrationTtfbLatency = new Trend("orchestration_ttfb_latency", true);
const orchestrationCompletionLatency = new Trend(
  "orchestration_completion_latency",
  true,
);

const INTERACTIVE_ROUTE_PREFIXES = ["/health", "/api/health/ready", "/api/teams"];
const ORCHESTRATION_ROUTE_PREFIXES = ["/api/llm/chat", "/api/billing", "/api/queue"];
const ORCHESTRATION_COMPLETION_SLO_MS = 3000;

function findRouteClass(route) {
  if (ORCHESTRATION_ROUTE_PREFIXES.some((prefix) => route.startsWith(prefix))) {
    return "orchestration";
  }

  if (INTERACTIVE_ROUTE_PREFIXES.some((prefix) => route.startsWith(prefix))) {
    return "interactive";
  }

  return "interactive";
}

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
    errors: ["rate<0.001"], // global SLO: error rate < 0.1%
    health_latency: ["p(99)<100"], // health must be fast
    interactive_completion_latency: [
      {
        threshold: "p(95)<200",
        abortOnFail: true,
        delayAbortEval: "2m",
      },
    ],
    orchestration_ttfb_latency: ["p(95)<200"],
    orchestration_completion_latency: [`p(95)<${ORCHESTRATION_COMPLETION_SLO_MS}`],
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

function trackRouteLatency(route, res) {
  const routeClass = findRouteClass(route);
  if (routeClass === "orchestration") {
    orchestrationTtfbLatency.add(res.timings.waiting);
    orchestrationCompletionLatency.add(res.timings.duration);
  } else {
    interactiveCompletionLatency.add(res.timings.duration);
  }
  errorRate.add(res.status >= 500);
}

// ── scenarios ───────────────────────────────────────────────────────────────
export default function () {
  group("Health check", () => {
    const route = "/health";
    const res = http.get(`${BASE_URL}${route}`, {
      tags: { route, latency_class: "interactive" },
    });
    healthLatency.add(res.timings.duration);
    trackRouteLatency(route, res);
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
    const readinessRoute = "/api/health/ready";
    const readiness = http.get(`${BASE_URL}${readinessRoute}`, {
      headers: authHeaders(),
      tags: { route: readinessRoute, latency_class: "interactive" },
    });
    apiLatency.add(readiness.timings.duration);
    trackRouteLatency(readinessRoute, readiness);

    // Authenticated endpoints (only if token provided)
    if (__ENV.AUTH_TOKEN) {
      const billingRoute = "/api/billing/summary";
      const billing = http.get(`${BASE_URL}${billingRoute}`, {
        headers: authHeaders(),
        tags: { route: billingRoute, latency_class: "orchestration" },
      });
      apiLatency.add(billing.timings.duration);
      trackRouteLatency(billingRoute, billing);

      const teamsRoute = "/api/teams";
      const teams = http.get(`${BASE_URL}${teamsRoute}`, {
        headers: authHeaders(),
        tags: { route: teamsRoute, latency_class: "interactive" },
      });
      apiLatency.add(teams.timings.duration);
      trackRouteLatency(teamsRoute, teams);
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
      interactive_completion_p95: metricValue(
        data,
        "interactive_completion_latency",
        "p(95)",
        null,
      ),
      orchestration_ttfb_p95: metricValue(
        data,
        "orchestration_ttfb_latency",
        "p(95)",
        null,
      ),
      orchestration_completion_p95: metricValue(
        data,
        "orchestration_completion_latency",
        "p(95)",
        null,
      ),
      overall_p95: metricValue(data, "http_req_duration", "p(95)", null),
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
