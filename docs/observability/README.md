# LGTM Observability Stack - Complete Overview

This directory contains a production-ready observability stack based on the LGTM (Loki, Grafana, Tempo, Mimir/Prometheus) architecture, specifically designed for the ValueOS application.

## 📁 Directory Structure

```
ValueOS/
├── docker-compose.observability.yml    # Docker compose file for LGTM stack
├── Makefile.observability              # Convenience commands
├── observability/                      # Service configurations
│   ├── grafana/
│   │   └── datasources.yml             # Auto-provisioned datasources
│   ├── loki/
│   │   └── loki-config.yaml            # Log aggregation config
│   ├── prometheus/
│   │   └── prometheus.yml              # Metrics collection config
│   └── tempo/
│       └── tempo-config.yaml           # Distributed tracing config
├── src/observability/                  # Application instrumentation
│   ├── instrumentation.ts              # OpenTelemetry setup
│   └── example-app.ts                  # Example Express integration
├── tests/observability/                # Comprehensive test suite
│   ├── unit/
│   │   └── instrumentation.test.ts     # Unit tests
│   ├── integration/
│   │   ├── loki.test.ts                # Loki integration tests
│   │   ├── tempo.test.ts               # Tempo integration tests
│   │   └── prometheus.test.ts          # Prometheus integration tests
│   ├── e2e/
│   │   └── observability-pipeline.test.ts  # End-to-end tests
│   ├── helpers/
│   │   ├── docker-compose.helper.ts    # Stack lifecycle management
│   │   ├── loki-client.ts              # Loki test utilities
│   │   ├── tempo-client.ts             # Tempo test utilities
│   │   └── prometheus-client.ts        # Prometheus test utilities
│   └── setup.ts                        # Global test setup
├── docs/observability/                 # Documentation
│   ├── SETUP.md                        # Setup & verification guide
│   ├── TROUBLESHOOTING.md              # Common issues & solutions
│   └── DEPENDENCIES.md                 # Required npm packages
└── .github/workflows/
    └── observability-tests.yml         # CI/CD integration
```

## 🎯 What's Included

### Infrastructure (Docker)

- **Grafana 10.2.0**: Visualization and dashboards
- **Loki 2.9.0**: Log aggregation with filesystem storage
- **Tempo 2.3.0**: Distributed tracing with OTLP support
- **Prometheus v2.47.0**: Metrics collection and storage

All services are configured for local development with:

- Health checks
- Persistent volumes
- Optimized resource limits
- Cross-service networking

### Application Instrumentation

- **OpenTelemetry SDK**: Industry-standard instrumentation
- **Auto-instrumentation**: Automatic HTTP, Express instrumentation
- **Manual instrumentation**: Custom spans, metrics, logs
- **Trace context propagation**: Automatic correlation
- **Winston logging**: Structured logs with trace IDs
- **Prometheus metrics**: HTTP metrics + custom metrics

### Test Coverage

- **Unit Tests**: Instrumentation initialization, configuration
- **Integration Tests**: Individual service testing (Loki, Tempo, Prometheus)
- **E2E Tests**: Full pipeline testing, trace-log-metric correlation
- **Test Helpers**: Reusable utilities for testing each service
- **CI/CD Integration**: Automated testing in GitHub Actions

### Documentation

- **Setup Guide**: Step-by-step installation and verification
- **Troubleshooting**: Solutions for common issues
- **Dependencies**: Required npm packages
- **This README**: Overview and quick reference

## 🚀 Quick Start

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Start the stack:**

   ```bash
   make -f Makefile.observability obs-up
   ```

3. **Verify services:**

   ```bash
   make -f Makefile.observability verify
   ```

4. **Run tests:**

   ```bash
   make -f Makefile.observability test-all
   ```

5. **Access Grafana:**
   Open http://localhost:3000

## 📊 Service Ports

