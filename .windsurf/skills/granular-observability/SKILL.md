---
name: granular-observability
description: Implements Prometheus metrics and distributed tracing with OpenTelemetry for comprehensive observability of 18 agent types
---

# Granular Observability

This skill implements the "MELT" stack (Metrics, Events, Logs, Traces) for comprehensive observability of ValueOS's 18 agent types, enabling deep insights into system behavior, performance bottlenecks, and request flows across distributed agent communication.

## When to Run

Run this skill when:
- Instrumenting agents for production monitoring
- Debugging distributed request flows
- Analyzing performance bottlenecks
- Setting up alerting and dashboards
- Troubleshooting inter-agent communication
- Optimizing agent resource utilization

## Prometheus Metrics Implementation

### Agent-Specific Metrics Instrumentation

#### Core Agent Metrics
```typescript
// packages/backend/src/lib/observability/index.ts
import * as client from "prom-client";
import registry from "../metrics/httpMetrics.js";

type Labels = Record<string, string | number>;

interface Counter {
  inc(labels?: Labels, value?: number): void;
  inc(value?: number): void;
  add(value: number, labels?: Labels): void;
}

interface Histogram {
  observe(labels: Labels, value: number): void;
  observe(value: number): void;
  record(value: number, labels?: Labels): void;
}

// Agent task metrics
export const agentTaskCounter = new client.Counter({
  name: 'valueos_agent_tasks_total',
  help: 'Total number of tasks processed by agent',
  labelNames: ['agent_type', 'task_type', 'status'],
  registers: [registry],
});

export const agentTaskDuration = new client.Histogram({
  name: 'valueos_agent_task_duration_seconds',
  help: 'Duration of agent task processing',
  labelNames: ['agent_type', 'task_type'],
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [registry],
});

export const agentQueueDepth = new client.Gauge({
  name: 'valueos_agent_queue_depth',
  help: 'Current depth of agent processing queue',
  labelNames: ['agent_type'],
  registers: [registry],
});

export const agentHealthStatus = new client.Gauge({
  name: 'valueos_agent_health_status',
  help: 'Health status of agent (1=healthy, 0=unhealthy)',
  labelNames: ['agent_type', 'agent_instance'],
  registers: [registry],
});
```

#### ML Agent Specific Metrics
```typescript
// Sentiment analysis agent metrics
export const sentimentAnalysisDuration = new client.Histogram({
  name: 'valueos_sentiment_analysis_duration_seconds',
  help: 'Time spent on sentiment analysis inference',
  labelNames: ['model_version', 'input_length'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [registry],
});

export const sentimentModelAccuracy = new client.Gauge({
  name: 'valueos_sentiment_model_accuracy',
  help: 'Current accuracy of sentiment model',
  labelNames: ['model_version'],
  registers: [registry],
});

export const sentimentBatchSize = new client.Histogram({
  name: 'valueos_sentiment_batch_size',
  help: 'Batch size distribution for sentiment processing',
  labelNames: ['agent_instance'],
  buckets: [1, 5, 10, 25, 50, 100],
  registers: [registry],
});
```

#### Orchestration Agent Metrics
```typescript
// Agent orchestration metrics
export const orchestrationWorkflowDuration = new client.Histogram({
  name: 'valueos_orchestration_workflow_duration_seconds',
  help: 'Total time for complete workflow orchestration',
  labelNames: ['workflow_type', 'agents_involved'],
  buckets: [1, 5, 10, 30, 60, 120, 300, 600],
  registers: [registry],
});

export const orchestrationAgentCalls = new client.Counter({
  name: 'valueos_orchestration_agent_calls_total',
  help: 'Number of calls made to individual agents',
  labelNames: ['target_agent', 'call_type', 'status'],
  registers: [registry],
});

export const orchestrationDecisionLatency = new client.Histogram({
  name: 'valueos_orchestration_decision_latency_seconds',
  help: 'Time taken to make orchestration decisions',
  labelNames: ['decision_type'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
  registers: [registry],
});
```

### Metrics Collection Setup

