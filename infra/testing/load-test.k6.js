/**
 * k6 load test for ValueOS API concurrency guards and queue-backed workflows.
 *
 * Profiles:
 *   - ci-50 / nightly-50: moderate concurrency guard validation (~50+ total VUs)
 *   - ci-200 / nightly-200: sustained heavy load (~200 total VUs)
 *   - ci-spike / nightly-spike: burst profile to force queueing and backpressure
 *
 * Usage:
 *   k6 run \
 *     --env BASE_URL=https://staging.valueos.app \
 *     --env AUTH_TOKEN=<jwt> \
 *     --env PROFILE=ci-50 \
 *     --env TENANT_ID=<tenant-uuid> \
 *     --env ONBOARDING_CONTEXT_ID=<context-uuid> \
 *     infra/testing/load-test.k6.js
 */

import { check, group, sleep } from "k6";
import http from "k6/http";
import exec from "k6/execution";
import { Counter, Rate, Trend } from "k6/metrics";

const DEFAULT_AGENT_ID = __ENV.AGENT_ID || "opportunity";
const DEFAULT_LLM_MODEL = __ENV.LLM_MODEL || "gpt-4o-mini";
const DEFAULT_LLM_MAX_TOKENS = Number(__ENV.LLM_MAX_TOKENS || "256");
const DEFAULT_LLM_TEMPERATURE = Number(__ENV.LLM_TEMPERATURE || "0.2");
const DEFAULT_QUEUE_WEBSITE = __ENV.ONBOARDING_WEBSITE || "https://valueos.ai";
const DEFAULT_CSRF_TOKEN = __ENV.CSRF_TOKEN || "k6-load-test-csrf-token";
const DEFAULT_OUTPUT_PREFIX = (__ENV.OUTPUT_PREFIX || ".").replace(/\/$/, "");
const BASE_URL = (__ENV.BASE_URL || "").replace(/\/$/, "");
const AUTH_TOKEN = __ENV.AUTH_TOKEN || "";
const TENANT_ID = __ENV.TENANT_ID || "";
const ONBOARDING_CONTEXT_ID = __ENV.ONBOARDING_CONTEXT_ID || "";
const PROFILE = __ENV.PROFILE || "ci-50";
const QUEUE_POLL_INTERVAL_MS = Number(__ENV.QUEUE_POLL_INTERVAL_MS || "1000");
const QUEUE_MAX_POLLS = Number(__ENV.QUEUE_MAX_POLLS || "45");

const WORKER_HPA_THRESHOLDS = {
  minReplicas: 2,
  maxReplicas: 12,
  waitingJobsPerPodTarget: 20,
  delayedJobsPerPodTarget: 50,
  scaleUpWindowSeconds: 30,
  scaleDownWindowSeconds: 300,
};

const errors = new Rate("errors");
const http429Rate = new Rate("http_429_rate");
const http503Rate = new Rate("http_503_rate");
const queueIncompleteRate = new Rate("queue_incomplete_rate");

const totalIterations = new Counter("scenario_iterations_total");
const queueJobsCreated = new Counter("queue_jobs_created_total");

const healthLatency = new Trend("health_latency", true);
const agentsTtfbLatency = new Trend("agents_ttfb_latency", true);
const agentsCompletionLatency = new Trend("agents_completion_latency", true);
const llmTtfbLatency = new Trend("llm_ttfb_latency", true);
const llmCompletionLatency = new Trend("llm_completion_latency", true);
const queueRequestLatency = new Trend("queue_request_latency", true);
const queueWaitLatency = new Trend("queue_wait_latency", true);
const queueExecutionLatency = new Trend("queue_execution_latency", true);
const queueEndToEndLatency = new Trend("queue_end_to_end_latency", true);

const ROUTE_TAGS = {
  health: { route: "/health", latency_class: "interactive" },
  agents: { route: "/api/agents/:agentId/info", latency_class: "guarded" },
  llm: { route: "/api/llm/chat", latency_class: "guarded" },
  onboardingCreate: { route: "/api/onboarding/research", latency_class: "queue" },
  onboardingPoll: { route: "/api/onboarding/research/:jobId", latency_class: "queue" },
};

