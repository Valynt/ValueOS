/**
 * K6 Load Test for LLM Endpoints
 * 
 * Tests LLM API performance under various load conditions
 * 
 * Run: k6 run test/load/llm-load-test.js
 * Run with options: k6 run --vus 10 --duration 30s test/load/llm-load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const llmLatency = new Trend('llm_latency');
const cacheHitRate = new Rate('cache_hits');
const costPerRequest = new Trend('cost_per_request');
const tokensPerRequest = new Trend('tokens_per_request');
const requestCounter = new Counter('requests_total');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up to 10 users
    { duration: '5m', target: 10 },   // Stay at 10 users
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'], // 95% of requests should be below 5s
    http_req_failed: ['rate<0.05'],    // Error rate should be below 5%
    errors: ['rate<0.05'],
    llm_latency: ['p(95)<3000'],       // 95% of LLM requests below 3s
    cache_hits: ['rate>0.3'],          // Cache hit rate above 30%
  },
};

// Test data
const prompts = [
  'Generate a business model canvas for a SaaS startup',
  'Create a value proposition for an e-commerce platform',
  'Suggest key partners for a fintech company',
  'Identify customer segments for a B2B software',
  'Describe revenue streams for a subscription service',
  'List key activities for a marketplace platform',
  'Define cost structure for a mobile app',
  'Outline channels for a direct-to-consumer brand',
  'Explain customer relationships for an enterprise solution',
  'Detail key resources for a technology startup',
];

const models = [
  'meta-llama/Llama-3-70b-chat-hf',
  'meta-llama/Llama-3-8b-chat-hf',
  'mistralai/Mixtral-8x7B-Instruct-v0.1',
];

// Environment variables
const BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-token';

/**
 * Setup function - runs once per VU
 */
export function setup() {
  console.log(`Starting load test against ${BASE_URL}`);
  
  // Verify API is accessible
  const healthCheck = http.get(`${BASE_URL}/health/ready`);
  check(healthCheck, {
    'API is healthy': (r) => r.status === 200,
  });
  
  return { startTime: Date.now() };
}

/**
 * Main test function - runs for each VU iteration
 */
export default function(data) {
  const prompt = prompts[Math.floor(Math.random() * prompts.length)];
  const model = models[Math.floor(Math.random() * models.length)];
  
  const payload = JSON.stringify({
    prompt: prompt,
    model: model,
    maxTokens: 500,
    temperature: 0.7,
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    },
    tags: {
      name: 'LLM Request',
      model: model,
    },
  };
  
  // Make LLM request
  const startTime = Date.now();
  const response = http.post(`${BASE_URL}/api/llm/chat`, payload, params);
  const duration = Date.now() - startTime;
  
  // Record metrics
  requestCounter.add(1);
  llmLatency.add(duration);
  
  // Check response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response has content': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && body.data.content;
      } catch (e) {
        return false;
      }
    },
    'response time < 5s': (r) => r.timings.duration < 5000,
  });
  
  if (!success) {
    errorRate.add(1);
    console.error(`Request failed: ${response.status} - ${response.body}`);
  } else {
    errorRate.add(0);
    
    // Parse response for additional metrics
    try {
      const body = JSON.parse(response.body);
      
      // Track cache hits
      if (body.data.cached) {
        cacheHitRate.add(1);
      } else {
        cacheHitRate.add(0);
      }
      
      // Track cost
      if (body.data.cost !== undefined) {
        costPerRequest.add(body.data.cost);
      }
      
      // Track tokens
      if (body.data.usage && body.data.usage.totalTokens) {
        tokensPerRequest.add(body.data.usage.totalTokens);
      }
    } catch (e) {
      console.error(`Failed to parse response: ${e}`);
    }
  }
  
  // Random sleep between 1-3 seconds to simulate user behavior
  sleep(Math.random() * 2 + 1);
}

