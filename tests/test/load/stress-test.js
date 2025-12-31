/**
 * K6 Stress Test for LLM Endpoints
 * 
 * Tests system limits by gradually increasing load until failure
 * 
 * Run: k6 run test/load/stress-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const llmLatency = new Trend('llm_latency');

export const options = {
  stages: [
    { duration: '2m', target: 50 },
    { duration: '2m', target: 100 },
    { duration: '2m', target: 150 },
    { duration: '2m', target: 200 },
    { duration: '2m', target: 250 },
    { duration: '2m', target: 300 },
    { duration: '5m', target: 300 }, // Hold at max
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    // No strict thresholds - we want to find the breaking point
    http_req_duration: ['p(95)<15000'],
    http_req_failed: ['rate<0.2'], // Allow 20% error rate
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-token';

export default function() {
  const payload = JSON.stringify({
    prompt: 'Generate a business model canvas',
    model: 'meta-llama/Llama-3-70b-chat-hf',
    maxTokens: 500,
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    },
  };
  
  const startTime = Date.now();
  const response = http.post(`${BASE_URL}/api/llm/chat`, payload, params);
  const duration = Date.now() - startTime;
  
  llmLatency.add(duration);
  
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
  });
  
  errorRate.add(success ? 0 : 1);
  
  if (!success) {
    console.log(`Failed at VU: ${__VU}, Iteration: ${__ITER}, Status: ${response.status}`);
  }
  
  sleep(1);
}

export function handleSummary(data) {
  const breakingPoint = findBreakingPoint(data);
  
  return {
    'stdout': `Breaking point: ~${breakingPoint} concurrent users\n`,
    'stress-test-results.json': JSON.stringify({
      breaking_point: breakingPoint,
      max_rps: data.metrics.http_reqs.values.rate,
      p95_latency: data.metrics.http_req_duration.values['p(95)'],
      error_rate: data.metrics.http_req_failed.values.rate,
    }, null, 2),
  };
}

function findBreakingPoint(data) {
  // Simplified: find when error rate exceeded 10%
  const errorRate = data.metrics.http_req_failed.values.rate;
  if (errorRate > 0.1) {
    return Math.floor(data.metrics.vus.values.max * 0.8);
  }
  return data.metrics.vus.values.max;
}
