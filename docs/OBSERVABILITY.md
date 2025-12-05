# ValueCanvas Observability

## Overview

ValueCanvas implements a comprehensive observability stack for monitoring agent performance, system health, and business metrics.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Agents  │  │Workflows │  │   SDUI   │  │   API    │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │              │             │          │
│       └─────────────┴──────────────┴─────────────┘          │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────┐
│              Observability Layer                             │
│  ┌────────────────────────┴────────────────────────┐        │
│  │         OpenTelemetry Instrumentation           │        │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐     │        │
│  │  │  Traces  │  │ Metrics  │  │   Logs   │     │        │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘     │        │
│  └───────┼─────────────┼─────────────┼────────────┘        │
│          │             │             │                      │
│  ┌───────┼─────────────┼─────────────┼────────────┐        │
│  │       │             │             │            │        │
│  │  ┌────▼─────┐  ┌────▼─────┐  ┌────▼─────┐    │        │
│  │  │  Jaeger  │  │Prometheus│  │   Loki   │    │        │
│  │  │  (Traces)│  │ (Metrics)│  │  (Logs)  │    │        │
│  │  └──────────┘  └──────────┘  └──────────┘    │        │
│  │                                                │        │
│  │  ┌──────────────────────────────────────┐    │        │
│  │  │         Grafana Dashboards           │    │        │
│  │  └──────────────────────────────────────┘    │        │
│  │                                                │        │
│  │  ┌──────────────────────────────────────┐    │        │
│  │  │         Sentry (Errors)              │    │        │
│  │  └──────────────────────────────────────┘    │        │
│  │                                                │        │
│  │  ┌──────────────────────────────────────┐    │        │
│  │  │      Alerting Service                │    │        │
│  │  └──────────────────────────────────────┘    │        │
│  └────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. OpenTelemetry

**Purpose:** Distributed tracing and metrics collection

**Features:**
- Automatic instrumentation of HTTP, database, and cache operations
- Custom spans for agent operations
- Trace context propagation
- Metrics export to OTLP collectors

**Configuration:** `src/config/telemetry.ts`

**Usage:**
```typescript
import { traceAgentExecution } from './lib/observability';

await traceAgentExecution('execute', attributes, async (span) => {
  // Your code here
});
```

**Documentation:** [AGENT_TRACING_GUIDE.md](./AGENT_TRACING_GUIDE.md)

### 2. Metrics Collection

**Purpose:** Track agent performance and business metrics

**Features:**
- Agent success rates
- Response time percentiles (p50, p95, p99)
- Confidence score tracking
- Hallucination detection rates
- Value prediction accuracy
- LLM cost and token usage
- Cache hit rates

**Service:** `src/services/MetricsCollector.ts`

**Database:** PostgreSQL with materialized views for performance

**Metrics:**
- `agent.invocations.total` - Total agent invocations
- `agent.invocations.success` - Successful invocations
- `agent.response_time` - Response time histogram
- `agent.confidence_score` - Confidence score histogram
- `value.predictions.total` - Total predictions
- `value.prediction_error` - Prediction error histogram
- `llm.calls.total` - Total LLM calls
- `llm.latency` - LLM latency histogram
- `llm.cost.total` - Total LLM cost
- `cache.hits.total` - Cache hits
- `cache.misses.total` - Cache misses

### 3. Grafana Dashboards

**Purpose:** Visualize metrics and monitor system health

**Dashboards:**
1. **Agent Performance** - Success rates, response times, confidence scores
2. **LLM Performance** - Latency, cost, token usage, cache hit rates
3. **Value Prediction Accuracy** - Prediction accuracy trends, error rates

**Location:** `grafana/dashboards/`

**Setup:** [grafana/README.md](../grafana/README.md)

### 4. Sentry Integration

**Purpose:** Error tracking and performance monitoring

**Features:**
- Automatic error capture
- Stack traces with source maps
- User context tracking
- Breadcrumbs for debugging
- Session replay
- Performance monitoring

