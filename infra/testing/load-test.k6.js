/**
 * k6 load test for ValueOS API concurrency guards, LLM latency, and queue-backed workflows.
 *
 * Profiles:
 *   - ci-50: steady benchmark sized for ~50 VUs
 *   - nightly-200: sustained nightly benchmark sized for ~200 VUs
 *   - spike: burst profile that drives sudden concurrency and queue backlog
 *
 * Usage:
 *   k6 run \
 *     --env BASE_URL=https://staging.valueos.app \
 *     --env LOAD_TEST_PROFILE=ci-50 \
 *     --env AUTH_TOKEN=... \
 *     --env TENANT_ID=... \
 *     --env CSRF_TOKEN=... \
 *     --env CSRF_COOKIE=csrf_token=... \
 *     --env SERVICE_IDENTITY_TOKEN=... \
 *     infra/testing/load-test.k6.js
 *
 * Required env vars by scenario:
 *   - agentsGuard: AUTH_TOKEN, TENANT_ID, SERVICE_IDENTITY_TOKEN
 *   - llmGuard: AUTH_TOKEN, TENANT_ID, CSRF_TOKEN, CSRF_COOKIE, SERVICE_IDENTITY_TOKEN
 *   - queueWorkflowBacklog: AUTH_TOKEN, CSRF_TOKEN, CSRF_COOKIE, SERVICE_IDENTITY_TOKEN
 *
 * Queue/HPA alignment:
 *   worker-hpa.yaml uses ~20 waiting jobs / pod and up to 12 pods.
 *   This script therefore treats 240 waiting jobs as the default queue saturation
 *   threshold and 600 delayed jobs as the delayed-job early-warning threshold.
 */

import { check, sleep } from "k6";
import http from "k6/http";
import { Counter, Gauge, Rate, Trend } from "k6/metrics";
import exec from "k6/execution";

const PROFILE = __ENV.LOAD_TEST_PROFILE || "ci-50";
const BASE_URL = __ENV.BASE_URL;
if (!BASE_URL) {
  throw new Error("BASE_URL environment variable is required");
}

const TENANT_HEADER_NAME = __ENV.TENANT_HEADER_NAME || "x-tenant-id";
const ORGANIZATION_HEADER_NAME = __ENV.ORGANIZATION_HEADER_NAME || "x-organization-id";
const AGENT_ID = __ENV.AGENT_ID || "opportunity";
const LLM_MODEL = __ENV.LLM_MODEL || "meta-llama/Llama-3-70b-chat-hf";
const ARTIFACT_DIR = (__ENV.ARTIFACT_DIR || ".").replace(/\/$/, "") || ".";
const SUMMARY_FILE = `${ARTIFACT_DIR}/load-test-summary.json`;
const RESULTS_FILE = `${ARTIFACT_DIR}/load-test-results.json`;
const REPORT_FILE = `${ARTIFACT_DIR}/load-test-report.json`;

const HPA_WAITING_JOBS_PER_POD = Number(__ENV.HPA_WAITING_JOBS_PER_POD || "20");
const HPA_DELAYED_JOBS_PER_POD = Number(__ENV.HPA_DELAYED_JOBS_PER_POD || "50");
const HPA_MAX_REPLICAS = Number(__ENV.HPA_MAX_REPLICAS || "12");
const QUEUE_WAITING_THRESHOLD = HPA_WAITING_JOBS_PER_POD * HPA_MAX_REPLICAS;
const QUEUE_DELAYED_THRESHOLD = HPA_DELAYED_JOBS_PER_POD * HPA_MAX_REPLICAS;

const BACKPRESSURE_429_THRESHOLD = Number(__ENV.BACKPRESSURE_429_RATE_THRESHOLD || "0.05");
const BACKPRESSURE_503_THRESHOLD = Number(__ENV.BACKPRESSURE_503_RATE_THRESHOLD || "0.08");
const DROPPED_ITERATION_THRESHOLD = Number(__ENV.DROPPED_ITERATION_THRESHOLD || "25");

