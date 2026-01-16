# Monitoring & Observability

## Overview

ValueOS implements comprehensive monitoring and observability to ensure system reliability, performance, and security.

## Monitoring Stack

### Metrics Collection

- **Prometheus** for metrics collection and storage
- **Grafana** for visualization and dashboards
- **Node Exporter** for system metrics
- **Application metrics** with custom instrumentation

### Logging

- **Structured logging** with JSON format
- **Log aggregation** using centralized logging service
- **Log levels**: DEBUG, INFO, WARN, ERROR, FATAL
- **Correlation IDs** for request tracing

### Tracing

- **Jaeger** for distributed tracing
- **OpenTelemetry** instrumentation
- **Request tracing** across services
- **Performance profiling** for bottlenecks

## Key Metrics

### Application Metrics

```prometheus
# Application Metrics
- agent_execution_duration{quantile="0.95"} < 300000
- agent_execution_success_rate > 0.95
- http_request_duration_seconds{quantile="0.95"} < 5.0
- database_connection_pool_utilization < 0.8
```

- **Request rate** and response times
- **Error rates** by service and endpoint
- **Database connection pool utilization**
- **Cache hit/miss ratios**
- **Queue depths** and processing times

### Infrastructure Metrics

```prometheus
# Infrastructure Metrics
- container_cpu_usage_seconds_total
- container_memory_usage_bytes / container_spec_memory_limit_bytes < 0.8
- redis_memory_usage_bytes / redis_memory_max_bytes < 0.8
- postgresql_active_connections < 50
```

- **CPU, memory, disk, network** utilization
- **Container health** and restart counts
- **Kubernetes cluster** health
- **Network latency** and packet loss

### Business Metrics

- **User activity** and engagement
- **Feature adoption** rates
- **Transaction volumes** and values
- **Conversion funnels**

### Alert Rules

```yaml
# alert_rules.yml
groups:
  - name: valueos.alerts
    rules:
      - alert: HighAgentExecutionTime
        expr: agent_execution_duration{quantile="0.95"} > 300000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High agent execution time detected"

      - alert: LowAgentSuccessRate
        expr: agent_execution_success_rate < 0.95
        for: 10m
        labels:
          severity: critical
        annotations:
          summary: "Low agent success rate detected"

      - alert: DatabaseConnectionPoolExhausted
        expr: database_connection_pool_utilization > 0.9
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Database connection pool exhausted"
```

## Alerting

### Alert Rules

- **High error rate** (> 5% for 5 minutes)
- **High latency** (P99 > 3s for 5 minutes)
- **Service down** (no health checks for 2 minutes)
- **Resource exhaustion** (> 90% CPU/memory)
- **Database connection** issues

### Alert Channels

- **Slack** for team notifications
- **PagerDuty** for on-call escalation
- **Email** for non-critical alerts
- **Webhooks** for automated responses

### Alert Tiers

- **Critical**: Immediate response required (< 15 min)
- **Warning**: Investigation needed (< 1 hour)
- **Info**: Awareness only (next business day)

## Dashboards

### System Overview

- **Service health** status
- **Resource utilization**
- **Request volumes** and rates
- **Error trends**

### Performance

- **Response time** distributions
- **Throughput** metrics
- **Database performance**
- **Cache efficiency**

### Business Intelligence

- **User activity** dashboards
- **Feature usage** analytics
- **Revenue tracking**
- **Conversion metrics**

### LLM Monitoring Dashboard

Key dashboard panels:

- **Cost:** hourly, daily, monthly, by model, by user
- **Performance:** latency percentiles (P50/P95/P99), success rate, requests/minute
- **Usage analytics:** by endpoint, provider, tokens, rate limit violations
- **Backups:** backup success rate, last successful backup age

### Success / Delivery Dashboard

High-level project health metrics:

- EPIC and task completion (target 100%)
- Code quality (coverage, lint, duplication, complexity)
- Security posture (vuln counts, scores)
- Performance SLOs (agent response P95, SDUI render P95, cache hit rate)
- Documentation coverage and readiness gates (tests, staging, rollback, monitoring)

### Security Dashboard

Security posture overview:

- Vulnerability counts (critical/high/medium/low) and trend
- Top vulnerable packages and remediation commands
- Security tools status (Dependabot, CodeQL, Trivy, audits)
- Security metrics (security score, scan recency, last update)
- Compliance status vs standards (GDPR, SOC 2, NIST, etc.)
- Security schedule (daily/weekly/monthly/quarterly checks)
- Contacts and escalation paths

## Monitoring Queries

### Session Health Metrics

#### Active Sessions Count

```sql
SELECT COUNT(*) as active_sessions
FROM agent_sessions
WHERE status = 'active'
  AND updated_at > NOW() - INTERVAL '1 hour';
```

#### Session Status Distribution

```sql
SELECT
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM agent_sessions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY count DESC;
```

### Error Tracking

#### Error Rate by Type

```sql
SELECT
  error_type,
  COUNT(*) as error_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM agent_execution_errors
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY error_type
ORDER BY error_count DESC;
```

### Performance Metrics

#### Agent Execution Duration Percentiles

```sql
SELECT
  agent_type,
  COUNT(*) as executions,
  ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms), 2) as p50_duration_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms), 2) as p95_duration_ms,
  ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms), 2) as p99_duration_ms
FROM agent_executions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY agent_type
ORDER BY executions DESC;
```

### LLM Cost Monitoring

