---
name: load-testing-performance-tuning
description: Performs load testing with K6/Locust and tunes Horizontal Pod Autoscaling based on custom metrics for optimal agent performance
---

# Load Testing & Performance Tuning

This skill implements comprehensive load testing and performance tuning for ValueOS's 18 agent types, using K6 and Locust to simulate realistic workloads and fine-tune Horizontal Pod Autoscaling (HPA) based on custom metrics beyond CPU utilization.

## When to Run

Run this skill when:
- Validating system performance before production deployment
- Identifying bottlenecks in inter-agent communication
- Tuning autoscaling policies for optimal resource usage
- Stress testing agent workflows and message queues
- Optimizing performance for expected production loads
- Troubleshooting performance degradation issues

## K6 Load Testing Implementation

### Agent Communication Load Testing

#### Basic Agent Load Test Script
```javascript
// tests/load/agent-communication-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics for agent-specific monitoring
const agentResponseTime = new Trend('agent_response_time');
const agentErrorRate = new Rate('agent_error_rate');
const messageQueueDepth = new Trend('message_queue_depth');

// Test configuration
export const options = {
  scenarios: {
    agent_load_test: {
      executor: 'ramping-vus',
      stages: [
        { duration: '2m', target: 50 },   // Ramp up to 50 users
        { duration: '5m', target: 200 },  // Ramp up to 200 users
        { duration: '3m', target: 500 },  // Ramp up to 500 users
        { duration: '5m', target: 1000 }, // Peak load with 1000 users
        { duration: '2m', target: 0 },    // Ramp down to 0 users
      ],
      tags: { test_type: 'agent_load' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.1'],
    agent_response_time: ['p(95)<300'],
    agent_error_rate: ['rate<0.05'],
  },
};

// Agent endpoints to test
const agents = [
  'sentiment-agent',
  'classification-agent',
  'orchestration-agent',
  'communication-agent',
  'ml-processing-agent',
  // ... other 13 agents
];

export default function () {
  // Randomly select an agent to simulate real-world distribution
  const targetAgent = agents[Math.floor(Math.random() * agents.length)];

  // Simulate different types of requests
  const requestTypes = ['analyze', 'process', 'query', 'update'];
  const requestType = requestTypes[Math.floor(Math.random() * requestTypes.length)];

  // Generate realistic payload based on agent type
  const payload = generateAgentPayload(targetAgent, requestType);

  const response = http.post(
    `https://api.valueos.com/agents/${targetAgent}/${requestType}`,
    JSON.stringify(payload),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${__ENV.API_TOKEN}',
      },
      timeout: '30s',
    }
  );

  // Record custom metrics
  agentResponseTime.add(response.timings.duration);
  agentErrorRate.add(response.status >= 400);

  // Check response validity
  const checkResult = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has valid response structure': (r) => {
      try {
        const jsonResponse = JSON.parse(r.body);
        return jsonResponse.hasOwnProperty('result') || jsonResponse.hasOwnProperty('data');
      } catch (e) {
        return false;
      }
    },
    'no server errors': (r) => r.status < 500,
  });

  // Simulate realistic think time between requests
  sleep(Math.random() * 2 + 1); // 1-3 second think time
}

function generateAgentPayload(agentType, requestType) {
  const basePayload = {
    timestamp: new Date().toISOString(),
    requestId: `req_${__VU}_${__ITER}`,
  };

  switch (agentType) {
    case 'sentiment-agent':
      return {
        ...basePayload,
        text: 'This is a sample text for sentiment analysis that needs to be processed.',
        language: 'en',
        priority: Math.random() > 0.8 ? 'high' : 'normal',
      };

    case 'classification-agent':
      return {
        ...basePayload,
        content: 'Sample content to be classified into categories.',
        categories: ['positive', 'negative', 'neutral'],
        confidence: 0.8,
      };

    case 'orchestration-agent':
      return {
        ...basePayload,
        workflow: 'sentiment-analysis-pipeline',
        agents: ['sentiment-agent', 'classification-agent'],
        timeout: 30000,
      };

    default:
      return {
        ...basePayload,
        data: `Sample data for ${agentType} processing`,
        metadata: {
          source: 'load-test',
          version: '1.0',
        },
      };
  }
}

// Setup function to initialize test environment
export function setup() {
  console.log('Setting up load test environment...');

  // Verify all agents are healthy before starting
  agents.forEach(agent => {
    const healthCheck = http.get(`https://api.valueos.com/agents/${agent}/health`);
    if (healthCheck.status !== 200) {
      console.error(`Agent ${agent} is not healthy: ${healthCheck.status}`);
    }
  });

  return { agents };
}