const profiles = {
  "ci-50": {
    description: "CI steady-state concurrency benchmark at ~50 VUs.",
    defaultVus: 50,
    scenarios: {
      health: {
        executor: "constant-vus",
        vus: 2,
        duration: "2m",
        exec: "healthScenario",
      },
      agentsGuard: {
        executor: "constant-arrival-rate",
        rate: 10,
        timeUnit: "1s",
        duration: "3m",
        preAllocatedVUs: 20,
        maxVUs: 50,
        exec: "agentsGuardScenario",
        tags: { class: "agents" },
      },
      llmGuard: {
        executor: "constant-arrival-rate",
        rate: 6,
        timeUnit: "1s",
        duration: "3m",
        preAllocatedVUs: 16,
        maxVUs: 40,
        exec: "llmGuardScenario",
        tags: { class: "llm" },
      },
      queueWorkflowBacklog: {
        executor: "constant-arrival-rate",
        rate: 4,
        timeUnit: "1s",
        duration: "3m",
        preAllocatedVUs: 12,
        maxVUs: 32,
        exec: "queueWorkflowScenario",
        tags: { class: "queue" },
      },
    },
  },
  "nightly-200": {
    description: "Nightly sustained benchmark at ~200 VUs.",
    defaultVus: 200,
    scenarios: {
      health: {
        executor: "constant-vus",
        vus: 4,
        duration: "4m",
        exec: "healthScenario",
      },
      agentsGuard: {
        executor: "constant-arrival-rate",
        rate: 40,
        timeUnit: "1s",
        duration: "6m",
        preAllocatedVUs: 80,
        maxVUs: 200,
        exec: "agentsGuardScenario",
        tags: { class: "agents" },
      },
      llmGuard: {
        executor: "constant-arrival-rate",
        rate: 18,
        timeUnit: "1s",
        duration: "6m",
        preAllocatedVUs: 48,
        maxVUs: 120,
        exec: "llmGuardScenario",
        tags: { class: "llm" },
      },
      queueWorkflowBacklog: {
        executor: "constant-arrival-rate",
        rate: 15,
        timeUnit: "1s",
        duration: "6m",
        preAllocatedVUs: 40,
        maxVUs: 100,
        exec: "queueWorkflowScenario",
        tags: { class: "queue" },
      },
    },
  },
  spike: {
    description: "Burst benchmark that forces concurrency guard queuing and queue backlog spikes.",
    defaultVus: 250,
    scenarios: {
      health: {
        executor: "constant-vus",
        vus: 2,
        duration: "5m",
        exec: "healthScenario",
      },
      agentsGuard: {
        executor: "ramping-arrival-rate",
        startRate: 10,
        timeUnit: "1s",
        preAllocatedVUs: 80,
        maxVUs: 280,
        stages: [
          { duration: "45s", target: 20 },
          { duration: "90s", target: 80 },
          { duration: "90s", target: 20 },
          { duration: "45s", target: 0 },
        ],
        exec: "agentsGuardScenario",
        tags: { class: "agents" },
      },
      llmGuard: {
        executor: "ramping-arrival-rate",
        startRate: 4,
        timeUnit: "1s",
        preAllocatedVUs: 40,
        maxVUs: 160,
        stages: [
          { duration: "45s", target: 8 },
          { duration: "90s", target: 24 },
          { duration: "90s", target: 8 },
          { duration: "45s", target: 0 },
        ],
        exec: "llmGuardScenario",
        tags: { class: "llm" },
      },
      queueWorkflowBacklog: {
        executor: "ramping-arrival-rate",
        startRate: 5,
        timeUnit: "1s",
        preAllocatedVUs: 36,
        maxVUs: 140,
        stages: [
          { duration: "45s", target: 10 },
          { duration: "90s", target: 36 },
          { duration: "90s", target: 10 },
          { duration: "45s", target: 0 },
        ],
        exec: "queueWorkflowScenario",
        tags: { class: "queue" },
      },
    },
  },
};

const selectedProfile = profiles[PROFILE];
if (!selectedProfile) {
  throw new Error(`Unsupported LOAD_TEST_PROFILE: ${PROFILE}`);
}

