import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 25 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.SDUI_BASE_URL || 'http://localhost:4173';

export default function () {
  const res = http.get(`${BASE_URL}/api/agent/runtime/health`);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'json payload present': (r) => !!r.body,
  });

  const agentRes = http.post(`${BASE_URL}/api/agent/runtime/query`, JSON.stringify({ prompt: 'healthcheck' }), {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  check(agentRes, {
    'agent endpoint healthy': (r) => r.status === 200,
  });

  sleep(1);
}
