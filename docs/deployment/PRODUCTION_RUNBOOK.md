# Production Deployment Runbook

**Last Updated:** 2024-11-29  
**Version:** 1.0  
**Status:** ✅ PRODUCTION READY

---

## 🎯 Overview

This runbook provides step-by-step instructions for deploying the Enterprise Multi-Tenant Secrets Management system to production.

**System Components:**
- Multi-tenant secrets manager (Sprint 1)
- Provider abstraction (AWS/Vault) (Sprint 2)
- Kubernetes CSI driver integration (Sprint 3)
- Advanced features (versioning, encryption) (Sprint 4)

---

## 📋 Pre-Deployment Checklist

### Infrastructure

- [ ] Kubernetes cluster (v1.24+) deployed
- [ ] Secrets Store CSI Driver installed
- [ ] HashiCorp Vault or AWS Secrets Manager configured
- [ ] Prometheus + Grafana for monitoring
- [ ] Database (PostgreSQL) for audit logs
- [ ] Redis for rate limiting/caching

### Configuration

- [ ] Environment variables reviewed
- [ ] Secrets properly configured in provider
- [ ] RLS policies applied to database
- [ ] Network policies configured
- [ ] TLS certificates valid

### Security

- [ ] Security audit completed
- [ ] Penetration testing passed
- [ ] Compliance requirements verified (SOC 2, GDPR)
- [ ] Incident response plan documented
- [ ] Backup/recovery procedures tested

### Team Readiness

- [ ] Ops team trained on runbook
- [ ] On-call rotation established
- [ ] Monitoring dashboards configured
- [ ] Alert channels tested (Slack/PagerDuty)

---

## 🚀 Deployment Steps

### Phase 1: Infrastructure Setup (Day 1)

#### 1.1 Install Secrets Store CSI Driver

```bash
# Add Helm repo
helm repo add secrets-store-csi-driver \
  https://kubernetes-sigs.github.io/secrets-store-csi-driver/charts

# Install driver
helm install csi-secrets-store \
  secrets-store-csi-driver/secrets-store-csi-driver \
  --namespace kube-system \
  --set syncSecret.enabled=true

# Verify installation
kubectl get pods -n kube-system | grep csi-secrets-store
```

**Expected Output:**
```
csi-secrets-store-xxx   2/2   Running
```

#### 1.2 Install Vault CSI Provider (if using Vault)

```bash
# Install Vault provider
kubectl apply -f \
  https://raw.githubusercontent.com/hashicorp/vault-csi-provider/main/deployment/vault-csi-provider.yaml

# Verify
kubectl get pods -n kube-system | grep vault-csi
```

#### 1.3 Configure Vault Authentication

```bash
# Enable Kubernetes auth in Vault
vault auth enable kubernetes

# Configure Kubernetes auth
vault write auth/kubernetes/config \
  kubernetes_host="https://$KUBERNETES_SERVICE_HOST:$KUBERNETES_SERVICE_PORT" \
  kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt

# Create policy
vault policy write valuecanvas-production - <<EOF
path "secret/data/production/tenants/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "secret/metadata/production/tenants/*" {
  capabilities = ["read", "list", "delete"]
}
EOF

# Create role
vault write auth/kubernetes/role/valuecanvas-production \
  bound_service_account_names=valuecanvas \
  bound_service_account_namespaces=production \
  policies=valuecanvas-production \
  ttl=24h
```

---

### Phase 2: Database Setup (Day 1)

#### 2.1 Apply Database Migrations

```bash
# Navigate to migrations directory
cd supabase/migrations

# Apply audit log table
psql $DATABASE_URL -f 20241129_secret_audit_logs.sql

# Verify table created
psql $DATABASE_URL -c "\d secret_audit_logs"
```

**Expected Columns:**
- id (UUID)
- tenant_id
- user_id
- secret_key
- action
- result
- metadata
- timestamp

#### 2.2 Verify RLS Policies

```bash
# Check RLS enabled
psql $DATABASE_URL -c "
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'secret_audit_logs';
"
```

**Expected:** `rowsecurity = t`

#### 2.3 Test Audit Logging

```bash
# Insert test audit log
psql $DATABASE_URL -c "
SET app.current_user_role = 'system';
INSERT INTO secret_audit_logs (tenant_id, user_id, secret_key, action, result)
VALUES ('test-tenant', 'system', 'test-secret', 'READ', 'SUCCESS');
"

# Verify insert
psql $DATABASE_URL -c "
SELECT * FROM secret_audit_logs 
WHERE tenant_id = 'test-tenant' 
LIMIT 1;
"
```

---

### Phase 3: Deploy Application (Day 2)

#### 3.1 Create Kubernetes Namespace