const scenarioRequirements = {
  agentsGuard:
    Boolean(__ENV.AUTH_TOKEN) &&
    Boolean(__ENV.TENANT_ID) &&
    Boolean(__ENV.SERVICE_IDENTITY_TOKEN),
  llmGuard:
    Boolean(__ENV.AUTH_TOKEN) &&
    Boolean(__ENV.TENANT_ID) &&
    Boolean(__ENV.CSRF_TOKEN) &&
    Boolean(__ENV.CSRF_COOKIE) &&
    Boolean(__ENV.SERVICE_IDENTITY_TOKEN),
  queueWorkflowBacklog:
    Boolean(__ENV.AUTH_TOKEN) &&
    Boolean(__ENV.CSRF_TOKEN) &&
    Boolean(__ENV.CSRF_COOKIE) &&
    Boolean(__ENV.SERVICE_IDENTITY_TOKEN),
};

function buildScenarios() {
  const scenarios = { health: selectedProfile.scenarios.health };
  if (scenarioRequirements.agentsGuard) {
    scenarios.agentsGuard = selectedProfile.scenarios.agentsGuard;
  }
  if (scenarioRequirements.llmGuard) {
    scenarios.llmGuard = selectedProfile.scenarios.llmGuard;
  }
  if (scenarioRequirements.queueWorkflowBacklog) {
    scenarios.queueWorkflowBacklog = selectedProfile.scenarios.queueWorkflowBacklog;
  }
  return scenarios;
}

export const options = {
  scenarios: buildScenarios(),
  summaryTrendStats: ["avg", "min", "med", "max", "p(50)", "p(95)", "p(99)"],
  thresholds: {
    errors: ["rate<0.02"],
    health_latency: ["p(95)<150", "p(99)<250"],
    agents_completion_latency: ["p(50)<400", "p(95)<2000", "p(99)<6000"],
    llm_ttfb_latency: ["p(50)<250", "p(95)<1500", "p(99)<4000"],
    llm_completion_latency: ["p(50)<1200", "p(95)<8000", "p(99)<15000"],
    queue_wait_latency: ["p(50)<5000", "p(95)<20000", "p(99)<45000"],
    queue_execution_latency: ["p(50)<5000", "p(95)<20000", "p(99)<45000"],
    queue_end_to_end_latency: ["p(50)<10000", "p(95)<45000", "p(99)<90000"],
    queue_waiting_ratio: [`max<${Number(__ENV.QUEUE_WAITING_RATIO_THRESHOLD || "1.1")}`],
    queue_delayed_ratio: [`max<${Number(__ENV.QUEUE_DELAYED_RATIO_THRESHOLD || "1.1")}`],
    backpressure_429_rate: [`rate<${BACKPRESSURE_429_THRESHOLD}`],
    backpressure_503_rate: [`rate<${BACKPRESSURE_503_THRESHOLD}`],
    dropped_iterations: [`count<${DROPPED_ITERATION_THRESHOLD}`],
  },
};

const errors = new Rate("errors");
const backpressure429Rate = new Rate("backpressure_429_rate");
const backpressure503Rate = new Rate("backpressure_503_rate");
const healthLatency = new Trend("health_latency", true);
const agentsCompletionLatency = new Trend("agents_completion_latency", true);
const llmTtfbLatency = new Trend("llm_ttfb_latency", true);
const llmCompletionLatency = new Trend("llm_completion_latency", true);
const queueWaitLatency = new Trend("queue_wait_latency", true);
const queueExecutionLatency = new Trend("queue_execution_latency", true);
const queueEndToEndLatency = new Trend("queue_end_to_end_latency", true);
const queueWaitingRatio = new Gauge("queue_waiting_ratio");
const queueDelayedRatio = new Gauge("queue_delayed_ratio");
const queueWaitingJobs = new Gauge("queue_waiting_jobs");
const queueDelayedJobs = new Gauge("queue_delayed_jobs");
const queueDepthGauge = new Gauge("queue_depth_jobs");
const agentRequests = new Counter("agents_requests_total");
const llmRequests = new Counter("llm_requests_total");
const queueWorkflowRequests = new Counter("queue_workflow_requests_total");
const skippedScenarioIterations = new Counter("skipped_scenario_iterations_total");