const PROFILE_CONFIGS = {
  "ci-50": {
    description: "CI guardrail profile with 50+ total VUs",
    scenarios: {
      health_baseline: constantVusScenario("healthScenario", 4, "90s"),
      agents_guard: constantVusScenario("agentsConcurrencyScenario", 24, "2m"),
      llm_guard: constantVusScenario("llmConcurrencyScenario", 18, "2m"),
      queue_backlog: constantVusScenario("queueBacklogScenario", 12, "2m"),
    },
    thresholds: thresholdSet({
      agentsP95: 2500,
      agentsP99: 5000,
      llmTtfbP95: 2000,
      llmTtfbP99: 5000,
      llmCompletionP95: 10000,
      llmCompletionP99: 15000,
      queueWaitP95: 30000,
      queueWaitP99: 60000,
      queueExecutionP95: 120000,
      queueExecutionP99: 180000,
      rate429: 0.03,
      rate503: 0.08,
      queueIncomplete: 0.25,
      httpFailed: 0.12,
    }),
  },
  "ci-200": {
    description: "CI sustained heavy-load profile with ~200 total VUs",
    scenarios: {
      health_baseline: constantVusScenario("healthScenario", 8, "2m"),
      agents_guard: constantVusScenario("agentsConcurrencyScenario", 80, "3m"),
      llm_guard: constantVusScenario("llmConcurrencyScenario", 70, "3m"),
      queue_backlog: constantVusScenario("queueBacklogScenario", 50, "3m"),
    },
    thresholds: thresholdSet({
      agentsP95: 4000,
      agentsP99: 8000,
      llmTtfbP95: 3500,
      llmTtfbP99: 7000,
      llmCompletionP95: 14000,
      llmCompletionP99: 20000,
      queueWaitP95: 45000,
      queueWaitP99: 90000,
      queueExecutionP95: 180000,
      queueExecutionP99: 240000,
      rate429: 0.06,
      rate503: 0.15,
      queueIncomplete: 0.4,
      httpFailed: 0.2,
    }),
  },
  "ci-spike": {
    description: "CI spike profile to validate burst backpressure handling",
    scenarios: {
      health_baseline: constantVusScenario("healthScenario", 4, "2m"),
      agents_guard: spikeScenario("agentsConcurrencyScenario", [
        { duration: "30s", target: 18 },
        { duration: "1m", target: 90 },
        { duration: "1m", target: 120 },
        { duration: "45s", target: 24 },
        { duration: "30s", target: 0 },
      ]),
      llm_guard: spikeScenario("llmConcurrencyScenario", [
        { duration: "30s", target: 12 },
        { duration: "1m", target: 70 },
        { duration: "1m", target: 96 },
        { duration: "45s", target: 18 },
        { duration: "30s", target: 0 },
      ]),
      queue_backlog: spikeScenario("queueBacklogScenario", [
        { duration: "30s", target: 8 },
        { duration: "1m", target: 45 },
        { duration: "1m", target: 60 },
        { duration: "45s", target: 15 },
        { duration: "30s", target: 0 },
      ]),
    },
    thresholds: thresholdSet({
      agentsP95: 5000,
      agentsP99: 9000,
      llmTtfbP95: 4000,
      llmTtfbP99: 8000,
      llmCompletionP95: 15000,
      llmCompletionP99: 22000,
      queueWaitP95: 60000,
      queueWaitP99: 120000,
      queueExecutionP95: 240000,
      queueExecutionP99: 300000,
      rate429: 0.1,
      rate503: 0.25,
      queueIncomplete: 0.5,
      httpFailed: 0.28,
    }),
  },
  "nightly-50": {
    description: "Nightly moderate guardrail profile",
    scenarios: {
      health_baseline: constantVusScenario("healthScenario", 4, "3m"),
      agents_guard: constantVusScenario("agentsConcurrencyScenario", 24, "5m"),
      llm_guard: constantVusScenario("llmConcurrencyScenario", 18, "5m"),
      queue_backlog: constantVusScenario("queueBacklogScenario", 12, "5m"),
    },
    thresholds: thresholdSet({
      agentsP95: 2500,
      agentsP99: 4500,
      llmTtfbP95: 1800,
      llmTtfbP99: 4000,
      llmCompletionP95: 9000,
      llmCompletionP99: 14000,
      queueWaitP95: 30000,
      queueWaitP99: 60000,
      queueExecutionP95: 120000,
      queueExecutionP99: 180000,
      rate429: 0.025,
      rate503: 0.06,
      queueIncomplete: 0.2,
      httpFailed: 0.1,
    }),
  },
  "nightly-200": {
    description: "Nightly sustained heavy-load regression benchmark",
    scenarios: {
      health_baseline: constantVusScenario("healthScenario", 8, "3m"),
      agents_guard: constantVusScenario("agentsConcurrencyScenario", 80, "8m"),
      llm_guard: constantVusScenario("llmConcurrencyScenario", 70, "8m"),
      queue_backlog: constantVusScenario("queueBacklogScenario", 50, "8m"),
    },
    thresholds: thresholdSet({
      agentsP95: 3500,
      agentsP99: 7000,
      llmTtfbP95: 3000,
      llmTtfbP99: 6500,
      llmCompletionP95: 13000,
      llmCompletionP99: 19000,
      queueWaitP95: 45000,
      queueWaitP99: 90000,
      queueExecutionP95: 180000,
      queueExecutionP99: 240000,
      rate429: 0.05,
      rate503: 0.12,
      queueIncomplete: 0.3,
      httpFailed: 0.16,
    }),
  },
  "nightly-spike": {
    description: "Nightly burst benchmark for backpressure regression tracking",
    scenarios: {
      health_baseline: constantVusScenario("healthScenario", 4, "3m"),
      agents_guard: spikeScenario("agentsConcurrencyScenario", [
        { duration: "45s", target: 18 },
        { duration: "2m", target: 90 },
        { duration: "2m", target: 120 },
        { duration: "90s", target: 24 },
        { duration: "45s", target: 0 },
      ]),
      llm_guard: spikeScenario("llmConcurrencyScenario", [
        { duration: "45s", target: 12 },
        { duration: "2m", target: 70 },
        { duration: "2m", target: 96 },
        { duration: "90s", target: 18 },
        { duration: "45s", target: 0 },
      ]),
      queue_backlog: spikeScenario("queueBacklogScenario", [
        { duration: "45s", target: 8 },
        { duration: "2m", target: 45 },
        { duration: "2m", target: 60 },
        { duration: "90s", target: 15 },
        { duration: "45s", target: 0 },
      ]),
    },
    thresholds: thresholdSet({
      agentsP95: 4500,
      agentsP99: 8500,
      llmTtfbP95: 3600,
      llmTtfbP99: 7500,
      llmCompletionP95: 14500,
      llmCompletionP99: 21000,
      queueWaitP95: 60000,
      queueWaitP99: 120000,
      queueExecutionP95: 240000,
      queueExecutionP99: 300000,
      rate429: 0.08,
      rate503: 0.2,
      queueIncomplete: 0.4,
      httpFailed: 0.24,
    }),
  },
};