**Configuration:** `src/lib/sentry.ts`

**Setup:** [SENTRY_SETUP.md](./SENTRY_SETUP.md)

### 5. Alerting Service

**Purpose:** Monitor metrics and trigger alerts

**Features:**
- Configurable alert rules
- Multiple severity levels (info, warning, critical)
- Multiple notification channels (Sentry, email, webhook)
- Automatic threshold monitoring
- Alert debouncing

**Service:** `src/services/AlertingService.ts`

**Configuration:** `src/config/alerting.ts`

**Default Alerts:**
- High error rate (\u003e5% warning, \u003e10% critical)
- High hallucination rate (\u003e15% warning, \u003e25% critical)
- Low confidence rate (\u003e30% warning)
- Slow response time (\u003e5s p95, \u003e10s p99)
- High LLM cost (\u003e$10/hr warning, \u003e$50/hr critical)
- Low cache hit rate (\u003c50% warning)

### 6. Value Prediction Tracker

**Purpose:** Track prediction accuracy over time

**Features:**
- Record predictions with confidence
- Compare predictions to actual outcomes
- Calculate accuracy metrics
- Track trends over time
- Identify predictions needing actuals

**Service:** `src/services/ValuePredictionTracker.ts`

**Usage:**
```typescript
import { getValuePredictionTracker } from './services/ValuePredictionTracker';

const tracker = getValuePredictionTracker(supabase);

// Record prediction
await tracker.recordPrediction({
  id: predictionId,
  predictionType: 'roi',
  predictedValue: 100000,
  confidence: 0.85,
  sessionId,
  agentId
});

// Record actual outcome
await tracker.recordActualOutcome({
  predictionId,
  actualValue: 95000,
  measurementDate: new Date(),
  notes: 'Measured after 6 months'
});
```

## Setup

### Prerequisites

1. **PostgreSQL** (Supabase)
2. **Node.js** 20+
3. **OpenTelemetry Collector** (optional)
4. **Grafana** (optional, for dashboards)
5. **Sentry Account** (optional, for error tracking)

### Installation

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Run Database Migrations:**
   ```bash
   # Apply observability tables migration
   psql -h localhost -U postgres -d valuecanvas -f supabase/migrations/20241127_observability_tables.sql
   ```

3. **Configure Environment:**
   ```bash
   # .env.production
   OTLP_ENDPOINT=http://localhost:4318
   OTEL_SERVICE_NAME=valuecanvas-api
   VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
   VITE_SENTRY_ENABLED=true
   ```

4. **Initialize Observability:**
   ```typescript
   import { initializeObservability } from './lib/observability';
   
   initializeObservability();
   ```

### Local Development

1. **Start OpenTelemetry Collector (Optional):**
   ```bash
   docker run -d --name jaeger \
     -p 16686:16686 \
     -p 4318:4318 \
     jaegertracing/all-in-one:latest
   ```

2. **Start Grafana (Optional):**
   ```bash
   docker-compose -f docker-compose.grafana.yml up -d
   ```

3. **View Traces:**
   - Jaeger UI: http://localhost:16686

4. **View Dashboards:**
   - Grafana: http://localhost:3000

## Usage

### Tracing Agents

Add tracing to agent operations:

```typescript
import { traceAgentExecution, recordAgentConfidence } from './lib/observability';

export class MyAgent extends BaseAgent {
  async execute(sessionId: string, input: any) {
    return await traceAgentExecution(
      'execute',
      {
        agentId: this.agentId,
        agentName: this.name,
        lifecycleStage: this.lifecycleStage,
        version: this.version,
        sessionId
      },
      async (span) => {
        const result = await this.processInput(input);
        
        recordAgentConfidence(
          result.confidence_level,
          result.confidence_score,
          result.hallucination_check
        );
        
        return result;
      }
    );
  }
}
```

### Recording Metrics

Record custom metrics:

```typescript
import { getMetricsCollector } from './services/MetricsCollector';

const metrics = getMetricsCollector(supabase);

// Record agent invocation
metrics.recordAgentInvocation(
  'target_agent',
  true,  // success
  1500,  // response time ms
  0.85,  // confidence score
  false  // hallucination detected
);

// Record LLM call
metrics.recordLLMCall(
  'together_ai',
  'meta-llama/Llama-3-70b-chat-hf',
  800,   // latency ms
  0.05,  // cost USD
  false  // cache hit
);

// Record value prediction
metrics.recordValuePrediction(
  'roi',
  100000,  // predicted value
  95000    // actual value (optional)
);
```

### Querying Metrics

Get metrics from database:

```typescript
import { getMetricsCollector } from './services/MetricsCollector';

const metrics = getMetricsCollector(supabase);

// Get agent metrics
const agentMetrics = await metrics.getAgentMetrics('target_agent', 'day');
console.log('Success rate:', agentMetrics[0].successRate);
console.log('P95 response time:', agentMetrics[0].p95ResponseTime);

// Get prediction accuracy
const predictionMetrics = await metrics.getValuePredictionMetrics('roi', 'week');
console.log('Accuracy:', predictionMetrics[0].accuracy);

// Get system metrics
const systemMetrics = await metrics.getSystemMetrics('hour');
console.log('Cache hit rate:', systemMetrics.cacheHitRate);
console.log('Total cost:', systemMetrics.totalCost);
```

### Setting Up Alerts

Configure and start alerting:

```typescript
import { getAlertingService } from './services/AlertingService';

const alerting = getAlertingService(supabase);

// Start monitoring with default rules
alerting.start();

// Add custom alert rule
alerting.addAlertRule({
  id: 'custom-alert',
  name: 'Custom Alert',
  enabled: true,
  thresholds: [
    {
      metricName: 'agent.custom_metric',
      operator: 'gt',
      threshold: 100,
      severity: 'warning',
      description: 'Custom metric exceeded'
    }
  ],
  checkIntervalMinutes: 5,
  notificationChannels: ['sentry']
});

// Get active alerts
const activeAlerts = alerting.getActiveAlerts();
console.log('Active alerts:', activeAlerts.length);
```

## Monitoring

### Key Metrics to Monitor

#### Agent Performance
- **Success Rate:** Should be \u003e 95%
- **P95 Response Time:** Should be \u003c 3 seconds
- **P99 Response Time:** Should be \u003c 5 seconds
- **Avg Confidence Score:** Should be \u003e 0.7
- **Hallucination Rate:** Should be \u003c 10%

#### LLM Performance
- **Cache Hit Rate:** Target \u003e 60%
- **P95 Latency:** Should be \u003c 2 seconds
- **Hourly Cost:** Monitor for budget
- **Error Rate:** Should be \u003c 2%

#### Value Predictions
- **Overall Accuracy:** Target \u003e 85%
- **Error Percentage:** Should be \u003c 15%
- **Predictions with Actuals:** Track coverage

### Dashboards

Access Grafana dashboards at http://localhost:3000:

1. **Agent Performance Dashboard**
   - Success rates by agent type
   - Response time trends
   - Confidence score distribution
   - Hallucination rates

2. **LLM Performance Dashboard**
   - Latency percentiles
   - Cost over time
   - Token usage
   - Cache performance

3. **Value Prediction Accuracy Dashboard**
   - Accuracy trends
   - Predicted vs actual values
   - Error percentages
   - Accuracy by prediction type

### Alerts

Configure alerts in Grafana or use the AlertingService:

1. **High Error Rate:** Triggers when agent error rate \u003e 5%
2. **Slow Response:** Triggers when P95 \u003e 5 seconds
3. **High Cost:** Triggers when LLM cost \u003e $10/hour
4. **Low Accuracy:** Triggers when prediction accuracy \u003c 70%

## Best Practices

### 1. Trace All Critical Paths

Add tracing to:
- Agent executions
- Value tree operations
- Workflow orchestration
- SDUI generation
- Database queries
- LLM calls

### 2. Record Meaningful Metrics