function randomSuffix() {
  return `${exec.vu.idInTest}-${exec.scenario.iterationInTest}-${Date.now()}`;
}

function scenarioHeaders({
  includeAuth = false,
  includeTenant = false,
  includeCsrf = false,
  includeServiceIdentity = false,
  contentType = "application/json",
} = {}) {
  const headers = { "Content-Type": contentType };

  if (includeAuth && __ENV.AUTH_TOKEN) {
    headers.Authorization = `Bearer ${__ENV.AUTH_TOKEN}`;
  }

  if (includeTenant && __ENV.TENANT_ID) {
    headers[TENANT_HEADER_NAME] = __ENV.TENANT_ID;
    headers[ORGANIZATION_HEADER_NAME] = __ENV.TENANT_ID;
  }

  if (includeCsrf && __ENV.CSRF_TOKEN) {
    headers["x-csrf-token"] = __ENV.CSRF_TOKEN;
  }

  if (includeServiceIdentity && __ENV.SERVICE_IDENTITY_TOKEN) {
    headers["x-service-identity"] = __ENV.SERVICE_IDENTITY_TOKEN;
    headers["x-request-timestamp"] = String(Date.now());
    headers["x-request-nonce"] = `k6-${randomSuffix()}`;
  }

  return headers;
}

function scenarioParams(route, headers, extraTags = {}) {
  return {
    headers,
    tags: {
      route,
      profile: PROFILE,
      ...extraTags,
    },
  };
}

function maybeAttachCookieHeader(headers, includeCsrf = false) {
  if (includeCsrf && __ENV.CSRF_COOKIE) {
    headers.Cookie = __ENV.CSRF_COOKIE;
  }
}

function noteHttpResult(res, routeTag, { count429 = true, count503 = true } = {}) {
  const is429 = res.status === 429;
  const is503 = res.status === 503;

  if (count429) {
    backpressure429Rate.add(is429, { route: routeTag, profile: PROFILE });
  }
  if (count503) {
    backpressure503Rate.add(is503, { route: routeTag, profile: PROFILE });
  }

  errors.add(res.status >= 500 && !is503);
}

function readJson(res) {
  try {
    return res.json();
  } catch {
    return null;
  }
}

function recordSkippedScenario(name, reason) {
  skippedScenarioIterations.add(1, { scenario: name, reason, profile: PROFILE });
  sleep(0.25);
}

export function healthScenario() {
  const route = "/health";
  const res = http.get(
    `${BASE_URL}${route}`,
    scenarioParams(route, scenarioHeaders(), { traffic_class: "health" }),
  );
  healthLatency.add(res.timings.duration, { profile: PROFILE });
  noteHttpResult(res, route);
  check(res, {
    "health responded": (r) => r.status === 200 || r.status === 503,
  });
  sleep(0.5);
}

export function agentsGuardScenario() {
  if (!scenarioRequirements.agentsGuard) {
    recordSkippedScenario("agentsGuard", "missing_env");
    return;
  }

  const route = `/api/agents/${AGENT_ID}/invoke`;
  const headers = scenarioHeaders({
    includeAuth: true,
    includeTenant: true,
    includeServiceIdentity: true,
  });
  maybeAttachCookieHeader(headers, false);

  const payload = JSON.stringify({
    query: `Load test concurrency probe ${randomSuffix()}`,
    sessionId: `k6-agents-${exec.vu.idInTest}`,
    context: {
      tenantId: __ENV.TENANT_ID,
      organizationId: __ENV.TENANT_ID,
      workspace_id: `k6-workspace-${exec.vu.idInTest}`,
      profile: PROFILE,
    },
    parameters: {
      priority: "benchmark",
      source: "k6",
    },
  });

  agentRequests.add(1, { profile: PROFILE, agentId: AGENT_ID });
  const res = http.post(
    `${BASE_URL}${route}`,
    payload,
    scenarioParams(route, headers, { traffic_class: "agents", agentId: AGENT_ID }),
  );

  agentsCompletionLatency.add(res.timings.duration, { profile: PROFILE, agentId: AGENT_ID });
  noteHttpResult(res, route);

  check(res, {
    "agents guard path returns success or backpressure": (r) => [200, 202, 401, 402, 403, 404, 429, 503].includes(r.status),
  });
}

