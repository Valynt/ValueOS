# ValueOS Observability Stack

**Goal**: Full visibility into application performance and health
**Stack**: OpenTelemetry + Prometheus + Grafana + CloudWatch
**Status**: Design Complete

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Application                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ Frontend │  │ Backend  │  │ Database │                  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                  │
│       │             │              │                         │
│       └─────────────┴──────────────┘                         │
│                     │                                        │
│              OpenTelemetry SDK                               │
│                     │                                        │
└─────────────────────┼──────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   ┌────▼────┐   ┌───▼────┐   ┌───▼────┐
   │ Metrics │   │  Logs  │   │ Traces │
   │Prometheus│  │CloudWatch│ │ Tempo  │
   └────┬────┘   └───┬────┘   └───┬────┘
        │            │            │
        └────────────┼────────────┘
                     │
              ┌──────▼──────┐
              │   Grafana   │
              │  Dashboards │
              └─────────────┘
```

---

## 1. OpenTelemetry Integration

### Backend (Node.js)

**Installation**:
```bash
npm install @opentelemetry/sdk-node \
            @opentelemetry/auto-instrumentations-node \
            @opentelemetry/exporter-prometheus \
            @opentelemetry/exporter-trace-otlp-http
```

**Configuration** (`src/observability/tracing.ts`):
```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'valueos-backend',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.APP_VERSION || '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  }),
  
  // Metrics
  metricReader: new PrometheusExporter({
    port: 9464,
    endpoint: '/metrics',
  }),
  
  // Traces
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  }),
  
  // Auto-instrumentation
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': {
        enabled: false, // Too noisy
      },
    }),
  ],
});

sdk.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((error) => console.log('Error terminating tracing', error))
    .finally(() => process.exit(0));
});

export default sdk;
```

**Usage in Express**:
```typescript
import express from 'express';
import { trace, context } from '@opentelemetry/api';

const app = express();
const tracer = trace.getTracer('valueos-backend');

app.get('/api/users', async (req, res) => {
  const span = tracer.startSpan('get-users');
  
  try {
    // Add custom attributes
    span.setAttribute('user.id', req.user?.id);
    span.setAttribute('request.path', req.path);
    
    const users = await getUsers();
    
    span.setStatus({ code: SpanStatusCode.OK });
    res.json(users);
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    span.recordException(error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    span.end();
  }
});
```

### Frontend (React)

**Installation**:
```bash
npm install @opentelemetry/api \
            @opentelemetry/sdk-trace-web \
            @opentelemetry/instrumentation-fetch \
            @opentelemetry/instrumentation-xml-http-request \
            @opentelemetry/exporter-trace-otlp-http
```

**Configuration** (`src/observability/tracing.ts`):
```typescript
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const provider = new WebTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'valueos-frontend',
    [SemanticResourceAttributes.SERVICE_VERSION]: import.meta.env.VITE_APP_VERSION || '1.0.0',
  }),
});

const exporter = new OTLPTraceExporter({
  url: import.meta.env.VITE_OTEL_EXPORTER_URL || 'http://localhost:4318/v1/traces',
});

provider.addSpanProcessor(new BatchSpanProcessor(exporter));
provider.register();

registerInstrumentations({
  instrumentations: [
    new FetchInstrumentation({
      propagateTraceHeaderCorsUrls: [
        /^https:\/\/api\.valueos\.com\/.*/,
      ],
    }),
    new XMLHttpRequestInstrumentation(),
  ],
});

export default provider;
```

---

## 2. Metrics (Prometheus)

### Prometheus Configuration

**`prometheus.yml`**:
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'valueos-production'
    environment: 'production'

scrape_configs:
  # Backend metrics
  - job_name: 'valueos-backend'
    ec2_sd_configs:
      - region: us-east-1
        port: 9464
        filters:
          - name: tag:Service
            values: ['valueos-backend']
    relabel_configs:
      - source_labels: [__meta_ec2_tag_Environment]
        target_label: environment
      - source_labels: [__meta_ec2_instance_id]
        target_label: instance

  # Node exporter (system metrics)
  - job_name: 'node-exporter'
    ec2_sd_configs:
      - region: us-east-1
        port: 9100
        filters:
          - name: tag:Monitoring
            values: ['enabled']

  # AWS CloudWatch metrics
  - job_name: 'cloudwatch'
    static_configs:
      - targets: ['cloudwatch-exporter:9106']

# Alerting rules
rule_files:
  - 'alerts.yml'

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

### Alert Rules

**`alerts.yml`**:
```yaml
groups:
  - name: application
    interval: 30s
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: |
          rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }} (threshold: 5%)"

      # High response time
      - alert: HighResponseTime
        expr: |
          histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "P95 response time is {{ $value }}s (threshold: 2s)"

      # Low availability
      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service is down"
          description: "{{ $labels.job }} has been down for more than 1 minute"

  - name: infrastructure
    interval: 30s
    rules:
      # High CPU
      - alert: HighCPU
        expr: |
          100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage"
          description: "CPU usage is {{ $value }}% (threshold: 80%)"

      # High memory
      - alert: HighMemory
        expr: |
          (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value }}% (threshold: 90%)"

      # Disk space
      - alert: LowDiskSpace
        expr: |
          (node_filesystem_avail_bytes / node_filesystem_size_bytes) * 100 < 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Low disk space"
          description: "Disk space is {{ $value }}% available (threshold: 10%)"
