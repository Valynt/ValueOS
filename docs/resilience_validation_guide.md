# Resilience Validation Guide

This document outlines how to interpret the results of the `scripts/load-test.js` execution and certifies the system for production specific to resilience requirements.

## 1. Running the Load Test

> [!NOTE]
> Ensure you have k6 installed or use the docker command below.

```bash
# Run with local k6
k6 run scripts/load-test.js

# Or using Docker
docker run --rm -i -v $(pwd)/scripts:/scripts grafana/k6 run /scripts/load-test.js
```

## 2. Success Criteria (Golden Signals)

| Signal              | Metric                      | Threshold          | Pass/Fail |
| :------------------ | :-------------------------- | :----------------- | :-------- |
| **Latency**         | `http_req_duration` (P95)   | < 30s              | [ ]       |
| **Circuit Breaker** | `circuit_breaker_trips`     | > 0 (during spike) | [ ]       |
| **Recovery**        | `llm_circuit_breaker_state` | 0 -> 1 -> 0        | [ ]       |

### Interpretation

- **Green**: Latency < 30s and Circuit Breaker trips ONLY during the `resilience_spike` phase (3m-8m mark).
- **Red**:
  - Latency > 30s (Backend timeout failed).
  - Circuit Breaker never trips (Safety mechanism failed).
  - Circuit Breaker stays open (Recovery failed).

## 3. Monitoring via Prometheus

Ensure your Grafana dashboard connects to the following metrics exposed at `/metrics`:

- `agent_query_latency_seconds_bucket`
- `llm_circuit_breaker_state`
- `resilience_events_total`