export function llmGuardScenario() {
  if (!scenarioRequirements.llmGuard) {
    recordSkippedScenario("llmGuard", "missing_env");
    return;
  }

  const route = "/api/llm/chat";
  const headers = scenarioHeaders({
    includeAuth: true,
    includeTenant: true,
    includeCsrf: true,
    includeServiceIdentity: true,
  });
  maybeAttachCookieHeader(headers, true);

  const payload = JSON.stringify({
    prompt: `Return a short JSON fragment for benchmark ${randomSuffix()}`,
    model: LLM_MODEL,
    maxTokens: Number(__ENV.LLM_MAX_TOKENS || "96"),
    temperature: Number(__ENV.LLM_TEMPERATURE || "0.2"),
    stream: true,
    dealId: __ENV.LLM_DEAL_ID,
  });

  llmRequests.add(1, { profile: PROFILE, model: LLM_MODEL });
  const res = http.post(
    `${BASE_URL}${route}`,
    payload,
    scenarioParams(route, headers, { traffic_class: "llm", model: LLM_MODEL }),
  );

  llmTtfbLatency.add(res.timings.waiting, { profile: PROFILE, model: LLM_MODEL });
  llmCompletionLatency.add(res.timings.duration, { profile: PROFILE, model: LLM_MODEL });
  noteHttpResult(res, route);

  check(res, {
    "llm guard path returns success or backpressure": (r) => [200, 400, 401, 403, 429, 503].includes(r.status),
  });
}

function fetchQueueMetrics() {
  const route = "/api/queue/metrics";
  const headers = scenarioHeaders({
    includeAuth: true,
    includeCsrf: false,
    includeServiceIdentity: true,
  });
  const res = http.get(
    `${BASE_URL}${route}`,
    scenarioParams(route, headers, { traffic_class: "queue-metrics" }),
  );
  noteHttpResult(res, route, { count429: false, count503: false });

  const payload = readJson(res);
  const metrics = payload?.data ?? payload ?? {};
  const waiting = Number(metrics.waiting || 0);
  const delayed = Number(metrics.delayed || 0);
  const queueDepth = Number(metrics.queueDepth || waiting + Number(metrics.active || 0) + delayed);

  queueWaitingJobs.add(waiting, { profile: PROFILE });
  queueDelayedJobs.add(delayed, { profile: PROFILE });
  queueDepthGauge.add(queueDepth, { profile: PROFILE });
  queueWaitingRatio.add(QUEUE_WAITING_THRESHOLD > 0 ? waiting / QUEUE_WAITING_THRESHOLD : 0, { profile: PROFILE });
  queueDelayedRatio.add(QUEUE_DELAYED_THRESHOLD > 0 ? delayed / QUEUE_DELAYED_THRESHOLD : 0, { profile: PROFILE });
}