#### Prometheus Configuration
```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'valueos-agents'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        regex: valueos-agent
        action: keep
      - source_labels: [__meta_kubernetes_pod_label_agent_type]
        target_label: agent_type
      - source_labels: [__meta_kubernetes_pod_name]
        target_label: pod_name
      - target_label: __address__
        replacement: $1:9090
    metric_relabel_configs:
      - source_labels: [__name__]
        regex: 'valueos_.*'
        action: keep
```

#### ServiceMonitor for Kubernetes
```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: valueos-agents-monitor
  namespace: valueos-agents
  labels:
    team: backend
spec:
  selector:
    matchLabels:
      app: valueos-agent
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
  namespaceSelector:
    matchNames:
    - valueos-agents
```

### Custom Metrics for Agent Intelligence

#### Dynamic Metrics Based on Agent Behavior
```typescript
export class AgentMetricsCollector {
  private customMetrics: Map<string, client.Metric<string>> = new Map();

  createDynamicMetric(agentType: string, metricName: string, type: 'counter' | 'gauge' | 'histogram') {
    const fullName = `valueos_${agentType}_${metricName}`;

    if (this.customMetrics.has(fullName)) {
      return this.customMetrics.get(fullName);
    }

    let metric: client.Metric<string>;

    switch (type) {
      case 'counter':
        metric = new client.Counter({
          name: fullName,
          help: `Dynamic counter for ${agentType}: ${metricName}`,
          registers: [registry],
        });
        break;
      case 'gauge':
        metric = new client.Gauge({
          name: fullName,
          help: `Dynamic gauge for ${agentType}: ${metricName}`,
          registers: [registry],
        });
        break;
      case 'histogram':
        metric = new client.Histogram({
          name: fullName,
          help: `Dynamic histogram for ${agentType}: ${metricName}`,
          registers: [registry],
        });
        break;
    }

    this.customMetrics.set(fullName, metric);
    return metric;
  }

  recordAgentInsight(agentType: string, insight: string, value: number) {
    const metric = this.createDynamicMetric(agentType, insight.replace(/[^a-zA-Z0-9_]/g, '_'), 'gauge');
    if (metric instanceof client.Gauge) {
      metric.set(value);
    }
  }
}
```

## Distributed Tracing with OpenTelemetry

### OpenTelemetry Setup for Agents

#### Agent Tracing Instrumentation
```typescript
// packages/backend/src/lib/tracing/index.ts
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';

export function setupTracing(serviceName: string, serviceVersion: string) {
  const provider = new NodeTracerProvider({
    resource: {
      service: {
        name: serviceName,
        version: serviceVersion,
      },
    },
  });

  const exporter = new JaegerExporter({
    endpoint: process.env.JAEGER_ENDPOINT || 'http://jaeger-collector:14268/api/traces',
  });

  provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
  provider.register();

  registerInstrumentations({
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
    ],
  });

  return provider;
}
```

#### Agent-Specific Tracing
```typescript
import { trace, Span, SpanStatusCode } from '@opentelemetry/api';

export class AgentTracer {
  private tracer = trace.getTracer('valueos-agent', '1.0.0');

  async traceAgentExecution<T>(
    agentType: string,
    operation: string,
    context: Record<string, any>,
    fn: () => Promise<T>
  ): Promise<T> {
    const span = this.tracer.startSpan(`${agentType}.${operation}`, {
      attributes: {
        'agent.type': agentType,
        'operation.name': operation,
        ...context,
      },
    });

    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      span.setAttributes({
        'result.success': true,
      });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.setAttributes({
        'result.success': false,
        'error.type': error.constructor.name,
      });
      throw error;
    } finally {
      span.end();
    }
  }

  createAgentSpan(agentType: string, operation: string, parentSpan?: Span) {
    const span = this.tracer.startSpan(
      `${agentType}.${operation}`,
      parentSpan ? { childOf: parentSpan } : undefined
    );

    span.setAttributes({
      'agent.type': agentType,
      'operation.name': operation,
    });

    return span;
  }
}
```

### Inter-Agent Request Tracing