/**
 * Teardown function - runs once after all VUs complete
 */
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Load test completed in ${duration}s`);
  
  // Get final statistics
  const stats = http.get(`${BASE_URL}/api/llm/stats`);
  if (stats.status === 200) {
    console.log('Final LLM Statistics:');
    console.log(stats.body);
  }
}

/**
 * Handle summary - custom summary output
 */
export function handleSummary(data) {
  const summary = {
    test_duration: data.state.testRunDurationMs / 1000,
    total_requests: data.metrics.requests_total.values.count,
    error_rate: data.metrics.errors.values.rate,
    avg_latency: data.metrics.llm_latency.values.avg,
    p95_latency: data.metrics.llm_latency.values['p(95)'],
    p99_latency: data.metrics.llm_latency.values['p(99)'],
    cache_hit_rate: data.metrics.cache_hits.values.rate,
    avg_cost: data.metrics.cost_per_request.values.avg,
    total_cost: data.metrics.cost_per_request.values.count * data.metrics.cost_per_request.values.avg,
    avg_tokens: data.metrics.tokens_per_request.values.avg,
  };
  
  return {
    'stdout': JSON.stringify(summary, null, 2),
    'summary.json': JSON.stringify(data, null, 2),
    'summary.html': generateHTMLReport(summary),
  };
}

/**
 * Generate HTML report
 */
function generateHTMLReport(summary) {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>K6 Load Test Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { color: #333; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #4CAF50; color: white; }
    tr:nth-child(even) { background-color: #f2f2f2; }
    .pass { color: green; font-weight: bold; }
    .fail { color: red; font-weight: bold; }
  </style>
</head>
<body>
  <h1>LLM Load Test Report</h1>
  <p>Generated: ${new Date().toISOString()}</p>
  
  <h2>Summary</h2>
  <table>
    <tr><th>Metric</th><th>Value</th></tr>
    <tr><td>Test Duration</td><td>${summary.test_duration.toFixed(2)}s</td></tr>
    <tr><td>Total Requests</td><td>${summary.total_requests}</td></tr>
    <tr><td>Error Rate</td><td class="${summary.error_rate < 0.05 ? 'pass' : 'fail'}">${(summary.error_rate * 100).toFixed(2)}%</td></tr>
    <tr><td>Average Latency</td><td>${summary.avg_latency.toFixed(2)}ms</td></tr>
    <tr><td>P95 Latency</td><td class="${summary.p95_latency < 5000 ? 'pass' : 'fail'}">${summary.p95_latency.toFixed(2)}ms</td></tr>
    <tr><td>P99 Latency</td><td>${summary.p99_latency.toFixed(2)}ms</td></tr>
    <tr><td>Cache Hit Rate</td><td class="${summary.cache_hit_rate > 0.3 ? 'pass' : 'fail'}">${(summary.cache_hit_rate * 100).toFixed(2)}%</td></tr>
    <tr><td>Average Cost</td><td>$${summary.avg_cost.toFixed(6)}</td></tr>
    <tr><td>Total Cost</td><td>$${summary.total_cost.toFixed(4)}</td></tr>
    <tr><td>Average Tokens</td><td>${summary.avg_tokens.toFixed(0)}</td></tr>
  </table>
  
  <h2>Thresholds</h2>
  <table>
    <tr><th>Threshold</th><th>Status</th></tr>
    <tr><td>Error rate &lt; 5%</td><td class="${summary.error_rate < 0.05 ? 'pass' : 'fail'}">${summary.error_rate < 0.05 ? 'PASS' : 'FAIL'}</td></tr>
    <tr><td>P95 latency &lt; 5s</td><td class="${summary.p95_latency < 5000 ? 'pass' : 'fail'}">${summary.p95_latency < 5000 ? 'PASS' : 'FAIL'}</td></tr>
    <tr><td>Cache hit rate &gt; 30%</td><td class="${summary.cache_hit_rate > 0.3 ? 'pass' : 'fail'}">${summary.cache_hit_rate > 0.3 ? 'PASS' : 'FAIL'}</td></tr>
  </table>
</body>
</html>
  `;
}