// Teardown function to clean up
export function teardown(data) {
  console.log('Load test completed. Cleaning up...');
  // Any cleanup logic here
}
```

#### Advanced Multi-Agent Workflow Testing
```javascript
// tests/load/multi-agent-workflow-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';

// Test complex agent workflows
export const options = {
  scenarios: {
    workflow_load: {
      executor: 'constant-vus',
      vus: 20,
      duration: '10m',
    },
  },
};

const workflows = [
  {
    name: 'sentiment-analysis-workflow',
    steps: [
      { agent: 'input-validation-agent', operation: 'validate' },
      { agent: 'sentiment-agent', operation: 'analyze' },
      { agent: 'result-formatter-agent', operation: 'format' },
    ],
  },
  {
    name: 'document-processing-workflow',
    steps: [
      { agent: 'document-parser-agent', operation: 'parse' },
      { agent: 'classification-agent', operation: 'classify' },
      { agent: 'indexing-agent', operation: 'index' },
      { agent: 'storage-agent', operation: 'store' },
    ],
  },
  // ... more complex workflows
];

export default function () {
  // Select random workflow
  const workflow = workflows[Math.floor(Math.random() * workflows.length)];

  // Track workflow execution
  const workflowStart = new Date();
  let currentContext = {};

  for (const step of workflow.steps) {
    const stepStart = new Date();

    const payload = {
      workflowId: `wf_${exec.vu.idInTest}_${exec.scenario.iterationInTest}`,
      step: step.operation,
      context: currentContext,
      timestamp: stepStart.toISOString(),
    };

    const response = http.post(
      `https://api.valueos.com/agents/${step.agent}/${step.operation}`,
      JSON.stringify(payload),
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Workflow-ID': payload.workflowId,
        },
      }
    );

    const stepDuration = new Date() - stepStart;

    // Validate step response
    const stepCheck = check(response, {
      [`${step.agent} ${step.operation} success`]: (r) => r.status === 200,
      [`${step.agent} step duration < 5s`]: () => stepDuration < 5000,
    });

    if (!stepCheck) {
      console.error(`Workflow ${workflow.name} failed at step ${step.agent}/${step.operation}`);
      break;
    }

    // Update context for next step
    try {
      const responseData = JSON.parse(response.body);
      currentContext = { ...currentContext, [step.agent]: responseData };
    } catch (e) {
      console.error(`Failed to parse response from ${step.agent}`);
    }

    // Small delay between steps
    sleep(0.1);
  }

  const workflowDuration = new Date() - workflowStart;

  // Validate complete workflow
  check(workflowDuration, {
    'workflow completes within 30s': (d) => d < 30000,
  });
}
```

## Locust Load Testing Alternative

### Locust Test Implementation
```python
# tests/load/locust_agent_load.py
from locust import HttpUser, task, between, events
from locust.runners import MasterRunner, WorkerRunner
import json
import random
import time

class AgentLoadTest(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        self.client.headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.environment.parsed_options.api_token}'
        }

    @task(3)
    def sentiment_analysis(self):
        payload = {
            "text": "This is a sample text for sentiment analysis that demonstrates the agent's capabilities under load.",
            "language": "en",
            "priority": "normal",
            "requestId": f"locust_{self.user_id}_{int(time.time())}"
        }

        with self.client.post("/agents/sentiment-agent/analyze",
                            json=payload,
                            catch_response=True) as response:
            if response.status_code == 200:
                try:
                    data = response.json()
                    if 'sentiment' in data:
                        response.success()
                    else:
                        response.failure("Invalid response structure")
                except json.JSONDecodeError:
                    response.failure("Invalid JSON response")
            else:
                response.failure(f"HTTP {response.status_code}")

    @task(2)
    def document_classification(self):
        payload = {
            "content": "Sample document content that needs to be classified into appropriate categories for processing.",
            "categories": ["technical", "business", "personal"],
            "confidence_threshold": 0.7,
            "requestId": f"locust_{self.user_id}_{int(time.time())}"
        }

        with self.client.post("/agents/classification-agent/classify",
                            json=payload,
                            catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"HTTP {response.status_code}")

    @task(1)
    def orchestration_workflow(self):
        workflow_id = f"workflow_{self.user_id}_{int(time.time())}"

        payload = {
            "workflowId": workflow_id,
            "type": "document-processing",
            "agents": ["parser-agent", "classification-agent", "indexing-agent"],
            "timeout": 30000,
            "priority": "normal"
        }

        start_time = time.time()
        with self.client.post("/agents/orchestration-agent/execute",
                            json=payload,
                            catch_response=True) as response:
            duration = time.time() - start_time

            if response.status_code == 200:
                if duration < 30:  # 30 second SLA
                    response.success()
                else:
                    response.failure(f"Workflow too slow: {duration:.2f}s")
            else:
                response.failure(f"HTTP {response.status_code}")

