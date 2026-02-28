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
 *   AUTH_TOKEN      — valid JWT for authenticated endpoints (optional)
 *   TENANT_ID       — tenant UUID for scoped requests (optional)
 *   VUS             — virtual users (default 50)
 *   DURATION        — test duration (default 2m)
 */

import { check, group, sleep } from "k6";
import http from "k6/http";
import { Rate, Trend } from "k6/metrics";

// ── custom metrics ──────────────────────────────────────────────────────────
const errorRate = new Rate("errors");
const healthLatency = new Trend("health_latency", true);
const apiLatency = new Trend("api_latency", true);

// ── options ─────────────────────────────────────────────────────────────────
const vus = Number(__ENV.VUS) || 50;
const duration = __ENV.DURATION || "2m";

export const options = {
  stages: [
    { duration: "15s", target: Math.ceil(vus * 0.3) }, // ramp up
    { duration: duration, target: vus },                 // sustained load
    { duration: "15s", target: 0 },                      // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<200"],   // SLO: P95 < 200ms
    errors: ["rate<0.001"],             // SLO: error rate < 0.1%
    health_latency: ["p(99)<100"],      // health must be fast
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
    headers["Authorization"] = `Bearer ${__ENV.AUTH_TOKEN}`;
  }
  return headers;
}

// ── scenarios ───────────────────────────────────────────────────────────────
export default function () {
  group("Health check", () => {
    const res = http.get(`${BASE_URL}/health`);
    healthLatency.add(res.timings.duration);
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
    // GET /api/health (readiness)
    const readiness = http.get(`${BASE_URL}/api/health/ready`, {
      headers: authHeaders(),
    });
    apiLatency.add(readiness.timings.duration);
    errorRate.add(readiness.status >= 500);

    // Authenticated endpoints (only if token provided)
    if (__ENV.AUTH_TOKEN) {
      // GET /api/analytics (lightweight)
      const analytics = http.get(`${BASE_URL}/api/analytics`, {
        headers: authHeaders(),
      });
      apiLatency.add(analytics.timings.duration);
      errorRate.add(analytics.status >= 500);

      // GET /api/teams (tenant-scoped)
      const teams = http.get(`${BASE_URL}/api/teams`, {
        headers: authHeaders(),
      });
      apiLatency.add(teams.timings.duration);
      check(teams, {
        "teams not 500": (r) => r.status < 500,
      });
      errorRate.add(teams.status >= 500);
    }
  });

  sleep(0.5 + Math.random() * 1.5); // think time 0.5–2s
}

// ── summary ─────────────────────────────────────────────────────────────────
export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.["p(95)"] ?? "N/A";
  const errRate = data.metrics.errors?.values?.rate ?? 0;
  const totalReqs = data.metrics.http_reqs?.values?.count ?? 0;

  const summary = {
    timestamp: new Date().toISOString(),
    total_requests: totalReqs,
    p95_latency_ms: p95,
    error_rate: errRate,
    thresholds_passed: Object.values(data.root_group?.checks ?? {}).every(
      (c) => c.passes > 0 && c.fails === 0,
    ),
  };

  return {
    stdout: JSON.stringify(summary, null, 2) + "\n",
    "load-test-results.json": JSON.stringify(data, null, 2),
  };
}
