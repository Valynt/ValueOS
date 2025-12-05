# Load Testing Guide

## Overview

Load testing ensures ValueCanvas can handle expected traffic and identifies performance bottlenecks before they impact users.

## Tools

- **k6**: Modern load testing tool with JavaScript scripting
- **Grafana**: Visualize k6 metrics in real-time
- **InfluxDB**: Store load test metrics

## Installation

### Install k6

```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
choco install k6

# Docker
docker pull grafana/k6
```

### Install Grafana + InfluxDB (optional)

```bash
cd infrastructure
docker-compose -f docker-compose.observability.yml up -d
```

## Test Types

### 1. Load Test

Tests normal expected load:

```bash
k6 run test/load/llm-load-test.js
```

**Purpose**: Verify system handles expected traffic  
**Duration**: 20-30 minutes  
**VUs**: 10 → 50 → 100  
**Success Criteria**:
- P95 latency < 5s
- Error rate < 5%
- Cache hit rate > 30%

### 2. Spike Test

Tests sudden traffic spikes:

```bash
k6 run test/load/spike-test.js
```

**Purpose**: Verify system handles traffic spikes  
**Duration**: 5 minutes  
**VUs**: 10 → 200 → 10  
**Success Criteria**:
- P95 latency < 10s during spike
- Error rate < 10%
- System recovers after spike

### 3. Stress Test

Finds system breaking point:

```bash
k6 run test/load/stress-test.js
```

**Purpose**: Find maximum capacity  
**Duration**: 15-20 minutes  
**VUs**: 50 → 300  
**Success Criteria**:
- Identify breaking point
- Document degradation pattern
- Verify graceful degradation

### 4. Soak Test

Tests long-term stability:

```bash
k6 run --duration 2h --vus 50 test/load/llm-load-test.js
```

**Purpose**: Find memory leaks and resource exhaustion  
**Duration**: 2-4 hours  
**VUs**: 50 constant  
**Success Criteria**:
- No memory leaks
- Stable performance over time
- No resource exhaustion

## Running Tests

### Basic Usage

```bash
# Run with default options
k6 run test/load/llm-load-test.js

# Run with custom VUs and duration
k6 run --vus 50 --duration 5m test/load/llm-load-test.js

# Run with environment variables
k6 run -e API_URL=https://api.valuecanvas.com -e AUTH_TOKEN=xxx test/load/llm-load-test.js
```

### Advanced Options

```bash
# Output to InfluxDB
k6 run --out influxdb=http://localhost:8086/k6 test/load/llm-load-test.js

# Output to JSON
k6 run --out json=results.json test/load/llm-load-test.js

# Run in cloud
k6 cloud test/load/llm-load-test.js

# Run with custom thresholds
k6 run --threshold http_req_duration=p(95)<3000 test/load/llm-load-test.js
```

### Docker Usage

```bash
# Run in Docker
docker run --rm -i grafana/k6 run - <test/load/llm-load-test.js

# With network access
docker run --rm -i --network=host grafana/k6 run - <test/load/llm-load-test.js
```

## Interpreting Results

### Key Metrics

```
http_req_duration.........: avg=1.2s  min=500ms med=1s   max=5s   p(90)=2s   p(95)=3s
http_req_failed...........: 2.5%
http_reqs.................: 10000 (166.67/s)
vus.......................: 100
vus_max...................: 100
```

**Good Performance**:
- P95 latency < 5s
- Error rate < 5%
- Throughput meets requirements

**Poor Performance**:
- P95 latency > 10s
- Error rate > 10%
- Increasing latency over time

### Custom Metrics

```
llm_latency...............: avg=1.5s  p(95)=3s
cache_hits................: 45%
cost_per_request..........: avg=$0.002
tokens_per_request........: avg=300
```

## Test Scenarios

### Tenant Workflow SLA (Login → Profile → Agent)

Use the new end-to-end tenant script to validate the 2-pod baseline and tuning knobs:

```bash
# Baseline against the 2-pod minimum
k6 run test/load/tenant-workflow-test.js

# Override endpoints or credentials as needed
k6 run --vus 60 --duration 10m \
  -e API_URL=https://api.valuecanvas.com \
  -e LOGIN_URL=https://api.valuecanvas.com/auth/v1/token?grant_type=password \
  -e PROFILE_URL=https://api.valuecanvas.com/api/user/profile \
  -e WORKFLOW_URL=https://api.valuecanvas.com/api/llm/chat \
  -e AUTH_EMAIL=user@example.com -e AUTH_PASSWORD=secret \
  test/load/tenant-workflow-test.js
```

**Acceptance targets:** P95 < 200ms across login, profile, and workflow steps; no `ECONNRESET` or timeouts.

**Tuning guidance:**
- Set `UV_THREADPOOL_SIZE` to 8–16 (higher if crypto/fs heavy) before starting the Node containers.
- Start Postgres pools at `PG_POOL_MIN=4`, `PG_POOL_MAX=40`, `PG_POOL_IDLE_TIMEOUT_MS=10000`, `PG_POOL_CONNECTION_TIMEOUT_MS=2000` and adjust based on active connection graphs.
- Run baseline, then increase/decrease pool size until p95 stabilizes without saturating connections; keep utilization <80%.
- Hold at 2x peak (default VUs=60) and confirm zero connection resets in k6 output and API logs.

