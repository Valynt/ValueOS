# ValueOS Production Deployment and Operations Runbook

## Overview

This runbook provides comprehensive guidance for deploying and operating ValueOS in production environments. It covers deployment strategies, monitoring, troubleshooting, and maintenance procedures.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Deployment Strategies](#deployment-strategies)
3. [Configuration Management](#configuration-management)
4. [Monitoring and Alerting](#monitoring-and-alerting)
5. [Troubleshooting Guide](#troubleshooting-guide)
6. [Maintenance Procedures](#maintenance-procedures)
7. [Security Procedures](#security-procedures)
8. [Performance Optimization](#performance-optimization)
9. [Disaster Recovery](#disaster-recovery)

## Prerequisites

### Infrastructure Requirements

- **Kubernetes Cluster**: v1.24+ with 3+ nodes
- **PostgreSQL**: v14+ with pg_stat_statements extension
- **Redis**: v6+ with persistence enabled
- **Load Balancer**: Nginx Ingress Controller or AWS ALB
- **Monitoring Stack**: Prometheus + Grafana + AlertManager

### Software Dependencies

```bash
# Required packages
Node.js 18.17.0+
pnpm 8.6.0+
Docker 24.0.0+
kubectl 1.27.0+
helm 3.12.0+
```

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/valueos
REDIS_URL=redis://host:6379

# External Services
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Security
JWT_SECRET=your-jwt-secret
WEB_SCRAPER_ENCRYPTION_KEY=32-char-key
ENCRYPTION_KEY=32-char-key

# Monitoring
SENTRY_DSN=https://your-sentry-dsn
DATADOG_API_KEY=your-datadog-key
```

## Deployment Strategies

### Blue-Green Deployment

```yaml
# k8s/blue-green-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: valueos-backend-blue
spec:
  replicas: 3
  selector:
    matchLabels:
      app: valueos-backend
      version: blue
  template:
    metadata:
      labels:
        app: valueos-backend
        version: blue
    spec:
      containers:
        - name: backend
          image: valueos/backend:v1.2.3
          envFrom:
            - configMapRef:
                name: valueos-config
            - secretRef:
                name: valueos-secrets
          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "1Gi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /health/live
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
```

### Rolling Update Strategy

```bash
# Rolling deployment with zero-downtime
kubectl set image deployment/valueos-backend backend=valueos/backend:v1.2.4
kubectl rollout status deployment/valueos-backend

# Rollback if needed
kubectl rollout undo deployment/valueos-backend
```

### Database Migrations

```bash
# Run migrations before deployment
cd packages/backend
pnpm db:migrate

# Verify migration success
pnpm db:status

# Rollback if needed
pnpm db:rollback
```

## Configuration Management

### Environment-Specific Configs

```typescript
// config/production.ts
export const config = {
  database: {
    poolSize: 20,
    acquireTimeoutMillis: 60000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200,
  },
  redis: {
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    retryDelayOnClusterDown: 1000,
  },
  agents: {
    maxConcurrent: 10,
    timeout: 300000, // 5 minutes
    retryAttempts: 3,
  },
  security: {
    rateLimitRequests: 100,
    rateLimitWindow: 900000, // 15 minutes
    jwtExpiry: "24h",
  },
};
```

### Feature Flags

```typescript
// Feature flag management
export const features = {
  agentTelemetry: process.env.ENABLE_AGENT_TELEMETRY === "true",
  advancedCaching: process.env.ENABLE_ADVANCED_CACHING === "true",
  experimentalAgents: process.env.ENABLE_EXPERIMENTAL_AGENTS === "true",
};
```

## Monitoring and Alerting

### Key Metrics to Monitor

```prometheus
# Application Metrics
- agent_execution_duration{quantile="0.95"} < 300000
- agent_execution_success_rate > 0.95
- http_request_duration_seconds{quantile="0.95"} < 5.0
- database_connection_pool_utilization < 0.8

# Infrastructure Metrics
- container_cpu_usage_seconds_total
- container_memory_usage_bytes / container_spec_memory_limit_bytes < 0.8
- redis_memory_usage_bytes / redis_memory_max_bytes < 0.8
- postgresql_active_connections < 50
```

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

### Health Check Endpoints

```bash
# Basic health check
curl https://your-domain.com/health

# Readiness check (for load balancer)
curl https://your-domain.com/health/ready

# Liveness check (for k8s)
curl https://your-domain.com/health/live

# Detailed health with metrics
curl https://your-domain.com/health/detailed

# Metrics endpoint
curl https://your-domain.com/metrics
```

## Troubleshooting Guide

### Agent Execution Failures

**Symptom**: Agents failing with timeout errors

**Diagnosis**:

```bash
# Check agent execution logs
kubectl logs -f deployment/valueos-backend -c backend | grep "agent.*timeout"

# Check LLM provider status
curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models

# Check Redis connectivity
kubectl exec -it redis-pod -- redis-cli ping
```

**Resolution**:

```bash
# Increase timeout settings
kubectl set env deployment/valueos-backend AGENT_TIMEOUT=600000

# Check circuit breaker status
curl https://your-domain.com/health/circuit-breakers

# Reset circuit breakers if needed
curl -X POST https://your-domain.com/admin/reset-circuit-breakers
```

### Database Performance Issues

**Symptom**: Slow query performance

**Diagnosis**:

```sql
-- Check slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Check table bloat
SELECT analyze_table_bloat();
```

**Resolution**:

```bash
# Run database optimization
kubectl exec -it postgres-pod -- psql -d valueos -f /scripts/database-performance-optimization.sql

# Reindex tables
kubectl exec -it postgres-pod -- psql -d valueos -c "REINDEX DATABASE valueos;"

# Vacuum analyze
kubectl exec -it postgres-pod -- psql -d valueos -c "VACUUM ANALYZE;"
```

### Memory Issues

**Symptom**: Out of memory errors

**Diagnosis**:

```bash
# Check memory usage
kubectl top pods

# Check application memory metrics
curl https://your-domain.com/metrics | grep memory

# Check for memory leaks in agents
curl https://your-domain.com/health/telemetry-summary
```

**Resolution**:

```bash
# Increase memory limits
kubectl patch deployment valueos-backend -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend","resources":{"limits":{"memory":"2Gi"}}}]}}}}'

# Enable garbage collection tuning
kubectl set env deployment/valueos-backend NODE_OPTIONS="--max-old-space-size=1536"

# Restart problematic pods
kubectl delete pod -l app=valueos-backend
```

### Network Connectivity Issues

**Symptom**: Agents unable to reach external APIs

**Diagnosis**:

```bash
# Check network policies
kubectl get networkpolicies

# Test external connectivity
kubectl exec -it valueos-backend-pod -- curl -I https://api.openai.com

# Check rate limiting
curl https://your-domain.com/health/rate-limits
```

**Resolution**:

```yaml
# Update network policy
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-external-apis
spec:
  podSelector:
    matchLabels:
      app: valueos-backend
  policyTypes:
    - Egress
  egress:
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 10.0.0.0/8
              - 172.16.0.0/12
              - 192.168.0.0/16
      ports:
        - protocol: TCP
          port: 443
```

## Maintenance Procedures

### Regular Maintenance Tasks

#### Daily Tasks

```bash
# Monitor system health
curl https://your-domain.com/health

# Check log aggregation
kubectl logs -f deployment/monitoring-stack -c fluent-bit --since=1h

# Verify backup completion
kubectl get jobs -l app=database-backup
```

#### Weekly Tasks

```bash
# Update dependencies
pnpm update

# Run security scans
pnpm audit
pnpm run security-scan

# Database maintenance
kubectl exec -it postgres-pod -- psql -d valueos -c "VACUUM ANALYZE;"
```

#### Monthly Tasks

```bash
# Certificate renewal check
kubectl get certificates

# Dependency updates and testing
pnpm update --latest
pnpm test

# Performance benchmarking
ab -n 1000 -c 10 https://your-domain.com/api/health
```

### Database Maintenance

```sql
-- Monthly maintenance script
-- Vacuum and analyze all tables
VACUUM ANALYZE;

-- Update statistics
ANALYZE;

-- Check for unused indexes
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid))
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- Archive old telemetry data (move to cold storage)
INSERT INTO telemetry_archive SELECT * FROM agent_telemetry_events
WHERE timestamp < NOW() - INTERVAL '90 days';

DELETE FROM agent_telemetry_events
WHERE timestamp < NOW() - INTERVAL '90 days';
```

### Log Rotation and Archival

```bash
# Log rotation configuration
cat > /etc/logrotate.d/valueos << EOF
/var/log/valueos/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 valueos valueos
    postrotate
        systemctl reload valueos-backend
    endscript
}
EOF

# Archive old logs to S3
aws s3 sync /var/log/valueos/archive/ s3://valueos-logs-archive/
```

## Security Procedures

### Certificate Management

```bash
# Renew SSL certificates
certbot renew

# Update Kubernetes secrets
kubectl create secret tls valueos-tls --cert=cert.pem --key=key.pem --dry-run=client -o yaml | kubectl apply -f -

# Verify certificate status
openssl s_client -connect your-domain.com:443 -servername your-domain.com
```

### Access Control

```bash
# Rotate service account tokens
kubectl create token service-account-name --duration=24h

# Update API keys
kubectl create secret generic api-keys --from-literal=openai-key=$NEW_OPENAI_KEY --dry-run=client -o yaml | kubectl apply -f -

# Audit user access
kubectl get rolebindings,clusterrolebindings -o wide
```

### Security Scanning

```bash
# Run container vulnerability scans
trivy image valueos/backend:latest

# Run dependency vulnerability scans
pnpm audit --audit-level high

# Run infrastructure security scans
kubectl run kube-bench --image=aquasec/kube-bench:latest --rm -it
```

## Performance Optimization

### Application Performance Tuning

```typescript
// Performance configuration
export const performanceConfig = {
  // Connection pooling
  database: {
    min: 2,
    max: 20,
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 60000,
  },

  // Caching strategy
  cache: {
    ttl: 300000, // 5 minutes
    maxMemory: "512mb",
    compression: true,
  },

  // Agent optimization
  agents: {
    concurrency: 5,
    batchSize: 10,
    retryDelay: 1000,
    circuitBreakerThreshold: 5,
  },

  // Request optimization
  requests: {
    timeout: 30000,
    retries: 3,
    backoffMultiplier: 2,
  },
};
```

### Database Optimization

```sql
-- Query optimization
EXPLAIN ANALYZE SELECT * FROM agent_execution_traces
WHERE agent_type = 'expansion' AND start_time > NOW() - INTERVAL '1 day';

-- Index optimization
CREATE INDEX CONCURRENTLY idx_agent_execution_traces_composite
ON agent_execution_traces (agent_type, status, start_time DESC);

-- Partitioning strategy for large tables
CREATE TABLE agent_telemetry_events_y2024 PARTITION OF agent_telemetry_events
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
```

### Infrastructure Optimization

```yaml
# Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: valueos-backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: valueos-backend
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

## Disaster Recovery

### Backup Strategy

```bash
# Database backup
kubectl exec -it postgres-pod -- pg_dump valueos > backup.sql

# Upload to S3
aws s3 cp backup.sql s3://valueos-backups/$(date +%Y%m%d_%H%M%S)_backup.sql

# Application state backup
kubectl get configmaps,secrets -o yaml > k8s-state-backup.yaml
```

### Recovery Procedures

```bash
# Database recovery
kubectl exec -it postgres-pod -- psql -d valueos < backup.sql

# Application state recovery
kubectl apply -f k8s-state-backup.yaml

# Verify recovery
curl https://your-domain.com/health
```

### Business Continuity

```yaml
# Multi-region deployment
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: valueos-ingress
  annotations:
    nginx.ingress.kubernetes.io/affinity: cookie
    nginx.ingress.kubernetes.io/affinity-mode: sticky
spec:
  rules:
    - host: your-domain.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: valueos-backend
                port:
                  number: 80
```

## Emergency Contacts

- **On-call Engineer**: +1-555-0123
- **Security Team**: security@company.com
- **Infrastructure Team**: infra@company.com
- **Database Team**: dba@company.com

## Change Management

### Deployment Approval Process

1. Create pull request with changes
2. Run automated tests and security scans
3. Peer code review
4. QA testing in staging environment
5. Infrastructure review for production impact
6. Schedule deployment during maintenance window
7. Execute deployment with rollback plan ready
8. Monitor for 30 minutes post-deployment
9. Mark deployment as successful

### Rollback Procedures

```bash
# Immediate rollback
kubectl rollout undo deployment/valueos-backend

# Gradual rollback with traffic shifting
kubectl set image deployment/valueos-backend-canary backend=valueos/backend:previous-version

# Database rollback (if needed)
kubectl exec -it postgres-pod -- psql -d valueos -f rollback-migration.sql
```

This runbook should be reviewed and updated quarterly to reflect changes in the ValueOS architecture and operational procedures.
