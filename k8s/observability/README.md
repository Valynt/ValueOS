# ValueCanvas Observability Stack

Complete observability solution with metrics, logs, and distributed tracing.

## 📊 Stack Components

### 1. **Prometheus** - Metrics Collection
- Time-series database for metrics
- Service discovery for Kubernetes
- Alert rule evaluation
- PromQL query language

### 2. **Grafana** - Visualization
- Pre-built dashboards
- Multi-datasource support
- Alerting and notifications
- User management

### 3. **Jaeger** - Distributed Tracing
- OpenTelemetry compatible
- Trace visualization
- Service dependency graphs
- Performance analysis

### 4. **Loki** - Log Aggregation
- Log storage and querying
- Label-based indexing
- Integration with Grafana
- Cost-effective storage

### 5. **Fluent Bit** - Log Collection
- Lightweight log forwarder
- Kubernetes metadata enrichment
- Multiple output plugins
- Low resource footprint

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Grafana                              │
│              (Visualization & Dashboards)                    │
└────────┬──────────────┬──────────────┬─────────────────────┘
         │              │              │
         ▼              ▼              ▼
┌────────────┐  ┌────────────┐  ┌────────────┐
│ Prometheus │  │   Jaeger   │  │    Loki    │
│  (Metrics) │  │  (Traces)  │  │   (Logs)   │
└─────┬──────┘  └─────┬──────┘  └─────┬──────┘
      │               │               │
      │               │               │
      ▼               ▼               ▼
┌─────────────────────────────────────────────┐
│         Application Pods                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Backend  │  │ Backend  │  │ Frontend │  │
│  │  (OTEL)  │  │  (OTEL)  │  │          │  │
│  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────┘
                     ▲
                     │
              ┌──────┴──────┐
              │  Fluent Bit │
              │ (DaemonSet) │
              └─────────────┘
```

## 🚀 Quick Start

### Deploy the Stack

```bash
cd k8s/observability
./deploy-observability.sh
```

### Access Services

**Prometheus:**
```bash
kubectl port-forward -n observability svc/prometheus 9090:9090
# Open: http://localhost:9090
```

**Grafana:**
```bash
kubectl port-forward -n observability svc/grafana 3000:3000
# Open: http://localhost:3000
# Username: admin
# Password: (see below)
```

**Jaeger:**
```bash
kubectl port-forward -n observability svc/jaeger-query 16686:16686
# Open: http://localhost:16686
```

### Get Grafana Password

```bash
kubectl get secret grafana-secrets -n observability \
  -o jsonpath='{.data.admin-password}' | base64 -d
```

## 📈 Metrics

### Available Metrics

**Application Metrics:**
- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request latency
- `http_requests_in_flight` - Active requests
- `database_connections_active` - Active DB connections
- `database_query_duration_seconds` - Query latency

**System Metrics:**
- `container_cpu_usage_seconds_total` - CPU usage
- `container_memory_working_set_bytes` - Memory usage
- `kube_pod_status_phase` - Pod status
- `kube_deployment_status_replicas` - Replica count

### Query Examples

**Request Rate:**
```promql
sum(rate(http_requests_total{namespace="valuecanvas-production"}[5m]))
```

**Error Rate:**
```promql
sum(rate(http_requests_total{status=~"5..",namespace="valuecanvas-production"}[5m]))
/
sum(rate(http_requests_total{namespace="valuecanvas-production"}[5m]))
```

**P95 Latency:**
```promql
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket{namespace="valuecanvas-production"}[5m])) by (le)
)
```

**CPU Usage:**
```promql
sum(rate(container_cpu_usage_seconds_total{namespace="valuecanvas-production"}[5m])) by (pod)
```

## 📝 Logs

### Query Logs in Grafana

**All logs from namespace:**
```logql
{namespace="valuecanvas-production"}
```

**Error logs:**
```logql
{namespace="valuecanvas-production"} |= "error" or "ERROR"
```

**Logs from specific pod:**
```logql
{namespace="valuecanvas-production", pod="backend-xyz"}
```

**Logs with JSON parsing:**
```logql
{namespace="valuecanvas-production"} | json | level="error"
```

**Rate of errors:**
```logql
sum(rate({namespace="valuecanvas-production"} |= "error" [5m]))
```

## 🔍 Distributed Tracing

### Instrumentation

The backend is instrumented with OpenTelemetry:

```typescript
import { initTelemetry } from './lib/telemetry';

// Initialize at application startup
initTelemetry();
```

### View Traces

1. Open Jaeger UI: http://localhost:16686
2. Select service: `valuecanvas-backend`
3. Click "Find Traces"
4. Explore trace details

### Trace Features

- **Service Map** - Visualize service dependencies
- **Trace Timeline** - See request flow
- **Span Details** - Inspect individual operations
- **Error Tracking** - Find failed requests

## 📊 Grafana Dashboards

### Pre-Built Dashboards

1. **ValueCanvas Overview**
   - Request rate
   - Error rate
   - Response time (p95, p99)
   - Pod status
   - CPU and memory usage

2. **Kubernetes Cluster**
   - Node status
   - Pod status
   - Resource usage
   - Network traffic

3. **Application Performance**
   - Request latency
   - Database queries
   - Cache hit rate
   - Error rates

### Create Custom Dashboard

1. Open Grafana
2. Click "+" → "Dashboard"
3. Add Panel
4. Select Prometheus datasource
5. Enter PromQL query
6. Configure visualization
7. Save dashboard

## 🚨 Alerting

### Alert Rules

Alerts are defined in `prometheus/alert-rules.yaml`:

- **HighErrorRate** - Error rate > 5%
- **HighResponseTime** - P95 latency > 1s
- **PodDown** - Pod unavailable > 2min
- **HighCPUUsage** - CPU > 80%
- **HighMemoryUsage** - Memory > 90%
- **PodRestarting** - Frequent restarts

### Configure Notifications

**Slack:**
```yaml
# Add to AlertManager config
receivers:
  - name: 'slack'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/...'
        channel: '#alerts'
        title: 'Alert: {{ .GroupLabels.alertname }}'