function pollQueuedWorkflow(jobId) {
  const start = Date.now();
  let queueStartedAt = null;
  let executionLatencyMs = null;
  let state = "queued";

  while (Date.now() - start < Number(__ENV.QUEUE_POLL_TIMEOUT_MS || "120000")) {
    const statusRoute = `/api/queue/llm/${jobId}`;
    const statusHeaders = scenarioHeaders({ includeAuth: true, includeServiceIdentity: true });
    const statusRes = http.get(
      `${BASE_URL}${statusRoute}`,
      scenarioParams(statusRoute, statusHeaders, { traffic_class: "queue-status" }),
    );
    noteHttpResult(statusRes, statusRoute, { count429: false, count503: false });
    const statusPayload = readJson(statusRes)?.data ?? readJson(statusRes) ?? {};
    state = statusPayload.status || state;

    if (state === "active" && queueStartedAt === null) {
      queueStartedAt = Date.now();
    }

    if (state === "completed") {
      const completedAt = Date.now();
      if (queueStartedAt === null) {
        queueStartedAt = completedAt;
      }

      const resultRoute = `/api/queue/llm/${jobId}/result`;
      const resultHeaders = scenarioHeaders({ includeAuth: true, includeServiceIdentity: true });
      const resultRes = http.get(
        `${BASE_URL}${resultRoute}`,
        scenarioParams(resultRoute, resultHeaders, { traffic_class: "queue-result" }),
      );
      noteHttpResult(resultRes, resultRoute, { count429: false, count503: false });
      const resultPayload = readJson(resultRes)?.data ?? readJson(resultRes) ?? {};
      executionLatencyMs = Number(resultPayload.latency || completedAt - queueStartedAt);

      return {
        queueWaitMs: Math.max(0, queueStartedAt - start),
        executionLatencyMs,
        endToEndMs: Math.max(0, completedAt - start),
        state,
      };
    }

    if (state === "failed" || state === "not_found") {
      return {
        queueWaitMs: queueStartedAt === null ? Date.now() - start : queueStartedAt - start,
        executionLatencyMs: executionLatencyMs ?? 0,
        endToEndMs: Date.now() - start,
        state,
      };
    }

    sleep(Number(__ENV.QUEUE_POLL_INTERVAL_SECONDS || "0.5"));
  }

  return {
    queueWaitMs: queueStartedAt === null ? Date.now() - start : queueStartedAt - start,
    executionLatencyMs: executionLatencyMs ?? 0,
    endToEndMs: Date.now() - start,
    state: "timeout",
  };
}

export function queueWorkflowScenario() {
  if (!scenarioRequirements.queueWorkflowBacklog) {
    recordSkippedScenario("queueWorkflowBacklog", "missing_env");
    return;
  }

  const route = "/api/queue/llm";
  const headers = scenarioHeaders({
    includeAuth: true,
    includeCsrf: true,
    includeServiceIdentity: true,
  });
  maybeAttachCookieHeader(headers, true);

  const payload = JSON.stringify({
    type: "custom_prompt",
    prompt: `Benchmark queued workflow ${randomSuffix()}`,
    model: LLM_MODEL,
    maxTokens: Number(__ENV.QUEUE_MAX_TOKENS || "128"),
    temperature: Number(__ENV.QUEUE_TEMPERATURE || "0.1"),
    metadata: {
      profile: PROFILE,
      source: "k6",
      workflow: "queue-backed-llm",
    },
  });

  queueWorkflowRequests.add(1, { profile: PROFILE });
  const res = http.post(
    `${BASE_URL}${route}`,
    payload,
    scenarioParams(route, headers, { traffic_class: "queue-submit" }),
  );
  noteHttpResult(res, route);

  const payloadJson = readJson(res);
  const jobId = payloadJson?.data?.jobId;
  check(res, {
    "queue workflow accepted or backpressured": (r) => [202, 400, 401, 403, 429, 503].includes(r.status),
  });

  if (res.status === 202 && jobId) {
    fetchQueueMetrics();
    const queueMetrics = pollQueuedWorkflow(jobId);
    queueWaitLatency.add(queueMetrics.queueWaitMs, { profile: PROFILE, state: queueMetrics.state });
    queueExecutionLatency.add(queueMetrics.executionLatencyMs, { profile: PROFILE, state: queueMetrics.state });
    queueEndToEndLatency.add(queueMetrics.endToEndMs, { profile: PROFILE, state: queueMetrics.state });
  }
}

function metricValue(data, metricName, statName, fallback = null) {
  return data.metrics?.[metricName]?.values?.[statName] ?? fallback;
}

function trendSummary(data, metricName) {
  return {
    p50: metricValue(data, metricName, "p(50)", null),
    p95: metricValue(data, metricName, "p(95)", null),
    p99: metricValue(data, metricName, "p(99)", null),
    avg: metricValue(data, metricName, "avg", null),
    max: metricValue(data, metricName, "max", null),
  };
}