```bash
# Create namespace
kubectl create namespace production

# Label namespace
kubectl label namespace production \
  environment=production \
  managed-by=valuecanvas
```

#### 3.2 Deploy SecretProviderClass

```bash
# Apply for Vault
kubectl apply -f kubernetes/secrets/secret-provider-class-vault.yaml

# OR for AWS
kubectl apply -f kubernetes/secrets/secret-provider-class-aws.yaml

# Verify
kubectl get secretproviderclass -n production
```

#### 3.3 Create Service Account

```bash
# Apply service account and RBAC
kubectl apply -f kubernetes/secrets/deployment-with-csi.yaml

# Verify service account
kubectl get serviceaccount valuecanvas -n production
```

#### 3.4 Deploy Application

```bash
# Build and push image
docker build -t valuecanvas/api:v1.0.0 .
docker push valuecanvas/api:v1.0.0

# Update deployment with new image
kubectl set image deployment/valuecanvas-api \
  api=valuecanvas/api:v1.0.0 \
  -n production

# Watch rollout
kubectl rollout status deployment/valuecanvas-api -n production
```

**Expected Output:**
```
deployment "valuecanvas-api" successfully rolled out
```

#### 3.5 Verify Secret Mounting

```bash
# Exec into pod
kubectl exec -it deployment/valuecanvas-api -n production -- /bin/sh

# Check mounted secrets
ls -la /mnt/secrets

# Expected files:
# database-username
# database-password
# together-api-key
# jwt-secret
# supabase-*
```

---

### Phase 4: Configure Monitoring (Day 2)

#### 4.1 Apply Prometheus Alerts

```bash
# Apply alert rules
kubectl apply -f kubernetes/monitoring/prometheus-alerts.yaml

# Verify alerts loaded
kubectl get prometheusrule -n monitoring
```

#### 4.2 Import Grafana Dashboard

```bash
# Open Grafana UI
# Navigate to Dashboards > Import
# Upload: kubernetes/monitoring/grafana-dashboard.json

# Verify panels:
# - Secret Access Rate
# - Access Latency (p95)
# - Cache Hit Rate
# - Rotation Success Rate
```

#### 4.3 Test Metrics Endpoint

```bash
# Port forward to service
kubectl port-forward svc/valuecanvas-api 3000:80 -n production

# Query metrics
curl http://localhost:3000/metrics | grep secret_

# Expected metrics:
# secret_access_total
# secret_access_latency_seconds
# secret_rotation_total
```

---

### Phase 5: Enable Secret Rotation (Day 3)

#### 5.1 Configure Rotation Policies

```typescript
// In application startup code
import { createRotationScheduler, RotationPolicies } from './secrets/SecretRotationScheduler'

const scheduler = createRotationScheduler(provider)
scheduler.start()

// Schedule for each tenant
scheduler.scheduleRotation({
  tenantId: 'acme-corp',
  secretKey: 'database_credentials',
  policy: RotationPolicies.DATABASE_CREDENTIALS,
  cronSchedule: '0 2 */90 * *' // Every 90 days at 2 AM
})
```

#### 5.2 Test Manual Rotation

```bash
# Trigger test rotation
curl -X POST https://api.valuecanvas.io/admin/secrets/rotate \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "test-tenant",
    "secretKey": "test_secret"
  }'

# Verify in logs
kubectl logs -f deployment/valuecanvas-api -n production | grep "SECRET"
```

---

## 🔄 Post-Deployment Verification

### Smoke Tests

```bash
# 1. Health check
curl https://api.valuecanvas.io/health

# Expected: {"status": "healthy", "uptime": ...}

# 2. Secret access test
curl https://api.valuecanvas.io/api/test/secret-access \
  -H "Authorization: Bearer $API_KEY"

# Expected: {"success": true}

# 3. Metrics endpoint
curl https://api.valuecanvas.io/metrics

# Expected: Prometheus metrics

# 4. Audit log test
psql $DATABASE_URL -c "
SELECT COUNT(*) FROM secret_audit_logs 
WHERE timestamp > NOW() - INTERVAL '1 hour';
"

# Expected: >0 entries
```

### Performance Tests

```bash
# Run load test (100 req/sec for 1 minute)
wrk -t4 -c100 -d60s \
  -H "Authorization: Bearer $API_KEY" \
  https://api.valuecanvas.io/api/secrets/test

# Expected metrics:
# - Latency p50 < 50ms
# - Latency p95 < 100ms
# - Error rate < 0.1%
```

---

## 🚨 Rollback Procedures

### Application Rollback

