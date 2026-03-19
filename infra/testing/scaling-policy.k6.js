/**
 * Staged k6 scenarios for autoscaling validation.
 *
 * Canonical latency classes:
 *   - Interactive completion: p95 < 200 ms.
 *   - Orchestration acknowledgment/completion: acknowledgment p95 < 200 ms,
 *     with completion p95 < 3000 ms as the only allowed exception policy.
 *
 * Usage:
 *   k6 run --env BASE_URL=https://staging.valueos.app infra/testing/scaling-policy.k6.js
 */

import { check, sleep } from "k6";
import http from "k6/http";
import { Rate, Trend } from "k6/metrics";

const INTERACTIVE_COMPLETION_TARGET_MS = 200;
const ORCHESTRATION_ACKNOWLEDGMENT_TARGET_MS = 200;
const ORCHESTRATION_COMPLETION_EXCEPTION_MS = 3000;

const errors = new Rate("errors");
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

const BASE_URL = __ENV.BASE_URL;
if (!BASE_URL) {
  throw new Error("BASE_URL is required");
}

function makeHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (__ENV.AUTH_TOKEN) {
    headers.Authorization = `Bearer ${__ENV.AUTH_TOKEN}`;
  }
  return headers;
}

export const options = {
  scenarios: {
    steady: {
      executor: "ramping-vus",
      startVUs: 5,
      stages: [
        { duration: "2m", target: 40 },
        { duration: "8m", target: 40 },
        { duration: "2m", target: 0 },
      ],
      exec: "steadyTraffic",
    },
    spike: {
      executor: "ramping-arrival-rate",
      startRate: 10,
      timeUnit: "1s",
      preAllocatedVUs: 60,
      maxVUs: 300,
      stages: [
        { duration: "1m", target: 20 },
        { duration: "90s", target: 160 },
        { duration: "2m", target: 20 },
      ],
      exec: "spikeTraffic",
      startTime: "12m",
    },
    soak: {
      executor: "constant-arrival-rate",
      rate: 35,
      timeUnit: "1s",
      duration: "30m",
      preAllocatedVUs: 80,
      maxVUs: 180,
      exec: "soakTraffic",
      startTime: "16m30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    errors: ["rate<0.02"],
    interactive_completion_latency: [
      `p(95)<${INTERACTIVE_COMPLETION_TARGET_MS}`,
    ],
    orchestration_acknowledgment_latency: [
      `p(95)<${ORCHESTRATION_ACKNOWLEDGMENT_TARGET_MS}`,
    ],
    orchestration_completion_latency: [
      `p(95)<${ORCHESTRATION_COMPLETION_EXCEPTION_MS}`,
    ],
  },
};

function trackResponse(res, routeClass) {
  if (routeClass === "orchestration") {
    orchestrationAcknowledgmentLatency.add(res.timings.waiting);
    orchestrationCompletionLatency.add(res.timings.duration);
  } else {
    interactiveCompletionLatency.add(res.timings.duration);
  }

  const ok = check(res, {
    "status < 500": (response) => response.status < 500,
  });
  errors.add(!ok);
}

function hitCoreEndpoints() {
  const headers = makeHeaders();
  const responses = http.batch([
    ["GET", `${BASE_URL}/health`, null, { headers, tags: { latency_class: "interactive" } }],
    [
      "GET",
      `${BASE_URL}/api/health/ready`,
      null,
      { headers, tags: { latency_class: "interactive" } },
    ],
    [
      "GET",
      `${BASE_URL}/api/analytics`,
      null,
      { headers, tags: { latency_class: "interactive" } },
    ],
    [
      "GET",
      `${BASE_URL}/api/billing/summary`,
      null,
      { headers, tags: { latency_class: "orchestration" } },
    ],
  ]);

  trackResponse(responses[0], "interactive");
  trackResponse(responses[1], "interactive");
  trackResponse(responses[2], "interactive");
  trackResponse(responses[3], "orchestration");
}

export function steadyTraffic() {
  hitCoreEndpoints();
  sleep(0.5);
}

export function spikeTraffic() {
  hitCoreEndpoints();
}

export function soakTraffic() {
  hitCoreEndpoints();
  sleep(0.2);
}
