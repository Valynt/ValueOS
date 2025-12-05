import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const sduiDuration = new Trend('sdui_duration', true);
const agentDuration = new Trend('agent_duration', true);

export const options = {
  stages: [
    { duration: '30s', target: 25 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.01'],
    sdui_duration: ['p(95)<600'],
    agent_duration: ['p(95)<1200'],
  },
};

const BASE_URL = __ENV.SDUI_BASE_URL || 'http://localhost:4173';

export default function () {
  const res = http.get(`${BASE_URL}/api/agent/runtime/health`, { tags: { endpoint: 'sdui-health' } });
  sduiDuration.add(res.timings.duration);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'json payload present': (r) => !!r.body,
  });

  const agentRes = http.post(`${BASE_URL}/api/agent/runtime/query`, JSON.stringify({ prompt: 'healthcheck' }), {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { endpoint: 'agent-runtime' },
  });
  agentDuration.add(agentRes.timings.duration);

  check(agentRes, {
    'agent endpoint healthy': (r) => r.status === 200,
    'agent payload returned': (r) => r.body && r.body.length > 0,
  });

  sleep(1);
}