#### Current Hourly Cost

```sql
SELECT get_hourly_llm_cost() as hourly_cost;
```

**Alert if**: > $10/hour

#### Current Daily Cost

```sql
SELECT get_daily_llm_cost() as daily_cost;
```

**Alert if**: > $100/day

#### Cost Trend (Last 7 Days)

```sql
SELECT
    DATE_TRUNC('day', created_at) as date,
    SUM(estimated_cost) as daily_cost,
    COUNT(*) as request_count,
    AVG(estimated_cost) as avg_cost_per_request
FROM llm_usage
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;
```

## Log Management

### Log Structure

```json
{
  "timestamp": "2026-01-14T12:00:00Z",
  "level": "INFO",
  "service": "api",
  "message": "Request completed",
  "request_id": "req_123",
  "duration_ms": 150,
  "status_code": 200,
  "user_id": "user_456"
}
```

### Log Retention

- **Application logs**: 30 days
- **Audit logs**: 1 year
- **Security logs**: 1 year
- **Infrastructure logs**: 14 days

### Log Analysis

- **Error patterns** detection
- **Performance bottlenecks** identification
- **Security events** monitoring
- **User behavior** analysis

## Distributed Tracing

### Trace Structure

- **Service boundaries** clearly identified
- **Database queries** traced
- **External API calls** tracked
- **Async operations** monitored

### Trace Sampling

- **Production**: 1% sampling rate
- **Staging**: 10% sampling rate
- **Development**: 100% sampling rate
- **Error traces**: Always captured

## Health Checks

### Application Health

```bash
# Health endpoint
GET /health

# Response
{
  "status": "healthy",
  "version": "1.0.0",
  "checks": {
    "database": "healthy",
    "redis": "healthy",
    "external_api": "healthy"
  }
}
```

### Infrastructure Health

- **Kubernetes health** probes
- **Container readiness** checks
- **Load balancer** health checks
- **Database connectivity** tests

## Performance Monitoring

### Response Time Monitoring

- **P50, P95, P99** percentiles
- **Slow query** identification
- **Memory usage** tracking
- **CPU utilization** monitoring

### Database Performance

- **Query execution** times
- **Connection pool** metrics
- **Index usage** statistics
- **Deadlock detection**

### Cache Performance

- **Hit/miss ratios**
- **Eviction rates**
- **Memory usage**
- **Latency metrics**

## Security Monitoring

### Security Events

- **Failed authentication** attempts
- **Unauthorized access** attempts
- **Privilege escalation** attempts
- **Data access** anomalies

### Compliance Monitoring

- **Data access** logging
- **PII exposure** detection
- **Regulatory compliance** checks
- **Audit trail** integrity

## Incident Response

### Monitoring for Incidents

- **Automated detection** of anomalies
- **Alert correlation** and deduplication
- **Incident creation** from alerts
- **Escalation** procedures

### Post-Incident Analysis

- **Root cause** analysis
- **Timeline** reconstruction
- **Impact assessment**
- **Prevention measures**

## Monitoring Tools

### Core Stack

- **Prometheus**: Metrics collection
- **Grafana**: Visualization
- **Jaeger**: Distributed tracing
- **Loki**: Log aggregation

### Additional Tools

- **Sentry**: Error tracking
- **New Relic**: APM monitoring
- **Datadog**: Infrastructure monitoring
- **PagerDuty**: Alert management

## Configuration

### Monitoring Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093
```

### Alert Rules

```yaml
# alert_rules.yml
groups:
  - name: api_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
```

### Sentry Configuration

#### Installation Status

✅ **Installed Packages:**

- `@sentry/react` - React SDK for error tracking
- `@sentry/vite-plugin` - Vite plugin for source maps

#### Setup Steps

1. **Get Sentry DSN**
   - Sign up at [sentry.io](https://sentry.io)
   - Create a new project (select "React")
   - Copy the DSN from project settings

2. **Configure Environment Variables**

   Add to `.env.production`:

   ```bash
   VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
   VITE_SENTRY_ENABLED=true
   VITE_SENTRY_ENVIRONMENT=production
   VITE_SENTRY_SAMPLE_RATE=1.0
   SENTRY_AUTH_TOKEN=your-auth-token
   ```

3. **Update Vite Configuration**

   Edit `vite.config.ts`:

   ```typescript
   import { defineConfig } from "vite";
   import react from "@vitejs/plugin-react";
   import { sentryVitePlugin } from "@sentry/vite-plugin";

   export default defineConfig({
     plugins: [
       react(),
       sentryVitePlugin({
         org: "your-org",
         project: "valuecanvas",
         authToken: process.env.SENTRY_AUTH_TOKEN,
         sourcemaps: {
           assets: "./dist/**",
         },
         bundleSizeOptimizations: {
           excludeDebugStatements: true,
         },
       }),
     ],
   });
   ```

## Best Practices

### Monitoring Design

- **Golden signals**: Latency, traffic, errors, saturation
- **Service level objectives** (SLOs) defined
- **Service level indicators** (SLIs) measured
- **Error budgets** tracked

### Alert Design

- **Actionable alerts** with clear runbooks
- **Alert fatigue** prevention
- **Escalation paths** defined
- **Alert quality** metrics

### Data Management

- **Retention policies** implemented
- **Data optimization** for cost
- **Privacy compliance** maintained
- **Data governance** enforced

---

**Last Updated**: 2026-01-14
**Maintained By**: Observability Team
**Review Frequency**: Monthly