| Service         | Port | Purpose                 |
| --------------- | ---- | ----------------------- |
| Grafana         | 3000 | UI & API                |
| Loki            | 3100 | Log ingestion & queries |
| Tempo           | 3200 | Trace queries           |
| Tempo OTLP gRPC | 4317 | Trace ingestion (gRPC)  |
| Tempo OTLP HTTP | 4318 | Trace ingestion (HTTP)  |
| Prometheus      | 9090 | Metrics queries         |

## 🧪 Testing

### Run All Tests

```bash
make -f Makefile.observability test-ci
```

This will:

1. Start the observability stack
2. Run unit tests
3. Run integration tests
4. Run E2E tests
5. Stop the stack

### Individual Test Suites

```bash
# Unit tests (no stack required)
npm run test:observability:unit

# Integration tests (stack required)
npm run test:observability:integration

# E2E tests (stack required)
npm run test:observability:e2e
```

## 📖 Documentation

- **[Setup Guide](./docs/observability/SETUP.md)**: Complete setup instructions
- **[Troubleshooting](./docs/observability/TROUBLESHOOTING.md)**: Common issues and solutions
- **[Dependencies](./docs/observability/DEPENDENCIES.md)**: Required packages

## 🛠️ Common Commands

```bash
# Start stack
make -f Makefile.observability obs-up

# Stop stack
make -f Makefile.observability obs-down

# View logs
make -f Makefile.observability obs-logs

# Restart stack
make -f Makefile.observability obs-restart

# Run all tests
make -f Makefile.observability test-all

# Clean up (remove volumes)
make -f Makefile.observability clean
```

## 🎓 Key Features

### Three Pillars of Observability

1. **Logs (Loki)**
   - Structured JSON logging
   - Label-based indexing
   - Trace ID correlation

2. **Traces (Tempo)**
   - Distributed tracing
   - OTLP protocol support
   - Automatic span correlation

3. **Metrics (Prometheus)**
   - Time-series metrics
   - Custom and auto-generated metrics
   - PromQL queries

### Correlation

The stack automatically correlates:

- Traces → Logs (via trace_id)
- Traces → Metrics (via exemplars)
- Logs → Traces (via derived fields)

## 🔧 Integration with Your App

### Basic Setup

```typescript
import { initializeTelemetry } from "./observability/instrumentation";

// At startup
await initializeTelemetry();
```

### Create Spans

```typescript
import { withSpan } from "./observability/instrumentation";

await withSpan("myOperation", async (span) => {
  span.setAttribute("user.id", userId);
  // Your code here
});
```

### Log with Context

```typescript
import { logger } from "./observability/instrumentation";

logger.info("User action", { userId, action: "login" });
// Automatically includes trace_id if in active span
```

### Record Metrics

```typescript
import { Metrics } from "./observability/instrumentation";

Metrics.httpRequestsTotal.add(1, { method: "GET", status: "200" });
```

## 📈 CI/CD

GitHub Actions workflow (`.github/workflows/observability-tests.yml`) automatically:

- Starts the observability stack
- Runs all tests on every push/PR
- Uploads test results
- Cleans up resources

## 🎯 Success Criteria

Your setup is complete when:

✅ All services show healthy status  
✅ All tests pass (unit, integration, E2E)  
✅ Grafana shows all three datasources  
✅ You can view traces in Tempo  
✅ You can query logs in Loki  
✅ You can see metrics in Prometheus

## 🆘 Need Help?

1. Check the [Troubleshooting Guide](./docs/observability/TROUBLESHOOTING.md)
2. Review service logs: `make -f Makefile.observability obs-logs`
3. Verify service health: `make -f Makefile.observability verify`

## 📚 Additional Resources

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Grafana LGTM Stack](https://grafana.com/blog/2021/04/13/how-were-building-a-production-ready-hosted-lgtm-stack/)
- [Loki Documentation](https://grafana.com/docs/loki/latest/)
- [Tempo Documentation](https://grafana.com/docs/tempo/latest/)
- [Prometheus Documentation](https://prometheus.io/docs/)

---

**Note**: This setup is optimized for local development. For production deployment, consider:

- Authentication and authorization
- Data retention policies
- Resource limits and scaling
- Secure network configuration
- Backup and disaster recovery
