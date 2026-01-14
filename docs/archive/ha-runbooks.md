# ValueOS HA Runbook Library

# Emergency procedures and operational guides for high-availability deployment

## Table of Contents

1. [Critical Incident Response](#critical-incident-response)
2. [Region Failure & Failover](#region-failure--failover)
3. [Database Corruption & Recovery](#database-corruption--recovery)
4. [Load Balancer Failure](#load-balancer-failure)
5. [Security Incident Response](#security-incident-response)
6. [Performance Degradation](#performance-degradation)
7. [Maintenance Procedures](#maintenance-procedures)

---

## Critical Incident Response

### Severity Classification

- **SEV-0**: Complete system outage, critical business impact
- **SEV-1**: Major functionality broken, significant business impact
- **SEV-2**: Partial functionality degraded, moderate business impact
- **SEV-3**: Minor issues, low business impact

### Incident Response Flow

1. **Detection & Triage** (0-5 minutes)
   - Verify incident severity
   - Create incident channel
   - Notify on-call team

2. **Assessment** (5-15 minutes)
   - Identify affected systems
   - Determine blast radius
   - Check recent changes

3. **Mitigation** (15-60 minutes)
   - Implement immediate fixes
   - Restore critical services
   - Communicate status

4. **Resolution** (60+ minutes)
   - Permanent fix implementation
   - Post-incident review
   - Documentation updates

### Quick Commands

```bash
# Check overall system health
kubectl get pods -n valueos-ha --field-selector=status.phase!=Running
kubectl get nodes -o wide

# Check recent deployments
kubectl get deployments -n valueos-ha -o custom-columns=NAME:.metadata.name,CREATED:.metadata.creationTimestamp

# Check events
kubectl get events -n valueos-ha --sort-by='.lastTimestamp' | tail -20

# Check resource usage
kubectl top pods -n valueos-ha
kubectl top nodes
```

---

## Region Failure & Failover

### Detection

```bash
# Check region health
curl -f -s https://us-east.valueos.com/health || echo "US-East unhealthy"
curl -f -s https://eu-west.valueos.com/health || echo "EU-West unhealthy"
curl -f -s https://ap-southeast.valueos.com/health || echo "AP-Southeast unhealthy"

# Check DNS routing
dig +short valueos.com
dig +short eu-west.valueos.com
dig +short ap-southeast.valueos.com
```

### Manual Failover Procedure

#### Step 1: Assess Primary Region

```bash
# Check if primary region is completely down
REGION="us-east-1"
kubectl get nodes -l topology.kubernetes.io/region=$REGION --no-headers | wc -l
kubectl get pods -n valueos-ha -l topology.kubernetes.io/region=$REGION --field-selector=status.phase=Running | wc -l
```

#### Step 2: Promote Secondary Region

```bash
# Update DNS to point to secondary region
aws route53 change-resource-record-sets \
  --hosted-zone-id ZXXXXXXXXXX \
  --change-batch file://failover-to-eu-west.json

# Promote database replica
kubectl exec -n valueos-ha postgres-0 -- \
  pg_ctl promote -D /var/lib/postgresql/data

# Update region configuration
kubectl patch configmap region-config \
  -n valueos-ha \
  -p '{"data":{"CLUSTER_TYPE":"primary","DATABASE_ROLE":"master"}}'
```

#### Step 3: Scale Up Secondary Region

```bash
# Increase replica count
kubectl scale deployment valueos-frontend-ha \
  --replicas=5 -n valueos-ha

kubectl scale deployment valueos-backend-ha \
  --replicas=5 -n valueos-ha

# Wait for scaling
kubectl rollout status deployment/valueos-frontend-ha -n valueos-ha
kubectl rollout status deployment/valueos-backend-ha -n valueos-ha
```

#### Step 4: Verify Failover

```bash
# Test new primary region
curl -f -s https://valueos.com/health
curl -f -s https://api.valueos.com/health

# Check metrics
kubectl get pods -n valueos-ha -o wide
kubectl top pods -n valueos-ha
```

### Rollback Procedure

```bash
# If failover fails, rollback to primary
aws route53 change-resource-record-sets \
  --hosted-zone-id ZXXXXXXXXXX \
  --change-batch file://rollback-to-us-east.json

# Demote secondary replica
kubectl exec -n valueos-ha postgres-1 -- \
  pg_ctl stop -m fast -D /var/lib/postgresql/data
```

---

## Database Corruption & Recovery

### Detection

```bash
# Check database health
kubectl exec -n valueos-ha postgres-0 -- \
  pg_isready -U postgres

# Check database logs
kubectl logs -n valueos-ha postgres-0 --tail=100

# Check for corruption
kubectl exec -n valueos-ha postgres-0 -- \
  psql -U postgres -d valueos_prod -c "SELECT count(*) FROM pg_stat_database WHERE datname = 'valueos_prod' AND xact_commit + xact_rollback = 0;"
```

### Recovery Procedures

#### Option 1: Point-in-Time Recovery

```bash
# Identify last good backup
kubectl exec -n valueos-ha postgres-0 -- \
  psql -U postgres -d valueos_prod -c "SELECT pg_last_wal_receive_lsn();"

# Stop database
kubectl scale deployment postgres --replicas=0 -n valueos-ha

# Restore from backup
kubectl exec -i -n valueos-ha postgres-0 -- \
  psql -U postgres -d valueos_prod < backup-20240101.sql

# Start database
kubectl scale deployment postgres --replicas=1 -n valueos-ha
```

#### Option 2: Failover to Replica

```bash
# Promote replica
kubectl exec -n valueos-ha postgres-1 -- \
  pg_ctl promote -D /var/lib/postgresql/data

# Update connection strings
kubectl patch configmap valueos-config \
  -n valueos-ha \
  -p '{"data":{"DATABASE_URL":"postgresql://postgres:password@postgres-replica:5432/valueos_prod"}}'

# Restart dependent services
kubectl rollout restart deployment/valueos-backend-ha -n valueos-ha
```

#### Option 3: Full Database Rebuild

```bash
# Create new database instance
kubectl apply -f k8s/ha-postgres-recovery.yaml

# Restore from latest backup
kubectl exec -i -n valueos-ha postgres-recovery-0 -- \
  psql -U postgres -d valueos_prod < backup-latest.sql

# Update services to point to new database
kubectl patch service valueos-postgres-ha \
  -n valueos-ha \
  -p '{"spec":{"selector":{"app":"postgres-recovery"}}}'
```

---

## Load Balancer Failure

### Detection

```bash
# Check load balancer status
kubectl get svc -n valueos-ha
kubectl describe svc valueos-frontend-ha -n valueos-ha

# Check load balancer health
curl -I -s http://load-balancer/health
curl -I -s https://valueos.com/health

# Check nginx configuration
kubectl exec -n valueos-ha load-balancer-xxx -- \
  nginx -t
```

### Recovery Procedures

#### Option 1: Restart Load Balancer

```bash
# Restart load balancer pods
kubectl rollout restart deployment/load-balancer -n valueos-ha

# Wait for restart
kubectl rollout status deployment/load-balancer -n valueos-ha

# Verify health
curl -f -s https://valueos.com/health
```

#### Option 2: Rebuild Load Balancer

```bash
# Delete and recreate
kubectl delete deployment load-balancer -n valueos-ha
kubectl apply -f k8s/ha-load-balancer.yaml

# Wait for deployment
kubectl rollout status deployment/load-balancer -n valueos-ha
```

#### Option 3: Manual DNS Failover

```bash
# Point DNS directly to frontend services
aws route53 change-resource-record-sets \
  --hosted-zone-id ZXXXXXXXXXX \
  --change-batch file://direct-to-frontend.json

# Update frontend service to LoadBalancer type
kubectl patch svc valueos-frontend-ha \
  -n valueos-ha \
  -p '{"spec":{"type":"LoadBalancer"}}'
```

---

## Security Incident Response

### Detection

```bash
# Check for unusual activity
kubectl logs -n valueos-ha --all-containers=true | grep -i "error\|fail\|attack\|unauthorized"

# Check network policies
kubectl get networkpolicies -n valueos-ha

# Check pod security
kubectl get pods -n valueos-ha -o jsonpath='{.items[*].spec.securityContext}'

# Check for compromised images
kubectl get pods -n valueos-ha -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[*].image}{"\n"}{end}'
```

### Response Procedures

#### Step 1: Isolation

```bash
# Isolate affected pods
kubectl get pods -n valueos-ha -l security=compromised
kubectl delete pods -n valueos-ha -l security=compromised --force --grace-period=0

# Enable network lockdown
kubectl apply -f k8s/security-lockdown.yaml

# Rotate secrets
kubectl delete secret valueos-secrets -n valueos-ha
kubectl apply -f k8s/ha-configs.yaml
```

#### Step 2: Investigation

```bash
# Collect evidence
kubectl get events -n valueos-ha --sort-by='.lastTimestamp' > incident-events.log
kubectl logs -n valueos-ha --all-containers=true > incident-logs.log

# Check for persistence
kubectl get pods -n valueos-ha -o yaml | grep -i "volume\|pvc"

# Audit recent changes
kubectl get deployments -n valueos-ha -o custom-columns=NAME:.metadata.name,IMAGE:.spec.template.spec.containers[0].image,CREATED:.metadata.creationTimestamp
```

#### Step 3: Recovery

```bash
# Rebuild affected services
kubectl rollout restart deployment/valueos-frontend-ha -n valueos-ha
kubectl rollout restart deployment/valueos-backend-ha -n valueos-ha

# Verify security
kubectl get pods -n valueos-ha -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.securityContext.runAsNonRoot}{"\n"}{end}'

# Update security policies
kubectl apply -f k8s/security-policies.yaml
```

---

## Performance Degradation

### Detection

```bash
# Check resource usage
kubectl top pods -n valueos-ha --sort-by=cpu
kubectl top pods -n valueos-ha --sort-by=memory
kubectl top nodes

# Check response times
curl -w "@curl-format.txt" -s https://valueos.com/health

# Check database performance
kubectl exec -n valueos-ha postgres-0 -- \
  psql -U postgres -d valueos_prod -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"
```

### Mitigation Procedures

#### Option 1: Scale Resources

```bash
# Increase replica count
kubectl scale deployment valueos-frontend-ha --replicas=5 -n valueos-ha
kubectl scale deployment valueos-backend-ha --replicas=5 -n valueos-ha

# Increase resource limits
kubectl patch deployment valueos-frontend-ha -n valueos-ha \
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"frontend","resources":{"limits":{"cpu":"1500m","memory":"2Gi"}}}]}}}}'

# Wait for scaling
kubectl rollout status deployment/valueos-frontend-ha -n valueos-ha
```

#### Option 2: Database Optimization

```bash
# Check slow queries
kubectl exec -n valueos-ha postgres-0 -- \
  psql -U postgres -d valueos_prod -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Restart database
kubectl rollout restart deployment/postgres -n valueos-ha

# Optimize connections
kubectl patch deployment postgres -n valueos-ha \
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"postgres","env":[{"name":"POSTGRES_SHARED_PRELOAD_LIBRARIES","value":"pg_stat_statements"}]}]}}}}'
```

#### Option 3: Cache Optimization

```bash
# Clear Redis cache
kubectl exec -n valueos-ha redis-0 -- redis-cli FLUSHALL

# Restart Redis
kubectl rollout restart deployment/redis -n valueos-ha

# Increase Redis memory
kubectl patch deployment redis -n valueos-ha \
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"redis","resources":{"limits":{"memory":"2Gi"}}}]}}}}'
```

---

## Maintenance Procedures

### Planned Maintenance

```bash
# Enable maintenance mode
kubectl create configmap maintenance-flag \
  --from-literal=enabled=true \
  -n valueos-ha

# Update load balancer to serve maintenance page
kubectl patch deployment load-balancer -n valueos-ha \
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"nginx","env":[{"name":"MAINTENANCE_MODE","value":"true"}]}]}}}}'

# Wait for maintenance mode
curl -I -s https://valueos.com | grep -i "maintenance"
```

### Rolling Updates

```bash
# Update frontend
kubectl set image deployment/valueos-frontend-ha \
  frontend=valueos/valueos-frontend:v1.2.0 \
  -n valueos-ha

# Monitor rollout
kubectl rollout status deployment/valueos-frontend-ha -n valueos-ha
kubectl get pods -n valueos-ha -l app=valueos-frontend

# Update backend
kubectl set image deployment/valueos-backend-ha \
  backend=valueos/valueos-backend:v1.2.0 \
  -n valueos-ha
```

### Disable Maintenance

```bash
# Disable maintenance mode
kubectl delete configmap maintenance-flag -n valueos-ha

# Restart load balancer
kubectl rollout restart deployment/load-balancer -n valueos-ha

# Verify service restoration
curl -f -s https://valueos.com/health
```

---

## Emergency Contacts & Escalation

### On-Call Team

- **Primary On-Call**: +1-555-0123 (oncall@valueos.com)
- **Secondary On-Call**: +1-555-0124 (oncall-backup@valueos.com)
- **Engineering Lead**: +1-555-0125 (eng-lead@valueos.com)

### External Services

- **Cloud Provider**: AWS Support (Premium)
- **DNS Provider**: Cloudflare Support
- **CDN Provider**: Cloudflare Support
- **Monitoring**: Datadog Support

### Communication Channels

- **Incident Channel**: #incidents-valueos
- **Engineering Channel**: #engineering-valueos
- **Status Page**: status.valueos.com

---

## Post-Incident Review Checklist

### Technical Review

- [ ] Root cause identified
- [ ] Timeline documented
- [ ] Impact assessed
- [ ] Preventive measures defined
- [ ] Monitoring gaps identified

### Process Review

- [ ] Response time evaluated
- [ ] Communication effectiveness assessed
- [ ] Escalation procedures reviewed
- [ ] Documentation updated
- [ ] Team feedback collected

### Follow-up Actions

- [ ] Technical fixes implemented
- [ ] Monitoring improved
- [ ] Runbooks updated
- [ ] Training conducted
- [ ] Metrics tracked

---

## Quick Reference Commands

### Health Checks

```bash
# Overall health
kubectl get pods -n valueos-ha --field-selector=status.phase!=Running
kubectl get nodes --sort-by='.metadata.name'

# Service health
curl -f -s https://valueos.com/health
curl -f -s https://api.valueos.com/health

# Database health
kubectl exec -n valueos-ha postgres-0 -- pg_isready -U postgres
```

### Scaling Operations

```bash
# Scale up
kubectl scale deployment valueos-frontend-ha --replicas=5 -n valueos-ha
kubectl scale deployment valueos-backend-ha --replicas=5 -n valueos-ha

# Scale down
kubectl scale deployment valueos-frontend-ha --replicas=2 -n valueos-ha
kubectl scale deployment valueos-backend-ha --replicas=2 -n valueos-ha
```

### Restart Operations

```bash
# Restart services
kubectl rollout restart deployment/valueos-frontend-ha -n valueos-ha
kubectl rollout restart deployment/valueos-backend-ha -n valueos-ha
kubectl rollout restart deployment/postgres -n valueos-ha
kubectl rollout restart deployment/redis -n valueos-ha

# Check rollout status
kubectl rollout status deployment/valueos-frontend-ha -n valueos-ha
```

### Debug Commands

```bash
# Check logs
kubectl logs -n valueos-ha deployment/valueos-frontend-ha --tail=100
kubectl logs -n valueos-ha deployment/valueos-backend-ha --tail=100

# Exec into pod
kubectl exec -it -n valueos-ha deployment/valueos-frontend-ha -- /bin/sh

# Port forward for debugging
kubectl port-forward -n valueos-ha deployment/valueos-frontend-ha 8080:8080
```

This runbook provides comprehensive procedures for handling all major incident scenarios in the ValueOS HA deployment.