const profileConfig = PROFILE_CONFIGS[PROFILE];
if (!profileConfig) {
  throw new Error(`Unsupported PROFILE '${PROFILE}'. Expected one of: ${Object.keys(PROFILE_CONFIGS).join(", ")}`);
}

if (!BASE_URL) {
  throw new Error("BASE_URL environment variable is required");
}

if (!AUTH_TOKEN) {
  throw new Error("AUTH_TOKEN environment variable is required for authenticated concurrency-guard scenarios");
}

if (!TENANT_ID) {
  throw new Error("TENANT_ID environment variable is required to keep agent and queue workflows tenant-scoped");
}

if (!ONBOARDING_CONTEXT_ID) {
  throw new Error("ONBOARDING_CONTEXT_ID environment variable is required for queue-backed onboarding research workflows");
}

export const options = {
  discardResponseBodies: false,
  scenarios: profileConfig.scenarios,
  thresholds: profileConfig.thresholds,
  summaryTrendStats: ["avg", "min", "med", "max", "p(50)", "p(95)", "p(99)"],
};

function constantVusScenario(execName, vus, duration) {
  return {
    executor: "constant-vus",
    exec: execName,
    vus,
    duration,
    gracefulStop: "30s",
    tags: { profile: PROFILE, exec: execName },
  };
}

