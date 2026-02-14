---
title: Disaster Recovery Runbook
owner: team-operations
escalation_path: "pagerduty://valueos-primary -> slack:#incident-response -> email:platform-leadership@valueos.com"
review_date: 2026-05-31
status: active
---

# Disaster Recovery Runbook

**Last Updated**: 2026-02-12

## Recovery Objectives

| Metric | Target | Measurement |
|--------|--------|-------------|
| **RTO** (Recovery Time Objective) | < 30 minutes | Time from incident declaration to service restoration |
| **RPO** (Recovery Point Objective) | < 1 hour | Maximum data loss window (continuous WAL archiving) |
| **MTTR** (Mean Time to Recovery) | < 45 minutes | Average across quarterly DR tests |

## Backup Strategy

### Database (PostgreSQL / Supabase)

| Backup Type | Frequency | Retention | Storage |
|-------------|-----------|-----------|---------|
| WAL archiving | Continuous | 7 days | S3 `valynt-wal-archive/` |
| Logical dump (`pg_dump`) | Daily 02:00 UTC | 30 days | S3 `valynt-backups/daily/` |
| Weekly snapshot | Sunday 03:00 UTC | 90 days | S3 `valynt-backups/weekly/` |

### Redis

Redis is used for caching, idempotency keys, and the DLQ. It is **not** the source of truth — all durable state lives in PostgreSQL. On recovery, Redis starts empty and repopulates from application traffic.

### Secrets (External Secrets Operator)

Secrets are stored in AWS Secrets Manager (staging) and HashiCorp Vault (production). The External Secrets Operator syncs them into K8s. On cluster recreation, re-apply the `ClusterSecretStore` and `ExternalSecret` manifests.

## Incident Playbook

### Severity Levels

| Level | Definition | Response Time | Escalation |
|-------|-----------|---------------|------------|
| **SEV-1** | Full service outage, data loss risk | Immediate | On-call + engineering lead + CTO |
| **SEV-2** | Partial outage, degraded performance | < 15 min | On-call + engineering lead |
| **SEV-3** | Non-critical component failure | < 1 hour | On-call |

### SEV-1: Full Database Failure

1. **Declare incident** in `#incidents` Slack channel
2. **Assess scope**: `kubectl get pods -n valynt` — check if DB pod is running
3. **Check WAL status**: Verify last WAL segment archived to S3
4. **Restore from latest backup**:
   ```bash
   # Download latest daily backup
   aws s3 cp s3://valynt-backups/daily/latest.sql.gz ./restore.sql.gz
   gunzip restore.sql.gz

   # Restore to new instance
   psql "$NEW_DATABASE_URL" < restore.sql

   # Apply WAL replay if available
   # (Handled by PostgreSQL point-in-time recovery configuration)
   ```
5. **Update connection strings**: Rotate `DATABASE_URL` in Vault/Secrets Manager
6. **Verify**: Run `bash scripts/dr-validate.sh staging` to confirm data integrity
7. **Notify stakeholders**: Post in `#incidents` with RTO achieved and data loss window

### SEV-1: Kubernetes Cluster Loss

1. **Provision new cluster** via Terraform:
   ```bash
   cd infra/terraform
   terraform apply -var="environment=production"
   ```
2. **Apply base manifests**:
   ```bash
   kubectl apply -k infra/k8s/overlays/production
   ```
3. **Restore secrets**: External Secrets Operator will sync from Vault automatically
4. **Restore database**: Follow database failure procedure above
5. **Verify**: Check all pods running, run health checks

### SEV-2: Redis Failure

1. Redis is ephemeral — restart the StatefulSet:
   ```bash
   kubectl rollout restart statefulset/redis-broker -n valynt
   ```
2. Idempotency cache and DLQ will be empty. In-flight agent tasks may re-execute (idempotent by design).
3. Monitor DLQ for duplicate entries after recovery.

### SEV-2: Agent Fabric Degradation

1. Check circuit breaker state: `GET /api/agents/health`
2. If LLM provider is down, the circuit breaker will open automatically
3. Agents fall back to cached/fallback responses
4. Monitor `dlq:agent_tasks` Redis list for accumulating failures
5. Once provider recovers, circuit breaker resets after the configured timeout (60s)

### SEV-3: Single Pod Crash

1. Kubernetes handles this automatically via restart policy
2. Check logs: `kubectl logs <pod> -n valynt --previous`
3. If crash-looping, check resource limits and OOM kills

## DR Validation Schedule

Run `bash scripts/dr-validate.sh` quarterly at minimum:

| Quarter | Environment | Scope | Owner |
|---------|-------------|-------|-------|
| Q1 | staging | Full backup-restore + row count validation | On-call engineer |
| Q2 | staging | Full backup-restore + application smoke test | On-call engineer |
| Q3 | staging | Full backup-restore + WAL replay test | Platform team |
| Q4 | staging | Full backup-restore + cluster recreation | Platform team |

After each test, update `dr-validation-report.json` and record RTO in the quarterly review.

## Recovery SLA

| Component | RTO | RPO | Dependencies |
|-----------|-----|-----|-------------|
| Frontend | 5 min | N/A (stateless) | CDN, K8s |
| Backend API | 10 min | N/A (stateless) | K8s, DB |
| Database | 30 min | 1 hour | S3 backups, WAL archive |
| Redis | 2 min | N/A (ephemeral) | K8s |
| Agent Fabric | 10 min | N/A (stateless) | K8s, LLM providers |
| Secrets | 5 min | N/A (external store) | Vault/AWS SM |

## Post-Incident

After every SEV-1 or SEV-2 incident:

1. Write a blameless post-mortem within 48 hours
2. Record actual RTO and RPO achieved
3. File action items as GitHub issues with `incident-followup` label
4. Update this runbook if procedures changed