### Scenario 1: Normal Business Hours

```javascript
export const options = {
  stages: [
    { duration: '5m', target: 50 },   // Morning ramp-up
    { duration: '30m', target: 50 },  // Steady morning traffic
    { duration: '5m', target: 100 },  // Lunch spike
    { duration: '30m', target: 75 },  // Afternoon traffic
    { duration: '5m', target: 25 },   // Evening wind-down
  ],
};
```

### Scenario 2: Product Launch

```javascript
export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '30s', target: 500 },  // Launch spike
    { duration: '10m', target: 500 },
    { duration: '5m', target: 200 },
    { duration: '10m', target: 200 },
  ],
};
```

### Scenario 3: Gradual Growth

```javascript
export const options = {
  stages: [
    { duration: '10m', target: 50 },
    { duration: '10m', target: 100 },
    { duration: '10m', target: 150 },
    { duration: '10m', target: 200 },
  ],
};
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Load Test

on:
  schedule:
    - cron: '0 2 * * 0'  # Weekly on Sunday at 2 AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      
      - name: Run load test
        run: |
          k6 run \
            -e API_URL=${{ secrets.STAGING_API_URL }} \
            -e AUTH_TOKEN=${{ secrets.LOAD_TEST_TOKEN }} \
            --out json=results.json \
            test/load/llm-load-test.js
      
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: load-test-results
          path: |
            results.json
            summary.json
            summary.html
      
      - name: Check thresholds
        run: |
          if grep -q '"failed":true' results.json; then
            echo "Load test failed thresholds"
            exit 1
          fi
```

## Monitoring During Tests

### Real-time Monitoring

```bash
# Terminal 1: Run test
k6 run --out influxdb=http://localhost:8086/k6 test/load/llm-load-test.js

# Terminal 2: Watch metrics
watch -n 1 'curl -s http://localhost:3000/api/llm/stats | jq'

# Terminal 3: Monitor logs
kubectl logs -f -l app=api-server --tail=100
```

### Grafana Dashboard

1. Open Grafana: http://localhost:3001
2. Add InfluxDB data source
3. Import k6 dashboard
4. Monitor in real-time

## Troubleshooting

### High Error Rate

```bash
# Check rate limiting
curl http://localhost:3000/api/llm/stats | jq '.togetherAI.failures'

# Check circuit breaker
curl http://localhost:3000/api/llm/health

# Check logs
kubectl logs -l app=api-server | grep ERROR
```

### High Latency

```bash
# Check database
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"

# Check Redis
redis-cli --latency

# Check LLM provider
curl https://status.together.ai/api/v2/status.json
```

### Memory Issues

```bash
# Check memory usage
kubectl top pods

# Check for memory leaks
k6 run --duration 30m --vus 50 test/load/llm-load-test.js
# Monitor memory over time
```

## Best Practices

### 1. Test in Staging First

```bash
# Always test in staging before production
k6 run -e API_URL=https://staging.valuecanvas.com test/load/llm-load-test.js
```

### 2. Gradual Load Increase

```javascript
// Good: Gradual ramp-up
stages: [
  { duration: '2m', target: 10 },
  { duration: '2m', target: 50 },
  { duration: '2m', target: 100 },
]

// Bad: Sudden spike
stages: [
  { duration: '10s', target: 100 },
]
```

### 3. Use Realistic Data

```javascript
// Good: Varied prompts
const prompts = loadFromFile('prompts.json');

// Bad: Same prompt every time
const prompt = 'test';
```

### 4. Monitor Costs

```javascript
// Track LLM costs during test
export function handleSummary(data) {
  const totalCost = data.metrics.cost_per_request.values.count * 
                    data.metrics.cost_per_request.values.avg;
  console.log(`Total test cost: $${totalCost.toFixed(2)}`);
}
```

### 5. Clean Up After Tests

```bash
# Clear test data
psql $DATABASE_URL -c "DELETE FROM llm_usage WHERE user_id LIKE 'test-%';"

# Clear cache
redis-cli FLUSHDB
```

## Performance Targets

### Current Targets

| Metric | Target | Current |
|--------|--------|---------|
| P95 Latency | < 5s | 3.2s |
| P99 Latency | < 10s | 6.5s |
| Error Rate | < 5% | 2.1% |
| Throughput | > 100 req/s | 150 req/s |
| Cache Hit Rate | > 30% | 45% |
| Cost per Request | < $0.005 | $0.002 |

### Capacity Planning

```
Current capacity: 100 concurrent users
Target capacity: 500 concurrent users
Growth rate: 20% per quarter

Required improvements:
- Horizontal scaling: 3 → 10 pods
- Database: Read replicas
- Redis: Cluster mode
- LLM: Rate limit increase
```

## Reports

### Generate HTML Report

```bash
k6 run --out json=results.json test/load/llm-load-test.js
# HTML report generated automatically as summary.html
```

### Share Results

```bash
# Upload to k6 Cloud
k6 cloud test/load/llm-load-test.js

# Or export to S3
aws s3 cp summary.html s3://valuecanvas-reports/load-tests/$(date +%Y%m%d)/
```

## Support

For issues or questions:
- Documentation: This file
- Slack: #performance
- k6 docs: https://k6.io/docs/
