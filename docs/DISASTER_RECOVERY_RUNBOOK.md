# Disaster Recovery Runbook

**Version**: 1.0  
**Last Updated**: 2024-11-23  
**Owner**: Platform Engineering Team  
**Review Cycle**: Quarterly

## Table of Contents

1. [Overview](#overview)
2. [Recovery Objectives](#recovery-objectives)
3. [Emergency Contacts](#emergency-contacts)
4. [Incident Response Procedures](#incident-response-procedures)
5. [Scenario-Specific Runbooks](#scenario-specific-runbooks)
6. [Post-Incident Procedures](#post-incident-procedures)
7. [Testing and Validation](#testing-and-validation)

---

## Overview

This runbook provides step-by-step procedures for recovering from critical system failures in the ValueCanvas platform. All procedures are designed to minimize downtime and data loss while maintaining system integrity.

### Scope

This runbook covers:
- Database failures and corruption
- LLM service outages
- Infrastructure failures (Kubernetes, Redis, etc.)
- Security incidents
- Data loss scenarios
- Complete system outages

### Prerequisites

Before executing any recovery procedure:
1. Assess the severity and impact
2. Notify the incident response team
3. Document all actions taken
4. Preserve evidence for post-mortem analysis

---

## Recovery Objectives

### RTO (Recovery Time Objective)

| Service | RTO | Priority |
|---------|-----|----------|
| Database | 5 minutes | P0 |
| API Services | 10 minutes | P0 |
| LLM Services | 15 minutes | P1 |
| Redis Cache | 5 minutes | P1 |
| Frontend | 10 minutes | P2 |
| Monitoring | 30 minutes | P2 |

### RPO (Recovery Point Objective)

| Data Type | RPO | Backup Frequency |
|-----------|-----|------------------|
| User Data | 1 hour | Continuous (WAL) |
| Canvas Data | 1 hour | Continuous (WAL) |
| LLM Usage Logs | 24 hours | Daily |
| System Logs | 1 hour | Real-time streaming |
| Configuration | 0 (version controlled) | Git commits |

---

## Emergency Contacts

### On-Call Rotation

```
Primary On-Call: +1-XXX-XXX-XXXX (PagerDuty)
Secondary On-Call: +1-XXX-XXX-XXXX (PagerDuty)
Engineering Manager: +1-XXX-XXX-XXXX
CTO: +1-XXX-XXX-XXXX
```

### External Vendors

```
AWS Support: 1-866-947-7829 (Enterprise Support)
Supabase Support: support@supabase.io (Priority Support)
Together.ai Support: support@together.ai
OpenAI Support: support@openai.com
```

### Escalation Path

```
Level 1: On-Call Engineer (0-15 min)
Level 2: Engineering Manager (15-30 min)
Level 3: CTO + Infrastructure Team (30-60 min)
Level 4: CEO + All Hands (60+ min)
```

---

## Incident Response Procedures

### Step 1: Incident Declaration

```bash
# Create incident in PagerDuty
curl -X POST https://api.pagerduty.com/incidents \
  -H "Authorization: Token token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "incident": {
      "type": "incident",
      "title": "Production Outage: [DESCRIPTION]",
      "service": {
        "id": "SERVICE_ID",
        "type": "service_reference"
      },
      "urgency": "high",
      "body": {
        "type": "incident_body",
        "details": "Detailed description of the incident"
      }
    }
  }'
```

### Step 2: Initial Assessment

```bash
# Check overall system health
curl https://api.valuecanvas.com/health/ready

# Check individual services
kubectl get pods -n production
kubectl get services -n production

# Check database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Check Redis
redis-cli -h $REDIS_HOST ping

# Check LLM services
curl https://api.valuecanvas.com/api/llm/health
```

### Step 3: Communication

```markdown
# Status Page Update Template

**Incident**: [Brief Description]
**Status**: Investigating | Identified | Monitoring | Resolved
**Impact**: [Affected Services]
**Started**: [Timestamp]
**Last Update**: [Timestamp]

**Current Status**:
[Detailed description of current situation]

**Next Update**: [Expected time]
```

### Step 4: Mitigation

Follow the appropriate scenario-specific runbook below.

---

## Scenario-Specific Runbooks

### Scenario 1: Database Failure

**Symptoms**:
- Database connection errors
- Slow query performance
- Data corruption warnings
- Replication lag

**Recovery Procedure**:

#### 1.1 Assess Database Health

```bash
# Check database status
psql $DATABASE_URL -c "SELECT version();"
psql $DATABASE_URL -c "SELECT pg_is_in_recovery();"

# Check replication lag
psql $DATABASE_URL -c "
  SELECT 
    client_addr,
    state,
    sync_state,
    pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS lag_bytes
  FROM pg_stat_replication;
"

# Check for blocking queries
psql $DATABASE_URL -c "
  SELECT 
    pid,
    usename,
    application_name,
    state,
    query,
    wait_event_type,
    wait_event
  FROM pg_stat_activity
  WHERE state != 'idle'
  ORDER BY query_start;
"
```

#### 1.2 Failover to Replica (if primary is down)

```bash
# Promote replica to primary (Supabase)
# Contact Supabase support for managed failover

# For self-hosted PostgreSQL:
pg_ctl promote -D /var/lib/postgresql/data

# Update connection strings
kubectl set env deployment/api-server \
  DATABASE_URL="postgresql://user:pass@new-primary:5432/dbname"

# Restart affected pods
kubectl rollout restart deployment/api-server -n production
```

#### 1.3 Restore from Backup (if data corruption)

```bash
# List available backups
aws s3 ls s3://valuecanvas-backups/backups/ --recursive

# Download latest backup
LATEST_BACKUP=$(aws s3 ls s3://valuecanvas-backups/backups/ | sort | tail -n 1 | awk '{print $4}')
aws s3 cp "s3://valuecanvas-backups/backups/$LATEST_BACKUP" .

# Verify checksum
sha256sum -c "${LATEST_BACKUP}.sha256"

# Stop application (prevent writes during restore)
kubectl scale deployment/api-server --replicas=0 -n production

# Restore database
gunzip -c "$LATEST_BACKUP" | psql $DATABASE_URL

# Verify restore
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM canvases;"

# Restart application
kubectl scale deployment/api-server --replicas=3 -n production
```

**Expected Recovery Time**: 5-15 minutes  
**Data Loss**: Up to 1 hour (RPO)

---

### Scenario 2: LLM Service Outage

**Symptoms**:
- Together.ai API errors
- High latency on LLM requests
- Circuit breaker open
- Fallback to OpenAI activated

**Recovery Procedure**:

#### 2.1 Check LLM Service Status

```bash
# Check circuit breaker status
curl https://api.valuecanvas.com/api/llm/health

# Check Together.ai status
curl https://status.together.ai/api/v2/status.json

# Check OpenAI status
curl https://status.openai.com/api/v2/status.json

# View LLM service logs
kubectl logs -l app=api-server -n production | grep "llm"
```

#### 2.2 Verify Fallback is Working

```bash
# Test LLM endpoint
curl -X POST https://api.valuecanvas.com/api/llm/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Test prompt",
    "model": "meta-llama/Llama-3-70b-chat-hf"
  }'

# Check which provider responded
# Response should include: "provider": "openai" if fallback is active
```

#### 2.3 Reset Circuit Breaker (if Together.ai recovered)

```bash
# Reset circuit breaker
curl -X POST https://api.valuecanvas.com/api/llm/reset \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Monitor for successful requests
kubectl logs -f -l app=api-server -n production | grep "Together.ai call succeeded"
```

#### 2.4 Increase Cache Hit Rate (temporary mitigation)

```bash
# Increase cache TTL to reduce API calls
redis-cli CONFIG SET maxmemory-policy allkeys-lru
redis-cli CONFIG SET maxmemory 4gb

# Monitor cache hit rate
redis-cli INFO stats | grep keyspace_hits
```

**Expected Recovery Time**: 0-15 minutes (automatic fallback)  
**Impact**: Higher costs (OpenAI more expensive), slightly different responses

---

### Scenario 3: Redis Cache Failure

**Symptoms**:
- Redis connection errors
- Increased LLM API costs
- Rate limiting not working
- Slow response times

**Recovery Procedure**:

#### 3.1 Check Redis Health

```bash
# Test Redis connectivity
redis-cli -h $REDIS_HOST ping

# Check Redis memory usage
redis-cli INFO memory

# Check for errors
redis-cli INFO stats | grep rejected_connections
```

#### 3.2 Restart Redis (if unresponsive)

```bash
# For Kubernetes deployment
kubectl rollout restart statefulset/redis -n production

# Wait for Redis to be ready
kubectl wait --for=condition=ready pod -l app=redis -n production --timeout=300s

# Verify Redis is working
redis-cli ping
```

#### 3.3 Restore Redis Data (if data loss)

```bash
# Redis data is ephemeral (cache only)
# No restore needed - cache will rebuild automatically

# Warm up cache with common queries
curl -X POST https://api.valuecanvas.com/api/admin/cache/warmup \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Expected Recovery Time**: 5 minutes  
**Data Loss**: None (cache is ephemeral)

---

### Scenario 4: Kubernetes Cluster Failure

**Symptoms**:
- Pods not starting
- Node failures
- Network issues
- Control plane unavailable

**Recovery Procedure**:

#### 4.1 Check Cluster Health

```bash
# Check node status
kubectl get nodes

# Check pod status
kubectl get pods --all-namespaces

# Check cluster events
kubectl get events --all-namespaces --sort-by='.lastTimestamp'

# Check control plane
kubectl get componentstatuses
```

#### 4.2 Recover Failed Nodes

```bash
# Drain failed node
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data

# Delete node
kubectl delete node <node-name>

# For AWS EKS, terminate instance and let auto-scaling create new one
aws ec2 terminate-instances --instance-ids <instance-id>

# Wait for new node to join
kubectl get nodes -w
```

#### 4.3 Restore Pods

```bash
# Check for pending pods
kubectl get pods --all-namespaces --field-selector=status.phase=Pending

# Force recreate stuck pods
kubectl delete pod <pod-name> -n <namespace> --force --grace-period=0

# Restart deployments
kubectl rollout restart deployment/api-server -n production
kubectl rollout restart deployment/frontend -n production
```

**Expected Recovery Time**: 10-20 minutes  
**Impact**: Temporary service unavailability

---

### Scenario 5: Complete System Outage

**Symptoms**:
- All services down
- No response from any endpoint
- Infrastructure completely unavailable

**Recovery Procedure**:

#### 5.1 Assess Scope

```bash
# Check AWS status
curl https://status.aws.amazon.com/

# Check DNS
dig api.valuecanvas.com
dig valuecanvas.com

# Check from external location
curl -I https://valuecanvas.com
```

#### 5.2 Activate Disaster Recovery Site (if available)

```bash
# Update DNS to point to DR site
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch file://dns-failover.json

# dns-failover.json:
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "api.valuecanvas.com",
      "Type": "A",
      "TTL": 60,
      "ResourceRecords": [{"Value": "DR_SITE_IP"}]
    }
  }]
}
```

#### 5.3 Rebuild from Infrastructure as Code

```bash
# Clone infrastructure repository
git clone https://github.com/valuecanvas/infrastructure.git
cd infrastructure/terraform

# Initialize Terraform
terraform init

# Review plan
terraform plan

# Apply infrastructure
terraform apply -auto-approve

# Deploy application
kubectl apply -f k8s/production/

# Restore database
./scripts/restore-database.sh $LATEST_BACKUP

# Verify services
curl https://api.valuecanvas.com/health/ready
```

**Expected Recovery Time**: 30-60 minutes  
**Data Loss**: Up to 1 hour (RPO)

---

### Scenario 6: Security Incident

**Symptoms**:
- Unauthorized access detected
- Data breach suspected
- Malicious activity in logs
- Compromised credentials

**Recovery Procedure**:

#### 6.1 Immediate Containment

```bash
# Rotate all secrets immediately
aws secretsmanager rotate-secret --secret-id valuecanvas/production/secrets

# Revoke all active sessions
psql $DATABASE_URL -c "DELETE FROM auth.sessions WHERE created_at < NOW();"

# Block suspicious IPs
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: block-suspicious-ips
spec:
  podSelector:
    matchLabels:
      app: api-server
  policyTypes:
  - Ingress
  ingress:
  - from:
    - ipBlock:
        cidr: 0.0.0.0/0
        except:
        - SUSPICIOUS_IP/32
EOF

# Enable audit logging
kubectl patch deployment api-server -n production \
  --type='json' \
  -p='[{"op": "add", "path": "/spec/template/spec/containers/0/env/-", "value": {"name": "AUDIT_LOG_LEVEL", "value": "debug"}}]'
```

#### 6.2 Investigation

```bash
# Export logs for forensic analysis
kubectl logs -l app=api-server -n production --since=24h > incident-logs.txt

# Check for unauthorized database access
psql $DATABASE_URL -c "
  SELECT 
    usename,
    application_name,
    client_addr,
    query,
    query_start
  FROM pg_stat_activity
  WHERE usename NOT IN ('postgres', 'supabase_admin')
  ORDER BY query_start DESC;
"

# Check for data exfiltration
aws s3api list-objects-v2 \
  --bucket valuecanvas-backups \
  --query 'Contents[?LastModified>`2024-01-01`]'
```

#### 6.3 Notification

```bash
# Notify affected users (if data breach)
# Send via email service

# Report to authorities (if required)
# GDPR: Within 72 hours
# CCPA: Without unreasonable delay
```

**Expected Recovery Time**: Varies (hours to days)  
**Impact**: Potential data breach, regulatory requirements

---

## Post-Incident Procedures

### 1. Incident Report

Create detailed incident report within 24 hours:

```markdown
# Incident Report: [TITLE]

**Date**: [Date]
**Duration**: [Start] - [End]
**Severity**: P0 | P1 | P2 | P3
**Impact**: [Description]

## Timeline

- [HH:MM] - Incident detected
- [HH:MM] - Team notified
- [HH:MM] - Root cause identified
- [HH:MM] - Mitigation applied
- [HH:MM] - Service restored
- [HH:MM] - Incident closed

## Root Cause

[Detailed analysis of what caused the incident]

## Resolution

[Steps taken to resolve the incident]

## Impact

- Users affected: [Number]
- Downtime: [Duration]
- Data loss: [Amount]
- Financial impact: [Cost]

## Action Items

1. [ ] [Action item 1] - Owner: [Name] - Due: [Date]
2. [ ] [Action item 2] - Owner: [Name] - Due: [Date]

## Lessons Learned

[What we learned and how to prevent similar incidents]
```

### 2. Post-Mortem Meeting

Schedule within 48 hours:
- Review timeline
- Identify root cause
- Discuss what went well
- Identify improvements
- Assign action items

### 3. Update Runbook

Document any new procedures or improvements discovered during incident response.

---

## Testing and Validation

### Quarterly DR Tests

**Schedule**: First Monday of each quarter

#### Test 1: Database Restore

```bash
# Create test database
createdb valuecanvas_dr_test

# Restore latest backup
./scripts/restore-database.sh $LATEST_BACKUP valuecanvas_dr_test

# Verify data integrity
psql valuecanvas_dr_test -c "SELECT COUNT(*) FROM users;"

# Cleanup
dropdb valuecanvas_dr_test
```

#### Test 2: LLM Fallback

```bash
# Temporarily block Together.ai
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: block-together-ai
spec:
  podSelector:
    matchLabels:
      app: api-server
  policyTypes:
  - Egress
  egress:
  - to:
    - ipBlock:
        cidr: 0.0.0.0/0
        except:
        - 34.XXX.XXX.XXX/32  # Together.ai IP
EOF

# Test LLM endpoint
curl -X POST https://api.valuecanvas.com/api/llm/chat \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"prompt": "Test", "model": "meta-llama/Llama-3-70b-chat-hf"}'

# Verify OpenAI fallback
# Response should show: "provider": "openai"

# Remove network policy
kubectl delete networkpolicy block-together-ai
```

#### Test 3: Complete Failover

```bash
# Scale down production (in staging environment)
kubectl scale deployment --all --replicas=0 -n staging

# Restore from backups
./scripts/restore-database.sh $LATEST_BACKUP

# Scale up
kubectl scale deployment --all --replicas=3 -n staging

# Verify all services
curl https://staging.valuecanvas.com/health/ready
```

### Test Results Documentation

```markdown
# DR Test Results: [Date]

**Test Type**: [Database Restore | LLM Fallback | Complete Failover]
**Status**: ✅ Pass | ❌ Fail
**Duration**: [Actual] vs [Target]
**Issues Found**: [List]
**Action Items**: [List]
```

---

## Appendix

### A. Backup Locations

```
Database Backups: s3://valuecanvas-backups/backups/
Configuration: GitHub (infrastructure repo)
Secrets: AWS Secrets Manager
Logs: CloudWatch Logs (90-day retention)
```

### B. Monitoring Dashboards

```
System Health: https://grafana.valuecanvas.com/d/system-health
LLM Metrics: https://grafana.valuecanvas.com/d/llm-metrics
Cost Tracking: https://grafana.valuecanvas.com/d/cost-tracking
```

### C. Useful Commands

```bash
# Quick health check
curl https://api.valuecanvas.com/health/ready | jq

# View recent errors
kubectl logs -l app=api-server -n production --since=1h | grep ERROR

# Check resource usage
kubectl top nodes
kubectl top pods -n production

# Force pod restart
kubectl delete pod -l app=api-server -n production

# View circuit breaker status
curl https://api.valuecanvas.com/api/llm/stats | jq
```

### D. Runbook Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2024-11-23 | Initial version | Platform Team |

---

**Document Owner**: Platform Engineering Team  
**Review Date**: 2025-02-23  
**Classification**: Internal Use Only