```

**PagerDuty:**
```yaml
receivers:
  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: 'your-service-key'
```

**Email:**
```yaml
receivers:
  - name: 'email'
    email_configs:
      - to: 'team@valuecanvas.com'
        from: 'alerts@valuecanvas.com'
```

## 🔧 Configuration

### Prometheus Retention

Edit `prometheus-deployment.yaml`:

```yaml
args:
  - '--storage.tsdb.retention.time=30d'
  - '--storage.tsdb.retention.size=50GB'
```

### Loki Retention

Edit `loki-deployment.yaml`:

```yaml
limits_config:
  retention_period: 744h  # 31 days
```

### Jaeger Storage

Edit `jaeger-all-in-one.yaml`:

```yaml
env:
  - name: SPAN_STORAGE_TYPE
    value: "badger"  # or "elasticsearch", "cassandra"
```

## 📦 Resource Requirements

| Component | CPU Request | Memory Request | Storage |
|-----------|-------------|----------------|---------|
| Prometheus | 500m | 2Gi | 50Gi |
| Grafana | 100m | 256Mi | 10Gi |
| Jaeger | 200m | 512Mi | 20Gi |
| Loki | 200m | 512Mi | 30Gi |
| Fluent Bit | 100m | 128Mi | - |

**Total:** ~1.1 CPU, ~3.4Gi RAM, ~110Gi storage

## 🔐 Security

### Grafana Authentication

Change default password:

```bash
kubectl create secret generic grafana-secrets \
  --from-literal=admin-user=admin \
  --from-literal=admin-password=YOUR_SECURE_PASSWORD \
  --namespace=observability \
  --dry-run=client -o yaml | kubectl apply -f -
```

### External Access

Create Ingress for external access:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: observability
  namespace: observability
spec:
  rules:
  - host: grafana.valuecanvas.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: grafana
            port:
              number: 3000
```

### RBAC

All components use service accounts with minimal permissions:
- Prometheus: Read-only cluster access
- Fluent Bit: Read pods and namespaces
- Grafana: No cluster access

## 🐛 Troubleshooting

### Prometheus Not Scraping

```bash
# Check Prometheus targets
kubectl port-forward -n observability svc/prometheus 9090:9090
# Open: http://localhost:9090/targets

# Check pod annotations
kubectl get pod <pod-name> -n valuecanvas-production -o yaml | grep prometheus
```

### Grafana Can't Connect to Datasources

```bash
# Check datasource config
kubectl get configmap grafana-datasources -n observability -o yaml

# Check service endpoints
kubectl get endpoints -n observability
```

### Jaeger Not Receiving Traces

```bash
# Check Jaeger collector logs
kubectl logs -n observability deployment/jaeger -c jaeger

# Verify OTLP endpoint
kubectl get svc jaeger-collector -n observability
```

### Loki Not Receiving Logs

```bash
# Check Fluent Bit logs
kubectl logs -n observability daemonset/fluent-bit

# Check Loki logs
kubectl logs -n observability deployment/loki
```

### High Resource Usage

```bash
# Check resource usage
kubectl top pods -n observability

# Reduce retention periods
# Reduce scrape intervals
# Increase resource limits
```

## 📚 Best Practices

1. **Set Retention Policies** - Balance storage costs with data needs
2. **Use Labels Wisely** - Avoid high-cardinality labels
3. **Create Meaningful Dashboards** - Focus on actionable metrics
4. **Set Up Alerts** - Monitor critical metrics
5. **Regular Backups** - Backup Grafana dashboards and configs
6. **Monitor the Monitors** - Alert on observability stack health
7. **Document Runbooks** - Link alerts to resolution steps

## 🔄 Maintenance

### Backup Grafana Dashboards

```bash
# Export all dashboards
kubectl exec -n observability deployment/grafana -- \
  grafana-cli admin export-dashboard > dashboards-backup.json
```

### Update Components

```bash
# Update Prometheus
kubectl set image deployment/prometheus \
  prometheus=prom/prometheus:v2.49.0 \
  -n observability

# Update Grafana
kubectl set image deployment/grafana \
  grafana=grafana/grafana:10.3.0 \
  -n observability
```

### Scale Components

```bash
# Scale Prometheus (if using StatefulSet)
kubectl scale statefulset prometheus -n observability --replicas=2

# Scale Loki
kubectl scale deployment loki -n observability --replicas=2
```

## 📖 Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [Loki Documentation](https://grafana.com/docs/loki/)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Fluent Bit Documentation](https://docs.fluentbit.io/)

## 🆘 Support

For issues or questions:
1. Check component logs
2. Review this documentation
3. Check official documentation
4. Contact DevOps team