function spikeScenario(execName, stages) {
  return {
    executor: "ramping-vus",
    exec: execName,
    startVUs: 0,
    stages,
    gracefulRampDown: "30s",
    gracefulStop: "30s",
    tags: { profile: PROFILE, exec: execName },
  };
}

function thresholdSet(config) {
  return {
    errors: [`rate<${config.httpFailed}`],
    http_req_failed: [`rate<${config.httpFailed}`],
    dropped_iterations: ["count==0"],
    http_429_rate: [`rate<${config.rate429}`],
    http_503_rate: [`rate<${config.rate503}`],
    queue_incomplete_rate: [`rate<${config.queueIncomplete}`],
    health_latency: ["p(99)<200"],
    agents_completion_latency: [
      "p(50)<1000",
      `p(95)<${config.agentsP95}`,
      `p(99)<${config.agentsP99}`,
    ],
    agents_ttfb_latency: [
      "p(50)<500",
      `p(95)<${Math.round(config.agentsP95 * 0.7)}`,
      `p(99)<${Math.round(config.agentsP99 * 0.7)}`,
    ],
    llm_ttfb_latency: [
      "p(50)<1000",
      `p(95)<${config.llmTtfbP95}`,
      `p(99)<${config.llmTtfbP99}`,
    ],
    llm_completion_latency: [
      "p(50)<5000",
      `p(95)<${config.llmCompletionP95}`,
      `p(99)<${config.llmCompletionP99}`,
    ],
    queue_wait_latency: [
      `p(50)<${WORKER_HPA_THRESHOLDS.scaleUpWindowSeconds * 1000}`,
      `p(95)<${config.queueWaitP95}`,
      `p(99)<${config.queueWaitP99}`,
    ],
    queue_execution_latency: [
      "p(50)<90000",
      `p(95)<${config.queueExecutionP95}`,
      `p(99)<${config.queueExecutionP99}`,
    ],
    queue_end_to_end_latency: [
      `p(95)<${config.queueWaitP95 + config.queueExecutionP95}`,
      `p(99)<${config.queueWaitP99 + config.queueExecutionP99}`,
    ],
  };
}

function baseHeaders({ includeJson = true, includeCsrf = false } = {}) {
  const headers = {};
  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }
  headers.Authorization = `Bearer ${AUTH_TOKEN}`;
  if (includeCsrf) {
    headers["x-csrf-token"] = DEFAULT_CSRF_TOKEN;
    headers.Cookie = `csrf_token=${DEFAULT_CSRF_TOKEN}`;
  }
  return headers;
}

function trackCommonOutcome(res) {
  totalIterations.add(1);
  const is429 = res.status === 429;
  const is503 = res.status === 503;
  const isFailure = res.status >= 500 || is429;
  errors.add(isFailure);
  http429Rate.add(is429);
  http503Rate.add(is503);
}

function agentInfoUrl() {
  return `${BASE_URL}/api/agents/${DEFAULT_AGENT_ID}/info`;
}

function llmChatUrl() {
  return `${BASE_URL}/api/llm/chat`;
}

function onboardingCreateUrl() {
  return `${BASE_URL}/api/onboarding/research`;
}

function onboardingPollUrl(jobId) {
  return `${BASE_URL}/api/onboarding/research/${jobId}`;
}

function buildLlmPayload() {
  const iterationId = `${exec.scenario.name}-${exec.vu.idInTest}-${exec.vu.iterationInScenario}`;
  return JSON.stringify({
    prompt: `Provide a concise benchmark-safe completion for ${iterationId} without external calls.`,
    model: DEFAULT_LLM_MODEL,
    maxTokens: DEFAULT_LLM_MAX_TOKENS,
    temperature: DEFAULT_LLM_TEMPERATURE,
    stream: true,
    dealId: __ENV.LLM_DEAL_ID || undefined,
  });
}