function thresholdStatus(data) {
  return Object.fromEntries(
    Object.entries(data.metrics || {}).flatMap(([metricName, metric]) =>
      Object.entries(metric.thresholds || {}).map(([thresholdName, threshold]) => [
        `${metricName}:${thresholdName}`,
        Boolean(threshold.ok),
      ]),
    ),
  );
}

export function handleSummary(data) {
  const overall = trendSummary(data, "http_req_duration");
  const agents = trendSummary(data, "agents_completion_latency");
  const llmTtfb = trendSummary(data, "llm_ttfb_latency");
  const llmCompletion = trendSummary(data, "llm_completion_latency");
  const queueWait = trendSummary(data, "queue_wait_latency");
  const queueExecution = trendSummary(data, "queue_execution_latency");
  const queueEndToEnd = trendSummary(data, "queue_end_to_end_latency");

  const summary = {
    timestamp: new Date().toISOString(),
    profile: PROFILE,
    description: selectedProfile.description,
    target_vus: selectedProfile.defaultVus,
    scenario_requirements,
    hpa_thresholds: {
      waiting_jobs_per_pod: HPA_WAITING_JOBS_PER_POD,
      delayed_jobs_per_pod: HPA_DELAYED_JOBS_PER_POD,
      max_replicas: HPA_MAX_REPLICAS,
      waiting_jobs_total: QUEUE_WAITING_THRESHOLD,
      delayed_jobs_total: QUEUE_DELAYED_THRESHOLD,
    },
    totals: {
      http_requests: metricValue(data, "http_reqs", "count", 0),
      iterations: metricValue(data, "iterations", "count", 0),
      rps: metricValue(data, "http_reqs", "rate", 0),
      agent_requests: metricValue(data, "agents_requests_total", "count", 0),
      llm_requests: metricValue(data, "llm_requests_total", "count", 0),
      queue_workflow_requests: metricValue(data, "queue_workflow_requests_total", "count", 0),
      skipped_iterations: metricValue(data, "skipped_scenario_iterations_total", "count", 0),
    },
    latency_ms: {
      overall,
      agents,
      llm_ttfb: llmTtfb,
      llm_completion: llmCompletion,
      queue_wait: queueWait,
      queue_execution: queueExecution,
      queue_end_to_end: queueEndToEnd,
      p50: overall.p50,
      p95: overall.p95,
      p99: overall.p99,
      critical_p95: Math.max(agents.p95 || 0, llmTtfb.p95 || 0, queueWait.p95 || 0),
    },
    backpressure: {
      rate_429: metricValue(data, "backpressure_429_rate", "rate", 0),
      rate_503: metricValue(data, "backpressure_503_rate", "rate", 0),
    },
    queue_pressure: {
      waiting_jobs_max: metricValue(data, "queue_waiting_jobs", "max", 0),
      delayed_jobs_max: metricValue(data, "queue_delayed_jobs", "max", 0),
      queue_depth_max: metricValue(data, "queue_depth_jobs", "max", 0),
      waiting_ratio_max: metricValue(data, "queue_waiting_ratio", "max", 0),
      delayed_ratio_max: metricValue(data, "queue_delayed_ratio", "max", 0),
    },
    saturation: {
      vus_max: metricValue(data, "vus_max", "max", 0),
      dropped_iterations: metricValue(data, "dropped_iterations", "count", 0),
      blocked_p95_ms: metricValue(data, "http_req_blocked", "p(95)", 0),
    },
    error_rate: metricValue(data, "errors", "rate", 0),
    thresholds: thresholdStatus(data),
    thresholds_passed: Object.values(thresholdStatus(data)).every(Boolean),
  };

  return {
    stdout: JSON.stringify(summary, null, 2) + "\n",
    [SUMMARY_FILE]: JSON.stringify(summary, null, 2),
    [RESULTS_FILE]: JSON.stringify(data, null, 2),
    [REPORT_FILE]: JSON.stringify(
      {
        profile: PROFILE,
        summary,
      },
      null,
      2,
    ),
  };
}
