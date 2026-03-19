/**
 * k6 load test for ValueOS API.
 *
 * Exercises health, auth-protected, and tenant-scoped endpoints under realistic
 * concurrency to validate the canonical latency classes.
 *
 * Latency classes:
 *   - Interactive completion: p95 < 200 ms.
 *     Exception policy: none. Routes that cannot finish within 200 ms must be
 *     reclassified to orchestration before rollout.
 *   - Orchestration acknowledgment/completion: acknowledgment p95 < 200 ms.
 *     Allowed exception: orchestration completion p95 < 3000 ms only for
 *     streaming or async queue-backed flows.
 */

import { check, group, sleep } from "k6";
import http from "k6/http";
import { Rate, Trend } from "k6/metrics";

const INTERACTIVE_COMPLETION_TARGET_MS = 200;
const ORCHESTRATION_ACKNOWLEDGMENT_TARGET_MS = 200;
const ORCHESTRATION_COMPLETION_EXCEPTION_MS = 3000;

const errorRate = new Rate("errors");
const healthLatency = new Trend("health_latency", true);
const apiLatency = new Trend("api_latency", true);
const interactiveCompletionLatency = new Trend(
  "interactive_completion_latency",
  true,
);
const orchestrationAcknowledgmentLatency = new Trend(
  "orchestration_acknowledgment_latency",
  true,
);
const orchestrationCompletionLatency = new Trend(
  "orchestration_completion_latency",
  true,
);

const INTERACTIVE_ROUTE_PREFIXES = ["/health", "/api/health/ready", "/api/teams"];
const ORCHESTRATION_ROUTE_PREFIXES = ["/api/llm/chat", "/api/billing", "/api/queue"];

function findRouteClass(route) {
  if (ORCHESTRATION_ROUTE_PREFIXES.some((prefix) => route.startsWith(prefix))) {
    return "orchestration";
  }

  if (INTERACTIVE_ROUTE_PREFIXES.some((prefix) => route.startsWith(prefix))) {
    return "interactive";
  }

  return "interactive";
}

const vus = Number(__ENV.VUS) || 50;
const duration = __ENV.DURATION || "2m";

export const options = {
  stages: [
    { duration: "30s", target: Math.ceil(vus * 0.3) },
    { duration, target: vus },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    errors: ["rate<0.001"],
    health_latency: ["p(99)<100"],
    interactive_completion_latency: [
      {
        threshold: `p(95)<${INTERACTIVE_COMPLETION_TARGET_MS}`,
        abortOnFail: true,
        delayAbortEval: "2m",
      },
    ],
    orchestration_acknowledgment_latency: [
      `p(95)<${ORCHESTRATION_ACKNOWLEDGMENT_TARGET_MS}`,
    ],
    orchestration_completion_latency: [
      `p(95)<${ORCHESTRATION_COMPLETION_EXCEPTION_MS}`,
    ],
  },
};

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
    orchestrationAcknowledgmentLatency.add(res.timings.waiting);
    orchestrationCompletionLatency.add(res.timings.duration);
  } else {
    interactiveCompletionLatency.add(res.timings.duration);
  }
  errorRate.add(res.status >= 500);
}

export default function () {
  group("Health check", () => {
    const route = "/health";
    const res = http.get(`${BASE_URL}${route}`, {
      tags: { route, latency_class: "interactive", latency_phase: "completion" },
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
      tags: {
        route: readinessRoute,
        latency_class: "interactive",
        latency_phase: "completion",
      },
    });
    apiLatency.add(readiness.timings.duration);
    trackRouteLatency(readinessRoute, readiness);

    const billingRoute = "/api/billing/summary";
    const billing = http.get(`${BASE_URL}${billingRoute}`, {
      headers: authHeaders(),
      tags: {
        route: billingRoute,
        latency_class: "orchestration",
        latency_phase: "acknowledgment_and_completion",
      },
    });
    apiLatency.add(billing.timings.duration);
    trackRouteLatency(billingRoute, billing);

    if (__ENV.AUTH_TOKEN) {
      const teamsRoute = "/api/teams";
      const teams = http.get(`${BASE_URL}${teamsRoute}`, {
        headers: authHeaders(),
        tags: {
          route: teamsRoute,
          latency_class: "interactive",
          latency_phase: "completion",
        },
      });
      apiLatency.add(teams.timings.duration);
      trackRouteLatency(teamsRoute, teams);
      check(teams, {
        "teams not 500": (r) => r.status < 500,
      });
    }
  });

  sleep(0.5 + Math.random() * 1.5);
}

function metricValue(data, metricName, valueKey, fallback = 0) {
  return data.metrics?.[metricName]?.values?.[valueKey] ?? fallback;
}

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
      orchestration_acknowledgment_p95: metricValue(
        data,
        "orchestration_acknowledgment_latency",
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
      (metric) =>
        metric.thresholds == null ||
        Object.values(metric.thresholds).every((threshold) => threshold.ok),
    ),
  };

  return {
    stdout: JSON.stringify(summary, null, 2) + "\n",
    "load-test-summary.json": JSON.stringify(summary, null, 2),
    "load-test-results.json": JSON.stringify(data, null, 2),
  };
}