function buildOnboardingPayload() {
  return JSON.stringify({
    contextId: ONBOARDING_CONTEXT_ID,
    website: DEFAULT_QUEUE_WEBSITE,
    industry: __ENV.ONBOARDING_INDUSTRY || "software",
    companySize: __ENV.ONBOARDING_COMPANY_SIZE || "enterprise",
    salesMotion: __ENV.ONBOARDING_SALES_MOTION || "b2b",
  });
}

export function healthScenario() {
  group("health", () => {
    const response = http.get(`${BASE_URL}/health`, { tags: ROUTE_TAGS.health });
    healthLatency.add(response.timings.duration);
    trackCommonOutcome(response);
    check(response, {
      "health responded": (res) => res.status === 200,
    });
  });
  sleep(0.2);
}

export function agentsConcurrencyScenario() {
  const response = http.get(agentInfoUrl(), {
    headers: baseHeaders({ includeJson: false }),
    tags: ROUTE_TAGS.agents,
    timeout: __ENV.AGENTS_TIMEOUT || "30s",
  });

  agentsTtfbLatency.add(response.timings.waiting);
  agentsCompletionLatency.add(response.timings.duration);
  trackCommonOutcome(response);

  check(response, {
    "agent metadata returns success/backpressure": (res) => [200, 429, 503].includes(res.status),
  });
}

export function llmConcurrencyScenario() {
  const response = http.post(llmChatUrl(), buildLlmPayload(), {
    headers: baseHeaders({ includeCsrf: true }),
    tags: ROUTE_TAGS.llm,
    timeout: __ENV.LLM_TIMEOUT || "90s",
  });

  llmTtfbLatency.add(response.timings.waiting);
  llmCompletionLatency.add(response.timings.duration);
  trackCommonOutcome(response);

  check(response, {
    "llm returns success/backpressure": (res) => [200, 429, 503].includes(res.status),
  });
}

export function queueBacklogScenario() {
  const createResponse = http.post(onboardingCreateUrl(), buildOnboardingPayload(), {
    headers: baseHeaders(),
    tags: ROUTE_TAGS.onboardingCreate,
    timeout: __ENV.QUEUE_CREATE_TIMEOUT || "30s",
  });

  queueRequestLatency.add(createResponse.timings.duration);
  trackCommonOutcome(createResponse);

  const accepted = check(createResponse, {
    "queue workflow accepted": (res) => [201, 202, 429, 503].includes(res.status),
  });

  if (!accepted || ![201, 202].includes(createResponse.status)) {
    queueIncompleteRate.add(createResponse.status >= 400);
    return;
  }

  queueJobsCreated.add(1);

  const payload = parseJsonBody(createResponse.body);
  const jobId = payload?.data?.id ?? payload?.data?.jobId;
  if (!jobId) {
    queueIncompleteRate.add(true);
    return;
  }

  let startedAtMs = null;
  let completedAtMs = null;
  let createdAtMs = null;
  let queueWaitRecorded = false;

  for (let poll = 0; poll < QUEUE_MAX_POLLS; poll += 1) {
    sleep(QUEUE_POLL_INTERVAL_MS / 1000);
    const statusResponse = http.get(onboardingPollUrl(jobId), {
      headers: baseHeaders({ includeJson: false }),
      tags: ROUTE_TAGS.onboardingPoll,
      timeout: __ENV.QUEUE_STATUS_TIMEOUT || "20s",
    });

    trackCommonOutcome(statusResponse);

    if (![200, 404, 429, 503].includes(statusResponse.status)) {
      continue;
    }

    if (statusResponse.status !== 200) {
      continue;
    }

    const statusPayload = parseJsonBody(statusResponse.body)?.data;
    const status = statusPayload?.status;

    createdAtMs = parseTimestamp(statusPayload?.created_at ?? statusPayload?.createdAt);
    startedAtMs = parseTimestamp(statusPayload?.started_at ?? statusPayload?.startedAt) ?? startedAtMs;
    completedAtMs = parseTimestamp(statusPayload?.completed_at ?? statusPayload?.completedAt) ?? completedAtMs;

    if (status === "running" && createdAtMs != null && startedAtMs != null && !queueWaitRecorded) {
      queueWaitLatency.add(startedAtMs - createdAtMs);
      queueWaitRecorded = true;
    }

    if ((status === "completed" || status === "failed") && createdAtMs != null && startedAtMs != null && completedAtMs != null) {
      if (!queueWaitRecorded) {
        queueWaitLatency.add(startedAtMs - createdAtMs);
      }
      queueExecutionLatency.add(completedAtMs - startedAtMs);
      queueEndToEndLatency.add(completedAtMs - createdAtMs);
      queueIncompleteRate.add(status !== "completed");
      return;
    }
  }

  queueIncompleteRate.add(true);
}

