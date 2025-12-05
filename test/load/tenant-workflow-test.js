/**
 * k6 scenario: Tenant workflow (Login → Profile → Agent Workflow)
 *
 * Simulates a full tenant journey to validate SLA targets and connection tuning.
 *
 * Run baseline (2-pod min):
 *   k6 run test/load/tenant-workflow-test.js
 *
 * Run with custom concurrency:
 *   k6 run --vus 60 --duration 10m -e API_URL=https://api.valuecanvas.com \
 *     -e AUTH_EMAIL=user@example.com -e AUTH_PASSWORD=secret \
 *     test/load/tenant-workflow-test.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

export const options = {
  stages: [
    { duration: '2m', target: 30 }, // warm-up against 2-pod baseline
    { duration: '5m', target: 60 }, // 2x current peak target
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate==0'],
    tenant_workflow_duration: ['p(95)<200'],
    tenant_login_latency: ['p(95)<200'],
    tenant_profile_latency: ['p(95)<200'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const LOGIN_URL = __ENV.LOGIN_URL || `${BASE_URL}/auth/v1/token?grant_type=password`;
const PROFILE_URL = __ENV.PROFILE_URL || `${BASE_URL}/api/health/ready`;
const WORKFLOW_URL = __ENV.WORKFLOW_URL || `${BASE_URL}/api/llm/chat`;
const AUTH_EMAIL = __ENV.AUTH_EMAIL || 'test@example.com';
const AUTH_PASSWORD = __ENV.AUTH_PASSWORD || 'password';
const AUTH_API_KEY = __ENV.AUTH_API_KEY || __ENV.SUPABASE_ANON_KEY;
const STATIC_TOKEN = __ENV.AUTH_TOKEN;
const WORKFLOW_MODEL = __ENV.WORKFLOW_MODEL || 'meta-llama/Llama-3-8b-chat-hf';
const WORKFLOW_PROMPT =
  __ENV.WORKFLOW_PROMPT || 'Kick off the agent workflow for a multi-tenant profile health check.';

const workflowLatency = new Trend('tenant_workflow_duration');
const loginLatency = new Trend('tenant_login_latency');
const profileLatency = new Trend('tenant_profile_latency');
const workflowErrors = new Rate('tenant_workflow_errors');
const loginErrors = new Rate('tenant_login_errors');
const profileErrors = new Rate('tenant_profile_errors');
const journeys = new Counter('tenant_journeys');

function authenticate() {
  if (STATIC_TOKEN) {
    return STATIC_TOKEN;
  }

  const payload = JSON.stringify({ email: AUTH_EMAIL, password: AUTH_PASSWORD });
  const params = {
    headers: {
      'Content-Type': 'application/json',
      ...(AUTH_API_KEY ? { apikey: AUTH_API_KEY } : {}),
    },
    tags: { name: 'login' },
  };

  const start = Date.now();
  const res = http.post(LOGIN_URL, payload, params);
  loginLatency.add(Date.now() - start);

  const ok = check(res, {
    'login succeeded': (r) => r.status === 200 && r.body.includes('access_token'),
  });
  loginErrors.add(ok ? 0 : 1);

  if (!ok) {
    console.error(`Login failed (${res.status}): ${res.body}`);
    return null;
  }

  try {
    const body = JSON.parse(res.body);
    return body.access_token;
  } catch (error) {
    console.error(`Unable to parse login response: ${error}`);
    return null;
  }
}

function fetchProfile(token) {
  const params = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    tags: { name: 'profile' },
  };

  const start = Date.now();
  const res = http.get(PROFILE_URL, params);
  profileLatency.add(Date.now() - start);

  const ok = check(res, {
    'profile fetched': (r) => r.status === 200,
  });
  profileErrors.add(ok ? 0 : 1);

  if (!ok) {
    console.error(`Profile fetch failed (${res.status}): ${res.body}`);
  }
}

function startWorkflow(token) {
  const payload = JSON.stringify({
    prompt: WORKFLOW_PROMPT,
    model: WORKFLOW_MODEL,
    maxTokens: 200,
    temperature: 0.4,
    metadata: { tenant_flow: true },
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    tags: { name: 'tenant-workflow' },
  };

  const start = Date.now();
  const res = http.post(WORKFLOW_URL, payload, params);
  workflowLatency.add(Date.now() - start);

  const ok = check(res, {
    'workflow started': (r) => r.status === 200,
    'no timeouts': (r) => r.timings.duration < 5000,
  });
  workflowErrors.add(ok ? 0 : 1);

  if (!ok) {
    console.error(`Workflow start failed (${res.status}): ${res.body}`);
  }
}

export function setup() {
  console.log(`Running tenant workflow load against ${BASE_URL}`);
}

export default function () {
  const token = authenticate();

  if (!token) {
    sleep(1);
    return;
  }

  fetchProfile(token);
  startWorkflow(token);
  journeys.add(1);

  sleep(Math.random() + 0.5);
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(
      {
        vusMax: data.metrics.vus_max.values.max,
        httpFailures: data.metrics.http_req_failed.values.rate,
        p95Latency: data.metrics.tenant_workflow_duration.values['p(95)'],
        loginP95: data.metrics.tenant_login_latency.values['p(95)'],
        profileP95: data.metrics.tenant_profile_latency.values['p(95)'],
      },
      null,
      2
    ),
    'tenant-workflow-summary.json': JSON.stringify(data, null, 2),
  };
}
