/**
 * Staged k6 scenarios for autoscaling validation.
 *
 * Usage:
 *   k6 run --env BASE_URL=https://staging.valueos.app infra/testing/scaling-policy.k6.js
 */

import { check, sleep } from "k6";
import http from "k6/http";
import { Rate, Trend } from "k6/metrics";

const errors = new Rate("errors");
const backendLatency = new Trend("backend_latency", true);

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
    http_req_duration: ["p(95)<600", "p(99)<1200"],
    backend_latency: ["p(95)<550"],
  },
};

function hitCoreEndpoints() {
  const headers = makeHeaders();
  const responses = http.batch([
    ["GET", `${BASE_URL}/health`, null, { headers }],
    ["GET", `${BASE_URL}/api/health/ready`, null, { headers }],
    ["GET", `${BASE_URL}/api/analytics`, null, { headers }],
  ]);

  for (const res of responses) {
    backendLatency.add(res.timings.duration);
    const ok = check(res, {
      "status < 500": (r) => r.status < 500,
    });
    errors.add(!ok);
  }
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