function parseJsonBody(body) {
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function parseTimestamp(value) {
  if (!value || typeof value !== "string") {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function metricValue(data, metricName, valueKey, fallback = null) {
  return data.metrics?.[metricName]?.values?.[valueKey] ?? fallback;
}

function thresholdStates(data) {
  const states = {};
  for (const [metricName, metricData] of Object.entries(data.metrics ?? {})) {
    if (!metricData.thresholds) continue;
    states[metricName] = Object.fromEntries(
      Object.entries(metricData.thresholds).map(([thresholdName, thresholdValue]) => [
        thresholdName,
        Boolean(thresholdValue?.ok),
      ]),
    );
  }
  return states;
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    profile: PROFILE,
    profile_description: profileConfig.description,
    base_url: BASE_URL,
    worker_hpa_thresholds: WORKER_HPA_THRESHOLDS,
    total_requests: metricValue(data, "http_reqs", "count", 0),
    rps: metricValue(data, "http_reqs", "rate", 0),
    latency_ms: {
      overall: {
        p50: metricValue(data, "http_req_duration", "p(50)", null),
        p95: metricValue(data, "http_req_duration", "p(95)", null),
        p99: metricValue(data, "http_req_duration", "p(99)", null),
      },
      health: {
        p50: metricValue(data, "health_latency", "p(50)", null),
        p95: metricValue(data, "health_latency", "p(95)", null),
        p99: metricValue(data, "health_latency", "p(99)", null),
      },
      agents: {
        ttfb_p50: metricValue(data, "agents_ttfb_latency", "p(50)", null),
        ttfb_p95: metricValue(data, "agents_ttfb_latency", "p(95)", null),
        ttfb_p99: metricValue(data, "agents_ttfb_latency", "p(99)", null),
        completion_p50: metricValue(data, "agents_completion_latency", "p(50)", null),
        completion_p95: metricValue(data, "agents_completion_latency", "p(95)", null),
        completion_p99: metricValue(data, "agents_completion_latency", "p(99)", null),
      },
      llm: {
        ttfb_p50: metricValue(data, "llm_ttfb_latency", "p(50)", null),
        ttfb_p95: metricValue(data, "llm_ttfb_latency", "p(95)", null),
        ttfb_p99: metricValue(data, "llm_ttfb_latency", "p(99)", null),
        completion_p50: metricValue(data, "llm_completion_latency", "p(50)", null),
        completion_p95: metricValue(data, "llm_completion_latency", "p(95)", null),
        completion_p99: metricValue(data, "llm_completion_latency", "p(99)", null),
      },
      queue: {
        request_p50: metricValue(data, "queue_request_latency", "p(50)", null),
        request_p95: metricValue(data, "queue_request_latency", "p(95)", null),
        request_p99: metricValue(data, "queue_request_latency", "p(99)", null),
        wait_p50: metricValue(data, "queue_wait_latency", "p(50)", null),
        wait_p95: metricValue(data, "queue_wait_latency", "p(95)", null),
        wait_p99: metricValue(data, "queue_wait_latency", "p(99)", null),
        execution_p50: metricValue(data, "queue_execution_latency", "p(50)", null),
        execution_p95: metricValue(data, "queue_execution_latency", "p(95)", null),
        execution_p99: metricValue(data, "queue_execution_latency", "p(99)", null),
        end_to_end_p50: metricValue(data, "queue_end_to_end_latency", "p(50)", null),
        end_to_end_p95: metricValue(data, "queue_end_to_end_latency", "p(95)", null),
        end_to_end_p99: metricValue(data, "queue_end_to_end_latency", "p(99)", null),
      },
      p50: metricValue(data, "http_req_duration", "p(50)", null),
      p95: metricValue(data, "http_req_duration", "p(95)", null),
      p99: metricValue(data, "http_req_duration", "p(99)", null),
      critical_p95: metricValue(data, "agents_completion_latency", "p(95)", null),
    },
    queue_backlog: {
      jobs_created: metricValue(data, "queue_jobs_created_total", "count", 0),
      incomplete_rate: metricValue(data, "queue_incomplete_rate", "rate", 0),
    },
    backpressure: {
      rate_429: metricValue(data, "http_429_rate", "rate", 0),
      rate_503: metricValue(data, "http_503_rate", "rate", 0),
    },
    error_rate: metricValue(data, "errors", "rate", 0),
    saturation: {
      vus_max: metricValue(data, "vus_max", "max", 0),
      dropped_iterations: metricValue(data, "dropped_iterations", "count", 0),
      blocked_p95_ms: metricValue(data, "http_req_blocked", "p(95)", 0),
    },
    thresholds: thresholdStates(data),
    thresholds_passed: Object.values(data.metrics ?? {}).every(
      (metric) => metric.thresholds == null || Object.values(metric.thresholds).every((threshold) => threshold.ok),
    ),
  };

  const markdown = [
    `# k6 Benchmark Summary — ${PROFILE}`,
    "",
    `- Description: ${profileConfig.description}`,
    `- Base URL: ${BASE_URL}`,
    `- Total requests: ${summary.total_requests}`,
    `- RPS: ${summary.rps}`,
    `- Overall p50 / p95 / p99: ${summary.latency_ms.overall.p50} / ${summary.latency_ms.overall.p95} / ${summary.latency_ms.overall.p99}`,
    `- Agents completion p95 / p99: ${summary.latency_ms.agents.completion_p95} / ${summary.latency_ms.agents.completion_p99}`,
    `- LLM TTFB p95 / completion p95: ${summary.latency_ms.llm.ttfb_p95} / ${summary.latency_ms.llm.completion_p95}`,
    `- Queue wait p95 / execution p95: ${summary.latency_ms.queue.wait_p95} / ${summary.latency_ms.queue.execution_p95}`,
    `- 429 rate: ${summary.backpressure.rate_429}`,
    `- 503 rate: ${summary.backpressure.rate_503}`,
    `- Dropped iterations: ${summary.saturation.dropped_iterations}`,
    `- Thresholds passed: ${summary.thresholds_passed}`,
    "",
    "## Worker HPA references",
    `- Waiting jobs target per pod: ${WORKER_HPA_THRESHOLDS.waitingJobsPerPodTarget}`,
    `- Delayed jobs target per pod: ${WORKER_HPA_THRESHOLDS.delayedJobsPerPodTarget}`,
    `- Scale-up stabilization window (seconds): ${WORKER_HPA_THRESHOLDS.scaleUpWindowSeconds}`,
    `- Scale-down stabilization window (seconds): ${WORKER_HPA_THRESHOLDS.scaleDownWindowSeconds}`,
  ].join("\n");

  const summaryPath = `${DEFAULT_OUTPUT_PREFIX}/load-test-summary.json`;
  const resultsPath = `${DEFAULT_OUTPUT_PREFIX}/load-test-results.json`;
  const reportPath = `${DEFAULT_OUTPUT_PREFIX}/load-test-summary.md`;

  return {
    stdout: `${JSON.stringify(summary, null, 2)}\n`,
    [summaryPath]: JSON.stringify(summary, null, 2),
    [resultsPath]: JSON.stringify(data, null, 2),
    [reportPath]: `${markdown}\n`,
  };
}