#### Distributed Context Propagation
```typescript
import { propagation, trace, TextMapPropagator } from '@opentelemetry/api';

export class AgentCommunicationTracer {
  private propagator: TextMapPropagator = propagation.getGlobalPropagator();

  async traceAgentCall<T>(
    sourceAgent: string,
    targetAgent: string,
    operation: string,
    headers: Record<string, string>,
    fn: () => Promise<T>
  ): Promise<T> {
    const span = trace.getTracer('valueos-agent-communication')
      .startSpan(`${sourceAgent}->${targetAgent}.${operation}`);

    span.setAttributes({
      'communication.source_agent': sourceAgent,
      'communication.target_agent': targetAgent,
      'communication.operation': operation,
    });

    // Inject tracing context into headers
    this.propagator.inject(trace.setSpanContext(span.spanContext()), headers, {
      set: (carrier, key, value) => {
        carrier[key] = value;
      },
    });

    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      throw error;
    } finally {
      span.end();
    }
  }

  extractContextFromHeaders(headers: Record<string, string>) {
    const carrier = {};
    Object.keys(headers).forEach(key => {
      if (key.toLowerCase().startsWith('x-') || key.toLowerCase().startsWith('trace')) {
        carrier[key] = headers[key];
      }
    });

    const context = this.propagator.extract(trace.getTracerProvider().getTracer('valueos'), carrier, {
      get: (carrier, key) => carrier[key],
      keys: (carrier) => Object.keys(carrier),
    });

    return context;
  }
}
```

### Workflow Tracing for Orchestration

#### Complete Request Flow Tracing
```typescript
export class WorkflowTracer {
  private tracer = trace.getTracer('valueos-workflow', '1.0.0');

  async traceWorkflow<T>(
    workflowId: string,
    workflowType: string,
    agents: string[],
    fn: () => Promise<T>
  ): Promise<T> {
    const span = this.tracer.startSpan(`workflow.${workflowType}`, {
      attributes: {
        'workflow.id': workflowId,
        'workflow.type': workflowType,
        'workflow.agents': agents.join(','),
        'workflow.agent_count': agents.length,
      },
    });

    // Create child spans for each agent step
    const agentSpans: Span[] = [];
    agents.forEach((agent, index) => {
      const agentSpan = this.tracer.startSpan(
        `workflow.${workflowType}.agent.${agent}`,
        { childOf: span },
        span.spanContext()
      );
      agentSpan.setAttributes({
        'workflow.step': index + 1,
        'workflow.agent': agent,
      });
      agentSpans.push(agentSpan);
    });

    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      span.setAttributes({
        'workflow.success': true,
        'workflow.duration_ms': span.endTime - span.startTime,
      });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.setAttributes({
        'workflow.success': false,
        'workflow.error': error.message,
      });
      throw error;
    } finally {
      // End all agent spans
      agentSpans.forEach(span => span.end());
      span.end();
    }
  }
}
```

## Monitoring Dashboard Setup

### Grafana Dashboards

#### Agent Overview Dashboard
```json
{
  "dashboard": {
    "title": "ValueOS Agent Overview",
    "panels": [
      {
        "title": "Agent Health Status",
        "type": "stat",
        "targets": [
          {
            "expr": "up{job=\"valueos-agents\"}",
            "legendFormat": "{{agent_type}}"
          }
        ]
      },
      {
        "title": "Agent Task Throughput",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(valueos_agent_tasks_total[5m])",
            "legendFormat": "{{agent_type}} - {{task_type}}"
          }
        ]
      },
      {
        "title": "Agent Queue Depth",
        "type": "graph",
        "targets": [
          {
            "expr": "valueos_agent_queue_depth",
            "legendFormat": "{{agent_type}}"
          }
        ]
      }
    ]
  }
}
```

#### ML Agent Performance Dashboard
```json
{
  "dashboard": {
    "title": "ML Agent Performance",
    "panels": [
      {
        "title": "Sentiment Analysis Latency",
        "type": "heatmap",
        "targets": [
          {
            "expr": "rate(valueos_sentiment_analysis_duration_seconds_bucket[5m])",
            "legendFormat": "{{le}}"
          }
        ]
      },
      {
        "title": "Model Accuracy Trend",
        "type": "graph",
        "targets": [
          {
            "expr": "valueos_sentiment_model_accuracy",
            "legendFormat": "{{model_version}}"
          }
        ]
      },
      {
        "title": "Batch Processing Efficiency",
        "type": "histogram",
        "targets": [
          {
            "expr": "valueos_sentiment_batch_size_bucket",
            "legendFormat": "{{le}}"
          }
        ]
      }
    ]
  }
}
```

