/**
 * K6 Spike Test for LLM Endpoints
 * 
 * Tests system behavior under sudden traffic spikes
 * 
 * Run: k6 run test/load/spike-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const llmLatency = new Trend('llm_latency');

export const options = {
  stages: [
    { duration: '1m', target: 10 },    // Normal load
    { duration: '30s', target: 200 },  // Spike to 200 users
    { duration: '1m', target: 200 },   // Stay at spike
    { duration: '30s', target: 10 },   // Return to normal
    { duration: '1m', target: 10 },    // Recover
  ],
  thresholds: {
    http_req_duration: ['p(95)<10000'], // Allow higher latency during spike
    http_req_failed: ['rate<0.1'],      // Allow 10% error rate during spike
    errors: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-token';

export default function() {
  const payload = JSON.stringify({
    prompt: 'Generate a quick business model canvas',
    model: 'meta-llama/Llama-3-8b-chat-hf', // Use faster model
    maxTokens: 200,
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
    'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
    'response time < 10s': (r) => r.timings.duration < 10000,
  });
  
  errorRate.add(success ? 0 : 1);
  
  sleep(0.5); // Minimal sleep during spike
}