Track metrics that matter:
- Business KPIs (value predictions, ROI)
- Performance metrics (latency, throughput)
- Quality metrics (confidence, accuracy)
- Cost metrics (LLM usage, tokens)

### 3. Set Appropriate Thresholds

Configure alerts based on:
- Historical baselines
- Business requirements
- SLA commitments
- Budget constraints

### 4. Monitor Trends

Look for:
- Degrading performance over time
- Increasing error rates
- Rising costs
- Declining accuracy

### 5. Correlate Metrics

Connect:
- Errors with traces
- Performance with cost
- Accuracy with confidence
- Usage with business outcomes

### 6. Regular Reviews

Schedule:
- Daily: Check dashboards for anomalies
- Weekly: Review trends and alerts
- Monthly: Analyze accuracy and cost
- Quarterly: Assess SLA compliance

## Troubleshooting

### No Traces Appearing

1. **Check initialization:**
   ```typescript
   import { isObservabilityEnabled } from './lib/observability';
   console.log('Enabled:', isObservabilityEnabled());
   ```

2. **Verify OTLP endpoint:**
   ```bash
   curl -X POST http://localhost:4318/v1/traces
   ```

3. **Check logs for errors**

### No Metrics in Database

1. **Verify tables exist:**
   ```sql
   SELECT * FROM agent_predictions LIMIT 1;
   SELECT * FROM llm_calls LIMIT 1;
   ```

2. **Check metrics are being recorded:**
   ```typescript
   metrics.recordAgentInvocation(...);
   ```

3. **Refresh materialized views:**
   ```sql
   SELECT refresh_agent_performance_metrics();
   ```

### Dashboards Show No Data

1. **Check database connection in Grafana**
2. **Verify queries return data:**
   ```sql
   SELECT * FROM agent_performance_metrics LIMIT 1;
   ```
3. **Refresh materialized views**

### High Observability Overhead

1. **Reduce trace sampling:**
   ```typescript
   tracesSampleRate: 0.1  // 10% of traces
   ```

2. **Increase metric aggregation intervals**
3. **Disable non-critical metrics**

## Performance Impact

Observability adds minimal overhead:

- **Tracing:** \u003c 1ms per span
- **Metrics:** \u003c 0.1ms per metric
- **Total:** \u003c 2% CPU overhead

For high-volume scenarios:
- Use sampling for traces
- Aggregate metrics in-memory
- Batch database writes

## Security

### Data Privacy

- **PII Filtering:** Automatic sanitization in logs
- **Sensitive Data:** Excluded from traces
- **User Context:** Anonymized in Sentry

### Access Control

- **Grafana:** Role-based access
- **Sentry:** Team-based permissions
- **Database:** RLS policies

### Compliance

- **GDPR:** PII sanitization
- **SOC 2:** Audit logging
- **HIPAA:** Data encryption

## Resources

### Documentation
- [Agent Tracing Guide](./AGENT_TRACING_GUIDE.md)
- [Sentry Setup](./SENTRY_SETUP.md)
- [Grafana Setup](../grafana/README.md)

### External Resources
- [OpenTelemetry Docs](https://opentelemetry.io/docs/)
- [Grafana Docs](https://grafana.com/docs/)
- [Sentry Docs](https://docs.sentry.io/)

### Support
- GitHub Issues
- Internal Documentation
- Team Slack Channel

## Roadmap

### Phase 2 (Current)
- ✅ OpenTelemetry integration
- ✅ Metrics collection
- ✅ Grafana dashboards
- ✅ Sentry integration
- ✅ Alerting service

### Phase 3 (Future)
- [ ] Distributed tracing across services
- [ ] Custom business metrics
- [ ] ML-based anomaly detection
- [ ] Automated remediation
- [ ] Cost optimization recommendations

### Phase 4 (Future)
- [ ] Real-time streaming metrics
- [ ] Predictive alerting
- [ ] Multi-region monitoring
- [ ] Advanced analytics
- [ ] Custom integrations