### Alert Configuration

#### Prometheus Alert Rules
```yaml
groups:
  - name: agent-alerts
    rules:
      - alert: AgentDown
        expr: up{job="valueos-agents"} == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Agent {{ $labels.agent_type }} is down"
          description: "Agent {{ $labels.agent_type }} has been down for more than 5 minutes."

      - alert: HighAgentQueueDepth
        expr: valueos_agent_queue_depth > 1000
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High queue depth for {{ $labels.agent_type }}"
          description: "Queue depth is {{ $value }} for agent {{ $labels.agent_type }}."

      - alert: SlowAgentTasks
        expr: histogram_quantile(0.95, rate(valueos_agent_task_duration_seconds_bucket[5m])) > 30
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow task processing for {{ $labels.agent_type }}"
          description: "95th percentile task duration is {{ $value }}s for agent {{ $labels.agent_type }}."

      - alert: AgentCommunicationFailure
        expr: rate(valueos_orchestration_agent_calls_total{status="error"}[5m]) > 0.1
        for: 2m
        labels:
          severity: error
        annotations:
          summary: "High agent communication failure rate"
          description: "Agent communication failure rate is {{ $value }} for {{ $labels.target_agent }}."
```

## Log Aggregation and Correlation

### Structured Logging Setup
```typescript
import winston from 'winston';
import { trace } from '@opentelemetry/api';

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format((info) => {
      // Add tracing context to logs
      const span = trace.getActiveSpan();
      if (span) {
        info.traceId = span.spanContext().traceId;
        info.spanId = span.spanContext().spanId;
      }
      return info;
    })()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'agent.log' }),
  ],
});
```

### Log Correlation with Traces
```typescript
export class CorrelatedLogger {
  log(level: string, message: string, meta: Record<string, any> = {}) {
    const span = trace.getActiveSpan();
    if (span) {
      meta.traceId = span.spanContext().traceId;
      meta.spanId = span.spanContext().spanId;
    }

    // Add agent context
    meta.agentType = process.env.AGENT_TYPE;
    meta.agentInstance = process.env.POD_NAME;

    logger.log(level, message, meta);
  }

  info(message: string, meta?: Record<string, any>) {
    this.log('info', message, meta);
  }

  error(message: string, error?: Error, meta?: Record<string, any>) {
    const errorMeta = {
      ...meta,
      error: error?.message,
      stack: error?.stack,
    };
    this.log('error', message, errorMeta);
  }
}
```

## Performance Analysis and Optimization

### Tracing Query Examples

#### Finding Slow Request Paths
```sql
-- Find traces with high latency
SELECT
  trace_id,
  span_name,
  duration_ms,
  agent_type
FROM traces
WHERE duration_ms > 5000
  AND timestamp > now() - interval '1 hour'
ORDER BY duration_ms DESC
LIMIT 10;
```

#### Agent Communication Analysis
```sql
-- Analyze inter-agent communication patterns
SELECT
  source_agent,
  target_agent,
  count(*) as call_count,
  avg(duration_ms) as avg_duration,
  max(duration_ms) as max_duration
FROM agent_communication_traces
WHERE timestamp > now() - interval '24 hours'
GROUP BY source_agent, target_agent
ORDER BY call_count DESC;
```

#### Error Correlation Analysis
```sql
-- Correlate errors with traces
SELECT
  t.trace_id,
  t.span_name,
  e.error_message,
  e.error_type,
  t.duration_ms
FROM traces t
JOIN errors e ON t.trace_id = e.trace_id
WHERE t.timestamp > now() - interval '1 hour'
  AND e.severity = 'ERROR'
ORDER BY t.duration_ms DESC;
```

This comprehensive observability implementation provides deep insights into the behavior and performance of all 18 ValueOS agent types, enabling proactive monitoring, rapid debugging, and continuous optimization of the distributed agent system.
