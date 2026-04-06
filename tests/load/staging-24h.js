/**
 * ValueOS — 24-Hour Staging Load Test (k6)
 *
 * Usage:
 *   k6 run tests/load/staging-24h.js --env BASE_URL=https://staging.valynt.com
 *
 * SLO Targets:
 *   - Availability ≥ 99.9%
 *   - p95 latency  ≤ 300ms
 *   - p99 latency  ≤ 10s
 *   - Error rate   < 0.1%
 *   - Heap usage   ≤ 1GB
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// ── Custom Metrics ──────────────────────────────────────────────────────────
const errorRate = new Rate("valueos_errors");
const authLatency = new Trend("valueos_auth_latency", true);
const dashboardLatency = new Trend("valueos_dashboard_latency", true);
const agentInvokeLatency = new Trend("valueos_agent_invoke_latency", true);
const dealAssemblyLatency = new Trend("valueos_deal_assembly_latency", true);
const apiErrors = new Counter("valueos_api_errors");

// ── Options ─────────────────────────────────────────────────────────────────
export const options = {
  stages: [
    // Ramp-up: 0 → 100 VUs over 30 minutes
    { duration: "30m", target: 100 },
    // Baseline hold: 100 VUs for 6 hours
    { duration: "6h", target: 100 },
    // Peak ramp: 100 → 500 VUs over 1 hour
    { duration: "1h", target: 500 },
    // Peak hold: 500 VUs for 4 hours
    { duration: "4h", target: 500 },
    // Cool down: 500 → 200 VUs over 30 minutes
    { duration: "30m", target: 200 },
    // Sustained: 200 VUs for 10 hours
    { duration: "10h", target: 200 },
    // Ramp-down: 200 → 0 over 30 minutes
    { duration: "30m", target: 0 },
  ],
  thresholds: {
    http_req_duration: [
      "p(95)<300", // SLO: p95 ≤ 300ms
      "p(99)<10000", // SLO: p99 ≤ 10s
    ],
    valueos_errors: ["rate<0.001"], // SLO: error rate < 0.1%
    valueos_auth_latency: ["p(95)<500"],
    valueos_dashboard_latency: ["p(95)<300"],
    valueos_agent_invoke_latency: ["p(99)<10000"],
    http_req_failed: ["rate<0.001"],
  },
};

// ── Configuration ───────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || "https://staging.valynt.com";
const TEST_EMAIL = __ENV.TEST_EMAIL || "loadtest@valynt.com";
const TEST_PASSWORD = __ENV.TEST_PASSWORD || "LoadTest2026!";

function headers(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// ── Scenarios ───────────────────────────────────────────────────────────────

export default function () {
  let token = null;

  // ── 1. Authentication Flow ──────────────────────────────────────────────
  group("Auth Flow", () => {
    const loginRes = http.post(
      `${BASE_URL}/auth/v1/token?grant_type=password`,
      JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
      {
        headers: { "Content-Type": "application/json" },
        tags: { flow: "auth" },
      }
    );

    authLatency.add(loginRes.timings.duration);
    const loginOk = check(loginRes, {
      "login status 200": r => r.status === 200,
      "login returns token": r => {
        try {
          return JSON.parse(r.body).access_token !== undefined;
        } catch {
          return false;
        }
      },
    });

    if (!loginOk) {
      errorRate.add(1);
      apiErrors.add(1);
      return;
    }
    errorRate.add(0);
    token = JSON.parse(loginRes.body).access_token;
  });

  if (!token) {
    sleep(2);
    return;
  }

  const hdrs = headers(token);

  // ── 2. Dashboard Queries ──────────────────────────────────────────────
  group("Dashboard", () => {
    const dashRes = http.get(`${BASE_URL}/api/dashboard/summary`, {
      headers: hdrs,
      tags: { flow: "dashboard" },
    });

    dashboardLatency.add(dashRes.timings.duration);
    const ok = check(dashRes, {
      "dashboard 200": r => r.status === 200,
    });
    errorRate.add(ok ? 0 : 1);
    if (!ok) apiErrors.add(1);
  });

  sleep(1);

  // ── 3. Deal Assembly ──────────────────────────────────────────────────
  group("Deal Assembly", () => {
    // List opportunities
    const listRes = http.get(`${BASE_URL}/api/opportunities`, {
      headers: hdrs,
      tags: { flow: "deal-assembly" },
    });

    dealAssemblyLatency.add(listRes.timings.duration);
    const ok = check(listRes, {
      "opportunities list 200": r => r.status === 200,
    });
    errorRate.add(ok ? 0 : 1);
    if (!ok) apiErrors.add(1);
  });

  sleep(1);

  // ── 4. Agent Invocation ───────────────────────────────────────────────
  group("Agent Invoke", () => {
    // Invoke the discovery agent (lightest agent for load testing)
    const invokeRes = http.post(
      `${BASE_URL}/api/agents/invoke`,
      JSON.stringify({
        agent: "discovery",
        sessionId: `loadtest-${__VU}-${__ITER}`,
        context: { lifecycle_stage: "discovery", user_inputs: {} },
      }),
      { headers: hdrs, tags: { flow: "agent-invoke" }, timeout: "30s" }
    );

    agentInvokeLatency.add(invokeRes.timings.duration);
    const ok = check(invokeRes, {
      "agent invoke 200 or 202": r => r.status === 200 || r.status === 202,
      "agent invoke not 500": r => r.status < 500,
    });
    errorRate.add(ok ? 0 : 1);
    if (!ok) apiErrors.add(1);
  });

  sleep(2);

  // ── 5. Health Check (background verification) ─────────────────────────
  group("Health", () => {
    const healthRes = http.get(`${BASE_URL}/health`, {
      tags: { flow: "health" },
    });
    check(healthRes, {
      "health 200": r => r.status === 200,
    });
  });

  // Random think-time between iterations (1-5s)
  sleep(Math.random() * 4 + 1);
}

// ── Summary handler ─────────────────────────────────────────────────────────
export function handleSummary(data) {
  return {
    "docs/load-test-results/staging-24h-summary.json": JSON.stringify(
      data,
      null,
      2
    ),
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}

function textSummary(data, opts) {
  // k6 built-in text summary (fallback)
  return JSON.stringify(
    {
      metrics: {
        http_req_duration_p95:
          data.metrics.http_req_duration?.values?.["p(95)"],
        http_req_duration_p99:
          data.metrics.http_req_duration?.values?.["p(99)"],
        http_req_failed_rate: data.metrics.http_req_failed?.values?.rate,
        valueos_errors_rate: data.metrics.valueos_errors?.values?.rate,
        total_requests: data.metrics.http_reqs?.values?.count,
      },
    },
    null,
    2
  );
}