# Custom event handlers
@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    print("Starting agent load test...")

@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    print("Agent load test completed.")

@events.request.add_listener
def on_request(request_type, name, response_time, response_length, response,
               context, exception, start_time, url, **kwargs):
    # Custom request logging
    if exception:
        print(f"Request failed: {name} - {exception}")
```

## Horizontal Pod Autoscaling Tuning

### Custom Metrics-Based HPA

#### Queue Depth-Based Scaling
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agent-queue-hpa
  namespace: valueos-agents
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: processing-agent
  minReplicas: 2
  maxReplicas: 50
  metrics:
  - type: Pods
    pods:
      metric:
        name: valueos_agent_queue_depth
      target:
        type: AverageValue
        averageValue: 100
    # Scale up when average queue depth > 100
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 60
        # Allow doubling the number of pods in 60 seconds
```

#### Response Time-Based Scaling
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agent-latency-hpa
  namespace: valueos-agents
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ml-agent
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Pods
    pods:
      metric:
        name: valueos_agent_task_duration_seconds
        selector:
          matchLabels:
            quantile: "0.95"
      target:
        type: AverageValue
        averageValue: 5
    # Scale up when 95th percentile latency > 5 seconds
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 600  # Slower scale down
      policies:
      - type: Pods
        value: 1
        periodSeconds: 300
    scaleUp:
      stabilizationWindowSeconds: 120  # Faster scale up for latency
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
```

#### Throughput-Based Scaling
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agent-throughput-hpa
  namespace: valueos-agents
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: communication-agent
  minReplicas: 5
  maxReplicas: 100
  metrics:
  - type: Pods
    pods:
      metric:
        name: valueos_agent_tasks_total
      target:
        type: AverageValue
        averageValue: 1000
    # Scale up when average tasks per pod per minute > 1000
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 900  # Very slow scale down
      policies:
      - type: Percent
        value: 10
        periodSeconds: 300
    scaleUp:
      stabilizationWindowSeconds: 30  # Fast scale up for throughput
      policies:
      - type: Percent
        value: 200
        periodSeconds: 30
```

### Advanced HPA Strategies

#### Multi-Metric HPA with Weights
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agent-multi-metric-hpa
  namespace: valueos-agents
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: orchestration-agent
  minReplicas: 3
  maxReplicas: 30
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Pods
    pods:
      metric:
        name: valueos_orchestration_workflow_duration_seconds
        selector:
          matchLabels:
            quantile: "0.95"
      target:
        type: AverageValue
        averageValue: 10
  - type: Pods
    pods:
      metric:
        name: valueos_agent_queue_depth
      target:
        type: AverageValue
        averageValue: 50
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
      selectPolicy: Max  # Scale based on the metric that needs it most
```

#### Predictive Scaling with Custom Metrics
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agent-predictive-hpa
  namespace: valueos-agents
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ml-agent
  minReplicas: 5
  maxReplicas: 40
  metrics:
  - type: External
    external:
      metric:
        name: valueos_agent_predictive_load
        selector:
          matchLabels:
            agent_type: ml-processing
      target:
        type: AverageValue
        averageValue: 75
    # Scale based on predictive load metric (combines historical patterns + current queue)
```

## Performance Analysis and Optimization

### Load Test Result Analysis

