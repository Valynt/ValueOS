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

const summaryName = __ENV.SUMMARY_NAME || "scaling-policy";
const steadyRamp = __ENV.STEADY_RAMP_DURATION || "2m";
const steadyHold = __ENV.STEADY_HOLD_DURATION || "8m";
const steadyRampDown = __ENV.STEADY_RAMP_DOWN_DURATION || "2m";
const steadyTarget = Number(__ENV.STEADY_TARGET_VUS || 40);
const spikeWarmup = __ENV.SPIKE_WARMUP_DURATION || "1m";
const spikePeak = __ENV.SPIKE_PEAK_DURATION || "90s";
const spikeRecovery = __ENV.SPIKE_RECOVERY_DURATION || "2m";
const spikeWarmupRate = Number(__ENV.SPIKE_WARMUP_RATE || 20);
const spikePeakRate = Number(__ENV.SPIKE_PEAK_RATE || 160);
const spikeRecoveryRate = Number(__ENV.SPIKE_RECOVERY_RATE || 20);
const soakDuration = __ENV.SOAK_DURATION || "30m";
const soakRate = Number(__ENV.SOAK_RATE || 35);
const spikeStartTime = __ENV.SPIKE_START_TIME || "12m";
const soakStartTime = __ENV.SOAK_START_TIME || "16m30s";

function makeHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (__ENV.AUTH_TOKEN) {
    headers.Authorization = `Bearer ${__ENV.AUTH_TOKEN}`;
  }
  if (__ENV.TENANT_ID) {
    headers["X-Tenant-Id"] = __ENV.TENANT_ID;
  }
  return headers;
}

export const options = {
  scenarios: {
    steady: {
      executor: "ramping-vus",
      startVUs: 5,
      stages: [
        { duration: steadyRamp, target: steadyTarget },
        { duration: steadyHold, target: steadyTarget },
        { duration: steadyRampDown, target: 0 },
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
        { duration: spikeWarmup, target: spikeWarmupRate },
        { duration: spikePeak, target: spikePeakRate },
        { duration: spikeRecovery, target: spikeRecoveryRate },
      ],
      exec: "spikeTraffic",
      startTime: spikeStartTime,
    },
    soak: {
      executor: "constant-arrival-rate",
      rate: soakRate,
      timeUnit: "1s",
      duration: soakDuration,
      preAllocatedVUs: 80,
      maxVUs: 180,
      exec: "soakTraffic",
      startTime: soakStartTime,
    },
  },
  summaryTrendStats: ["med", "p(50)", "p(95)", "p(99)", "avg", "min", "max"],
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
      "status < 400": (r) => r.status > 0 && r.status < 400,
    });
    const failed = !ok || res.status >= 400 || res.error_code !== 0;
    errors.add(failed);
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

function metricValue(data, metricName, valueKey, fallback = 0) {
  return data.metrics?.[metricName]?.values?.[valueKey] ?? fallback;
}

function thresholdStatus(metric) {
  if (metric?.thresholds == null) {
    return true;
  }
  return Object.values(metric.thresholds).every((threshold) => threshold.ok);
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    target: BASE_URL,
    scenario: "autoscaling-policy-staged-validation",
    config: {
      steady: { ramp: steadyRamp, hold: steadyHold, ramp_down: steadyRampDown, target_vus: steadyTarget },
      spike: {
        warmup: spikeWarmup,
        peak: spikePeak,
        recovery: spikeRecovery,
        warmup_rate: spikeWarmupRate,
        peak_rate: spikePeakRate,
        recovery_rate: spikeRecoveryRate,
        start_time: spikeStartTime,
      },
      soak: { duration: soakDuration, rate: soakRate, start_time: soakStartTime },
    },
    totals: {
      requests: metricValue(data, "http_reqs", "count", 0),
      iterations: metricValue(data, "iterations", "count", 0),
      rps: metricValue(data, "http_reqs", "rate", 0),
    },
    latency_ms: {
      overall: {
        p50: metricValue(data, "http_req_duration", "p(50)", null),
        p95: metricValue(data, "http_req_duration", "p(95)", null),
        p99: metricValue(data, "http_req_duration", "p(99)", null),
      },
      backend: {
        p50: metricValue(data, "backend_latency", "p(50)", null),
        p95: metricValue(data, "backend_latency", "p(95)", null),
        p99: metricValue(data, "backend_latency", "p(99)", null),
      },
    },
    error_rate: metricValue(data, "errors", "rate", 0),
    saturation: {
      vus_max: metricValue(data, "vus_max", "max", 0),
      dropped_iterations: metricValue(data, "dropped_iterations", "count", 0),
      blocked_p95_ms: metricValue(data, "http_req_blocked", "p(95)", 0),
    },
    thresholds: {
      passed: Object.values(data.metrics ?? {}).every((metric) => thresholdStatus(metric)),
      details: Object.fromEntries(
        Object.entries(data.metrics ?? {})
          .filter(([, metric]) => metric?.thresholds != null)
          .map(([metricName, metric]) => [
            metricName,
            Object.fromEntries(
              Object.entries(metric.thresholds).map(([name, threshold]) => [name, threshold.ok]),
            ),
          ]),
      ),
    },
  };

  const summaryJson = JSON.stringify(summary, null, 2);
  return {
    stdout: `${summaryJson}\n`,
    [`${summaryName}-summary.json`]: summaryJson,
    [`${summaryName}-results.json`]: JSON.stringify(data, null, 2),
  };
}