```bash
# Rollback to previous deployment
kubectl rollout undo deployment/valuecanvas-api -n production

# Verify rollback
kubectl rollout status deployment/valuecanvas-api -n production

# Check specific revision
kubectl rollout history deployment/valuecanvas-api -n production

# Rollback to specific revision
kubectl rollout undo deployment/valuecanvas-api \
  --to-revision=2 \
  -n production
```

### Database Rollback

```bash
# Run rollback migration
psql $DATABASE_URL -f supabase/migrations/rollback/20241129_secret_audit_logs_rollback.sql

# Verify table dropped
psql $DATABASE_URL -c "\dt secret_audit_logs"

# Expected: relation does not exist
```

### Secret Rollback

```bash
# Rollback secret to previous version
curl -X POST https://api.valuecanvas.io/admin/secrets/rollback \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "tenantId": "tenant-id",
    "secretKey": "secret-key",
    "targetVersion": "v1234567890-abc123"
  }'
```

---

## 🔍 Monitoring & Alerts

### Key Metrics to Watch

**Application Metrics:**
- Secret access rate: <1000 req/sec normal
- Access latency p95: <100ms
- Error rate: <0.1%
- Cache hit rate: >80%

**Rotation Metrics:**
- Success rate: >99%
- Duration p95: <5 minutes
- Failure count: 0

**Infrastructure:**
- Pod CPU: <70%
- Pod memory: <80%
- Database connections: <80% of pool

### Critical Alerts

**Immediate Response (Page On-Call):**
- SecretProviderDown
- SecretRotationFailure
- LowRotationSuccessRate (<99%)
- HighSecretAccessErrorRate (>10/min)

**Investigation Required:**
- HighSecretAccessLatency (>500ms)
- LowCacheHitRate (<70%)
- ExcessiveSecretAccess (>100 req/sec)

---

## 🐛 Troubleshooting

### Issue: Secrets Not Mounting

**Symptoms:** Pods can't read `/mnt/secrets`

**Diagnosis:**
```bash
# Check CSI driver pods
kubectl get pods -n kube-system | grep csi

# Check SecretProviderClass
kubectl describe secretproviderclass valuecanvas-secrets -n production

# Check pod events
kubectl describe pod <pod-name> -n production
```

**Resolution:**
1. Verify CSI driver running
2. Check SecretProviderClass configuration
3. Verify Vault/AWS credentials
4. Restart pod

---

### Issue: High Latency

**Symptoms:** p95 latency >500ms

**Diagnosis:**
```bash
# Check cache hit rate
curl http://localhost:3000/metrics | grep cache_hits

# Check provider latency
kubectl logs -f deployment/valuecanvas-api | grep latency_ms
```

**Resolution:**
1. Increase cache TTL
2. Add more replicas
3. Check provider health
4. Review network policies

---

### Issue: Rotation Failures

**Symptoms:** Rotation success rate <99%

**Diagnosis:**
```bash
# Check rotation logs
kubectl logs -f deployment/valuecanvas-api | grep rotation

# Check provider status
vault status # or aws secretsmanager describe-secret
```

**Resolution:**
1. Verify provider connectivity
2. Check rotation policy configuration
3. Review grace period settings
4. Test manual rotation

---

## 📞 Escalation

### On-Call Contacts

**Level 1 - Operations:**
- Primary: ops-team@company.com
- Secondary: devops-lead@company.com

**Level 2 - Engineering:**
- Primary: eng-lead@company.com
- Secondary: security-team@company.com

**Level 3 - Executive:**
- CTO: cto@company.com

### Escalation Criteria

**Immediate (L3):**
- Security breach detected
- Data loss
- Complete service outage >30min

**Urgent (L2):**
- Rotation failures affecting production
- High error rates (>5%)
- Performance degradation >50%

**Standard (L1):**
- Individual service issues
- Configuration problems
- Non-critical alerts

---

## 📚 Additional Resources

### Documentation
- [Sprint 1 Complete](../security/SPRINT1_COMPLETE.md) - Multi-tenancy
- [Sprint 2 Complete](../security/SPRINT2_COMPLETE.md) - Provider abstraction
- [Sprint 3 Complete](../security/SPRINT3_COMPLETE.md) - Kubernetes integration
- [Sprint 4 Complete](../security/SPRINT4_COMPLETE.md) - Advanced features

### External Resources
- [Kubernetes CSI Driver Docs](https://secrets-store-csi-driver.sigs.k8s.io/)
- [HashiCorp Vault Docs](https://www.vaultproject.io/docs)
- [AWS Secrets Manager Docs](https://docs.aws.amazon.com/secretsmanager/)

---

**Runbook Version:** 1.0  
**Last Updated:** 2024-11-29  
**Next Review:** 2024-12-29  
**Maintained By:** DevOps Team
