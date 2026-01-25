# LGTM Observability Stack - Setup & Verification Guide

## 🎯 Overview

This guide will help you set up and verify the complete LGTM (Loki, Grafana, Tempo, Mimir/Prometheus) observability stack for ValueOS.

## 📋 Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ installed
- At least 4GB available RAM
- Ports 3000, 3100, 3200, 4317, 4318, 9090 available

## 🚀 Quick Start

For the canonical infra entry points (including observability compose), see [`infra/README.md`](../../infra/README.md).

### 1. Install Dependencies

```bash
# Install all OpenTelemetry and observability dependencies
pnpm add @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/exporter-prometheus \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions \
  @opentelemetry/sdk-trace-node \
  @opentelemetry/sdk-trace-base \
  @opentelemetry/sdk-metrics \
  @opentelemetry/api \
  winston

# Development dependencies for testing
pnpm add -D vitest @vitest/ui axios
```

### 2. Start the Observability Stack

```bash
# Using Makefile (recommended)
make -f Makefile.observability obs-up

# Or using Docker Compose directly
docker compose -f infra/docker/docker-compose.observability.yml up -d
```

### 3. Verify Services

```bash
# Check all services are healthy
make -f Makefile.observability verify

# Manual verification
curl http://localhost:3100/ready  # Loki
curl http://localhost:3200/ready  # Tempo
curl http://localhost:9090/-/ready  # Prometheus
curl http://localhost:3000/api/health  # Grafana
```

### 4. Access Grafana

Open http://localhost:3000 in your browser. No login required for local development.

## 📊 Service Endpoints

| Service             | Port | Purpose                    | Health Check                     |
| ------------------- | ---- | -------------------------- | -------------------------------- |
| **Grafana**         | 3000 | Visualization & Dashboards | http://localhost:3000/api/health |
| **Loki**            | 3100 | Log Aggregation            | http://localhost:3100/ready      |
| **Tempo**           | 3200 | Distributed Tracing (API)  | http://localhost:3200/ready      |
| **Tempo OTLP gRPC** | 4317 | Trace Ingestion (gRPC)     | -                                |
| **Tempo OTLP HTTP** | 4318 | Trace Ingestion (HTTP)     | -                                |
| **Prometheus**      | 9090 | Metrics Collection         | http://localhost:9090/-/ready    |

## 🔧 Application Integration

### Initialize Telemetry

Add to your application entry point (e.g., `src/index.ts`):

```typescript
import { initializeTelemetry } from "./observability/instrumentation";

// Initialize at startup
await initializeTelemetry();
```

### Use in Express App

```typescript
import {
  getTracer,
  withSpan,
  Metrics,
  logger,
} from "./observability/instrumentation";

// Middleware example
app.use((req, res, next) => {
  const tracer = getTracer();
  const span = tracer.startSpan(`HTTP ${req.method} ${req.path}`);

  span.setAttribute("http.method", req.method);
  span.setAttribute("http.url", req.url);

  res.on("finish", () => {
    span.setAttribute("http.status_code", res.statusCode);
    span.end();
  });

  next();
});

// Route with observability
app.get("/api/example", async (req, res) => {
  await withSpan("exampleOperation", async (span) => {
    // Add custom attributes
    span.setAttribute("user.id", req.user?.id || "anonymous");

    // Log with trace context
    logger.info("Processing request", { path: req.path });

    // Record metrics
    Metrics.httpRequestsTotal.add(1, { method: "GET" });

    // Your business logic
    const result = await processRequest();

    res.json(result);
  });
});
```

## 🧪 Running Tests

### All Tests

```bash
make -f Makefile.observability test-all
```

### Individual Test Suites

```bash
# Unit tests (no services required)
make -f Makefile.observability test-unit

# Integration tests (requires running stack)
make -f Makefile.observability test-integration

# End-to-end tests (requires running stack)
make -f Makefile.observability test-e2e
```

### CI Test Sequence

```bash
# Full CI flow: start stack → test → cleanup
make -f Makefile.observability test-ci
```

## 📝 Add to package.json

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "test:observability:unit": "vitest run tests/observability/unit",
    "test:observability:integration": "vitest run tests/observability/integration",
    "test:observability:e2e": "vitest run tests/observability/e2e",
    "test:observability:all": "vitest run tests/observability"
  }
}
```

## 🔍 Exploring Data in Grafana

### 1. View Traces in Tempo

1. Open Grafana (http://localhost:3000)
2. Go to **Explore** (compass icon)
3. Select **Tempo** datasource
4. Click **Search** tab
5. Add filters (e.g., `service.name = "valueos"`)
6. Click **Run Query**

### 2. View Logs in Loki

1. In Explore, select **Loki** datasource
2. Use LogQL queries:
   - All logs: `{job="valueos"}`
   - Error logs: `{job="valueos", level="error"}`
   - With trace ID: `{job="valueos"} |= "trace_id"`
3. Click **Run Query**

### 3. View Metrics in Prometheus

1. In Explore, select **Prometheus** datasource
2. Use PromQL queries:
   - HTTP requests: `http_requests_total`
   - Request rate: `rate(http_requests_total[5m])`
   - Request duration: `http_request_duration_seconds`
3. Click **Run Query**

### 4. Correlate Traces and Logs

1. Find a trace in Tempo
2. Click on a span
3. Click **Logs for this span** (if available)
4. Grafana will automatically query Loki with the trace ID

## 🛠️ Common Operations

### View Logs

```bash
# All services
make -f Makefile.observability obs-logs

# Specific service
make -f Makefile.observability obs-logs-loki
make -f Makefile.observability obs-logs-tempo
make -f Makefile.observability obs-logs-prometheus
make -f Makefile.observability obs-logs-grafana
```

### Restart Stack

```bash
make -f Makefile.observability obs-restart
```

### Stop Stack

```bash
make -f Makefile.observability obs-down
```

### Clean Up (Remove Volumes)

```bash
make -f Makefile.observability clean
```

## 🎓 Learning Resources

### Understanding Your Data

- **Traces** show request flow across services
- **Logs** provide detailed event information
- **Metrics** offer aggregated performance data

### Key Concepts

- **Trace ID**: Unique identifier linking all spans in a request
- **Span**: Represents a single operation
- **Labels/Tags**: Metadata for filtering and grouping
- **Cardinality**: Number of unique label combinations (keep low!)

### Best Practices

1. **Spans**: Create spans for meaningful operations (DB queries, API calls)
2. **Logs**: Include structured data and trace context
3. **Metrics**: Use appropriate metric types (counter, histogram, gauge)
4. **Labels**: Use low-cardinality labels (avoid user IDs, request IDs)
5. **Sampling**: Consider sampling in production for high-volume services

## 📈 Next Steps

1. ✅ Verify all services are running
2. ✅ Run tests to confirm integration
3. 🔄 Instrument your application code
4. 🔄 Create custom dashboards in Grafana
5. 🔄 Set up alerts for critical metrics
6. 🔄 Configure log retention policies
7. 🔄 Plan for production deployment

## 🆘 Need Help?

- Check the [Troubleshooting Guide](./TROUBLESHOOTING.md)
- Review service logs: `make obs-logs`
- Verify port availability: `lsof -i :3000,3100,3200,9090`
- Check Docker resources: `docker stats`

## 🎉 Success Criteria

You're all set when:

- ✅ All four services show healthy status
- ✅ Grafana loads and shows all three datasources
- ✅ All tests pass (unit, integration, E2E)
- ✅ You can send a trace and find it in Tempo
- ✅ You can push a log and query it in Loki
- ✅ You can see metrics in Prometheus
