# Engineering: Observability & Monitoring

## 1. The Observability Stack
ValueOS implements a production-grade monitoring stack based on OpenTelemetry.

- **Tracing**: Jaeger / Tempo (Distributed tracing).
- **Metrics**: Prometheus (Time-series data).
- **Logs**: Loki (Log aggregation).
- **Visualization**: Grafana (Unified dashboards).
- **Forwarding**: Fluent Bit (Log shipping).

## 2. Instrumentation
We use **OpenTelemetry** for full-stack instrumentation:
- **Traces**: Exported via OTLP gRPC (port 4317).
- **Metrics**: Exported via OTLP (port 9464).
- **Context Propagation**: `tenant_id` and `correlation_id` are propagated across all service boundaries.

## 3. Monitoring Capabilities
- **Application**: Request rates, error rates (RED pattern), cache hit ratios, and agent latency.
- **Database**: Query duration, connection pool saturation, and RLS performance.
- **System**: CPU, Memory, Disk I/O, and Pod status.
- **AI**: Token usage, confidence scores, and reasoning path visualization.

## 4. Alerting Rules
- **Critical**: Error rate > 5%, P95 latency > 1s, or Pod restarts.
- **Security**: Multiple failed login attempts or RLS policy violations.
- **Financial**: Significant variance in value realization metrics.

---
**Last Updated:** 2026-01-28
**Related:** `docs/engineering/ENGINEERING_MASTER.md`, `infra/infra/observability/`
