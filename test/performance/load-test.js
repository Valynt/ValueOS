/**
 * Performance Tests - Load Testing with k6
 *
 * Tests system performance under load:
 * - 100 concurrent users
 * - API response times < 200ms
 * - Agent processing < 5s
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// Custom metrics
const errorRate = new Rate("errors");
const apiLatency = new Trend("api_latency");
const agentLatency = new Trend("agent_latency");

// Test configuration
export const options = {
  stages: [
    { duration: "30s", target: 20 }, // Ramp up to 20 users
    { duration: "1m", target: 50 }, // Ramp up to 50 users
    { duration: "2m", target: 100 }, // Ramp up to 100 users
    { duration: "2m", target: 100 }, // Stay at 100 users
    { duration: "1m", target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<200"], // 95% of requests < 200ms
    errors: ["rate<0.1"], // Error rate < 10%
    api_latency: ["p(95)<200"], // API p95 < 200ms
    agent_latency: ["p(95)<5000"], // Agent p95 < 5s
  },
};

const BASE_URL = __ENV.API_BASE_URL || "http://localhost:3000";
const API_KEY = __ENV.API_KEY || "";

/**
 * Setup function - runs once per VU
 */
export function setup() {
  console.log("Starting performance test...");
  console.log(`Target: ${BASE_URL}`);
  console.log(`Concurrent users: 100`);
  return { timestamp: new Date().toISOString() };
}

/**
 * Main test function - runs repeatedly
 */
export default function () {
  // Test 1: Health check endpoint
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    "health check status 200": (r) => r.status === 200,
    "health check duration < 100ms": (r) => r.timings.duration < 100,
  });
  errorRate.add(healthRes.status !== 200);

  sleep(1);

  // Test 2: List workflows (API endpoint)
  const workflowsRes = http.get(`${BASE_URL}/api/v1/workflows`, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  const apiSuccess = check(workflowsRes, {
    "workflows status 200": (r) => r.status === 200,
    "workflows duration < 200ms": (r) => r.timings.duration < 200,
  });

  apiLatency.add(workflowsRes.timings.duration);
  errorRate.add(!apiSuccess);

  sleep(2);

  // Test 3: Create workflow
  const createPayload = JSON.stringify({
    name: `Load Test Workflow ${Date.now()}`,
    type: "opportunity",
  });

  const createRes = http.post(`${BASE_URL}/api/v1/workflows`, createPayload, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  check(createRes, {
    "create workflow status 201": (r) => r.status === 201 || r.status === 200,
    "create duration < 500ms": (r) => r.timings.duration < 500,
  });
  errorRate.add(createRes.status !== 201 && createRes.status !== 200);

  sleep(1);

  // Test 4: Agent processing simulation
  const agentRes = http.post(
    `${BASE_URL}/api/v1/agent/process`,
    JSON.stringify({
      query: "Generate hypotheses for Nike",
    }),
    {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: "10s",
    }
  );

  const agentSuccess = check(agentRes, {
    "agent status 200": (r) => r.status === 200,
    "agent duration < 5s": (r) => r.timings.duration < 5000,
  });

  agentLatency.add(agentRes.timings.duration);
  errorRate.add(!agentSuccess);

  sleep(3);
}

/**
 * Teardown function - runs once at end
 */
export function teardown(data) {
  console.log("Performance test completed");
  console.log(`Started at: ${data.timestamp}`);
}

/**
 * Handle summary - custom reporting
 */
export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: " ", enableColors: true }),
    "performance-report.json": JSON.stringify(data, null, 2),
  };
}

function textSummary(data, options) {
  const { indent = "", enableColors = false } = options;

  const metrics = data.metrics;
  let summary = "\n" + "=".repeat(60) + "\n";
  summary += `${indent}Performance Test Summary\n`;
  summary += "=".repeat(60) + "\n\n";

  // HTTP metrics
  if (metrics.http_req_duration) {
    summary += `${indent}HTTP Request Duration:\n`;
    summary += `${indent}  avg: ${metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
    summary += `${indent}  p95: ${metrics.http_req_duration.values["p(95)"].toFixed(2)}ms\n`;
    summary += `${indent}  p99: ${metrics.http_req_duration.values["p(99)"].toFixed(2)}ms\n\n`;
  }

  // Error rate
  if (metrics.errors) {
    const rate = (metrics.errors.values.rate * 100).toFixed(2);
    summary += `${indent}Error Rate: ${rate}%\n\n`;
  }

  // API latency
  if (metrics.api_latency) {
    summary += `${indent}API Latency (p95): ${metrics.api_latency.values["p(95)"].toFixed(2)}ms\n`;
  }

  // Agent latency
  if (metrics.agent_latency) {
    summary += `${indent}Agent Latency (p95): ${(metrics.agent_latency.values["p(95)"] / 1000).toFixed(2)}s\n`;
  }

  summary += "\n" + "=".repeat(60) + "\n";

  return summary;
}