#### K6 Result Processing
```javascript
// analyze-load-results.js
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

async function analyzeLoadTestResults(testOutput) {
  // Parse K6 JSON output
  const results = JSON.parse(fs.readFileSync(testOutput, 'utf8'));

  // Extract key metrics
  const metrics = {
    totalRequests: results.metrics.http_reqs.values.count,
    avgResponseTime: results.metrics.http_req_duration.values.avg,
    p95ResponseTime: results.metrics.http_req_duration.values['p(95)'],
    errorRate: results.metrics.http_req_failed.values.rate,
    agentResponseTime: results.metrics.agent_response_time?.values?.avg || 0,
    agentErrorRate: results.metrics.agent_error_rate?.values?.rate || 0,
  };

  // Identify bottlenecks
  const bottlenecks = [];

  if (metrics.p95ResponseTime > 1000) {
    bottlenecks.push({
      type: 'latency',
      severity: 'high',
      message: `95th percentile response time (${metrics.p95ResponseTime}ms) exceeds 1s threshold`,
      recommendation: 'Consider optimizing agent processing or increasing replica count'
    });
  }

  if (metrics.errorRate > 0.05) {
    bottlenecks.push({
      type: 'errors',
      severity: 'critical',
      message: `Error rate (${(metrics.errorRate * 100).toFixed(2)}%) exceeds 5% threshold`,
      recommendation: 'Investigate agent failures and implement circuit breakers'
    });
  }

  if (metrics.agentResponseTime > 500) {
    bottlenecks.push({
      type: 'agent_performance',
      severity: 'medium',
      message: `Agent response time (${metrics.agentResponseTime}ms) indicates processing bottleneck`,
      recommendation: 'Profile agent code and optimize resource allocation'
    });
  }

  return {
    metrics,
    bottlenecks,
    recommendations: generateRecommendations(metrics, bottlenecks)
  };
}

function generateRecommendations(metrics, bottlenecks) {
  const recommendations = [];

  if (bottlenecks.some(b => b.type === 'latency')) {
    recommendations.push({
      category: 'scaling',
      action: 'Increase agent replica count or implement HPA',
      priority: 'high'
    });
  }

  if (bottlenecks.some(b => b.type === 'agent_performance')) {
    recommendations.push({
      category: 'optimization',
      action: 'Profile agent code and optimize database queries',
      priority: 'medium'
    });
  }

  if (metrics.totalRequests > 10000) {
    recommendations.push({
      category: 'infrastructure',
      action: 'Consider implementing request queuing and rate limiting',
      priority: 'low'
    });
  }

  return recommendations;
}

// Usage
analyzeLoadTestResults('load-test-results.json')
  .then(analysis => {
    console.log('Load Test Analysis:', JSON.stringify(analysis, null, 2));
  });
```

### Performance Benchmarking

#### Agent Performance Baselines
```javascript
// tests/performance/agent-baselines.js
export const performanceBaselines = {
  'sentiment-agent': {
    maxResponseTime: 200, // ms
    maxErrorRate: 0.01,   // 1%
    minThroughput: 100,   // requests/second
    targetConcurrency: 50,
  },
  'classification-agent': {
    maxResponseTime: 500,
    maxErrorRate: 0.02,
    minThroughput: 75,
    targetConcurrency: 30,
  },
  'orchestration-agent': {
    maxResponseTime: 1000,
    maxErrorRate: 0.05,
    minThroughput: 25,
    targetConcurrency: 10,
  },
  // ... baselines for all 18 agents
};

export function validatePerformanceBaseline(agentType, metrics) {
  const baseline = performanceBaselines[agentType];
  if (!baseline) {
    return { valid: false, reason: 'No baseline defined for agent type' };
  }

  const violations = [];

  if (metrics.avgResponseTime > baseline.maxResponseTime) {
    violations.push(`Response time ${metrics.avgResponseTime}ms exceeds baseline ${baseline.maxResponseTime}ms`);
  }

  if (metrics.errorRate > baseline.maxErrorRate) {
    violations.push(`Error rate ${(metrics.errorRate * 100).toFixed(2)}% exceeds baseline ${(baseline.maxErrorRate * 100).toFixed(2)}%`);
  }

  if (metrics.throughput < baseline.minThroughput) {
    violations.push(`Throughput ${metrics.throughput} req/s below baseline ${baseline.minThroughput} req/s`);
  }

  return {
    valid: violations.length === 0,
    violations,
    baseline,
  };
}
```

### Continuous Performance Monitoring

#### Automated Performance Regression Detection
```yaml
# GitHub Actions workflow for performance monitoring
name: Performance Monitoring
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 */4 * * *'  # Every 4 hours

jobs:
  performance-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup K6
        run: |
          curl https://github.com/grafana/k6/releases/download/v0.45.0/k6-v0.45.0-linux-amd64.tar.gz -L | tar xvz
          sudo mv k6-v0.45.0-linux-amd64/k6 /usr/local/bin/

      - name: Run Performance Tests
        run: |
          k6 run --out json=performance-results.json tests/performance/agent-baselines.js

      - name: Analyze Results
        run: |
          node scripts/analyze-performance.js performance-results.json

      - name: Upload Results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: performance-results.json

      - name: Performance Regression Check
        run: |
          # Compare with previous baseline
          if [ -f performance-baseline.json ]; then
            node scripts/check-regression.js performance-results.json performance-baseline.json
          fi

      - name: Update Baseline
        run: |
          cp performance-results.json performance-baseline.json
```

This comprehensive load testing and performance tuning approach ensures optimal scaling and resource utilization across all 18 ValueOS agent types under various load conditions.