```

---

## 3. Dashboards (Grafana)

### Dashboard Configuration

**System Overview Dashboard**:
```json
{
  "dashboard": {
    "title": "ValueOS System Overview",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{path}}"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m])",
            "legendFormat": "Error Rate"
          }
        ]
      },
      {
        "title": "Response Time (P95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "P95"
          }
        ]
      },
      {
        "title": "Active Connections",
        "targets": [
          {
            "expr": "sum(nodejs_active_handles_total)",
            "legendFormat": "Active Handles"
          }
        ]
      }
    ]
  }
}
```

### Key Dashboards

1. **System Overview**
   - Request rate, error rate, response time
   - CPU, memory, disk usage
   - Active connections, database queries

2. **Application Performance**
   - Endpoint latency breakdown
   - Database query performance
   - Cache hit rate
   - External API calls

3. **Business Metrics**
   - Active users
   - API calls per endpoint
   - Feature usage
   - Conversion rates

4. **Infrastructure**
   - ECS task health
   - RDS performance
   - ElastiCache metrics
   - Load balancer metrics

---

## 4. Logging (CloudWatch)

### Structured Logging

**Backend** (`src/lib/logger.ts`):
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'valueos-backend',
    environment: process.env.NODE_ENV,
    version: process.env.APP_VERSION,
  },
  transports: [
    new winston.transports.Console(),
    new winston.transports.CloudWatch({
      logGroupName: '/ecs/valueos-backend',
      logStreamName: process.env.ECS_TASK_ID,
      awsRegion: 'us-east-1',
    }),
  ],
});

export default logger;
```

**Usage**:
```typescript
import logger from './lib/logger';

// Info
logger.info('User logged in', {
  userId: user.id,
  email: user.email,
  ip: req.ip,
});

// Error
logger.error('Database query failed', {
  error: error.message,
  stack: error.stack,
  query: query,
});

// With trace context
import { trace } from '@opentelemetry/api';

const span = trace.getActiveSpan();
logger.info('Processing request', {
  traceId: span?.spanContext().traceId,
  spanId: span?.spanContext().spanId,
});
```

---

## 5. Distributed Tracing (Tempo)

### Tempo Configuration

**`tempo.yaml`**:
```yaml
server:
  http_listen_port: 3200

distributor:
  receivers:
    otlp:
      protocols:
        http:
          endpoint: 0.0.0.0:4318
        grpc:
          endpoint: 0.0.0.0:4317

ingester:
  trace_idle_period: 10s
  max_block_bytes: 1_000_000
  max_block_duration: 5m

compactor:
  compaction:
    block_retention: 168h  # 7 days

storage:
  trace:
    backend: s3
    s3:
      bucket: valueos-traces
      region: us-east-1
```

### Trace Visualization

**Grafana Tempo Integration**:
```yaml
apiVersion: 1
datasources:
  - name: Tempo
    type: tempo
    access: proxy
    url: http://tempo:3200
    jsonData:
      tracesToLogs:
        datasourceUid: 'loki'
        tags: ['traceId']
      serviceMap:
        datasourceUid: 'prometheus'
```

---

## 6. Deployment

### Docker Compose (Local)

**`infra/docker/docker-compose.observability.yml`**:
```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - ./alerts.yml:/etc/prometheus/alerts.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./grafana/datasources:/etc/grafana/provisioning/datasources

  tempo:
    image: grafana/tempo:latest
    ports:
      - "3200:3200"
      - "4317:4317"
      - "4318:4318"
    volumes:
      - ./tempo.yaml:/etc/tempo.yaml
      - tempo-data:/var/tempo
    command: ["-config.file=/etc/tempo.yaml"]

  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    volumes:
      - loki-data:/loki

volumes:
  prometheus-data:
  grafana-data:
  tempo-data:
  loki-data:
```

### ECS Task Definition

**Sidecar Pattern**:
```json
{
  "family": "valueos-backend",
  "containerDefinitions": [
    {
      "name": "app",
      "image": "valueos-backend:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "OTEL_EXPORTER_OTLP_ENDPOINT",
          "value": "http://localhost:4318"
        }
      ]
    },
    {
      "name": "otel-collector",
      "image": "otel/opentelemetry-collector:latest",
      "portMappings": [
        {
          "containerPort": 4318,
          "protocol": "tcp"
        }
      ]
    }
  ]
}
```

---

## 7. Quick Start

### Local Development

```bash
# Start observability stack
docker-compose -f infra/docker/docker-compose.observability.yml up -d

# Access dashboards
open http://localhost:3001  # Grafana (admin/admin)
open http://localhost:9090  # Prometheus
```

### Production

```bash
# Deploy with Terraform
cd infra/terraform-new/modules/monitoring
terraform init
terraform apply

# Access dashboards
open https://grafana.valueos.com
```

---

## 8. Best Practices

1. **Sampling**: Use head-based sampling (10%) in production to reduce costs
2. **Cardinality**: Limit high-cardinality labels (user IDs, request IDs)
3. **Retention**: Keep traces for 7 days, metrics for 30 days
4. **Alerts**: Alert on symptoms, not causes
5. **Dashboards**: Create role-specific dashboards (dev, ops, business)

---

**Status**: Design Complete ✅
**Next**: Implementation
**Owner**: DevOps Team
