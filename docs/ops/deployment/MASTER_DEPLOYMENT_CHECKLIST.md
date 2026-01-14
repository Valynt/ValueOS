# Master Deployment Checklist: Staging → Production

**Last Updated:** 2025-12-28  
**Status:** Production Ready  
**Version:** 1.0.0

---

## Quick Commands

| Action           | Command                              |
| ---------------- | ------------------------------------ |
| Pre-Flight Check | `npm run deploy:pre-check`           |
| Deploy           | `bash scripts/deploy-production.sh`  |
| Validate         | `npm run deploy:validate`            |
| Rollback         | `bash scripts/rollback-migration.sh` |

---

## Phase 1: Preparation (In Dev/Staging)

> **Goal:** Ensure the build is stable, secure, and matches what you intend to ship.

### 1.1 Code & Asset Integrity

| Check                   | Command/Action                                 | Sign-off |
| ----------------------- | ---------------------------------------------- | -------- |
| ☐ **Code Freeze**       | Stop merging new features to the deploy branch |          |
| ☐ **Dependency Check**  | `npm ci` (locked deps)                         |          |
| ☐ **Lock File Sync**    | Verify `package-lock.json` matches production  |          |
| ☐ **Asset Compilation** | `npm run build` (no errors)                    |          |

### 1.2 Testing (Quality Gates)

| Check                     | Command                        | Success Criteria          | Sign-off |
| ------------------------- | ------------------------------ | ------------------------- | -------- |
| ☐ **Unit Tests**          | `npm run test:unit`            | 100% pass                 |          |
| ☐ **Integration Tests**   | `npm run test:integration`     | 100% pass                 |          |
| ☐ **RLS Tests**           | `npm run test:rls`             | All policies enforced     |          |
| ☐ **UAT Sign-off**        | Product owner manual verify    | Approved                  |          |
| ☐ **Smoke Test Staging**  | Manual critical paths test     | Login/Dashboard/Save work |          |
| ☐ **Data Migration Test** | Test migration on staging copy | No data loss              |          |

### 1.3 Security & Performance

| Check                  | Command                        | Success Criteria       | Sign-off |
| ---------------------- | ------------------------------ | ---------------------- | -------- |
| ☐ **Scan for Secrets** | `npm run security:scan`        | No exposed secrets     |          |
| ☐ **Dependency Audit** | `npm audit --audit-level=high` | No high/critical vulns |          |
| ☐ **Snyk Scan**        | `npm run security:scan:snyk`   | Clean report           |          |
| ☐ **Console Cleanup**  | `npm run lint:console`         | No console.log         |          |
| ☐ **Load Test**        | `npm run test:load`            | Meets benchmarks       |          |

**All P1 items must pass before proceeding to Phase 2.**

---

## Phase 2: Transition (Staging → Production)

> **Goal:** Move the artifact to production with zero or minimal downtime.

### 2.1 Pre-Flight Safety Checks

| Check                    | Command/Action                            | Sign-off |
| ------------------------ | ----------------------------------------- | -------- |
| ☐ **🔴 DATABASE BACKUP** | `npm run db:backup`                       |          |
| ☐ **Verify Backup**      | `bash scripts/verify-backup.sh`           |          |
| ☐ **Notify Team**        | Post to #deployments channel              |          |
| ☐ **Notify Users**       | (If downtime expected) Status page update |          |
| ☐ **Check 3rd Parties**  | Verify AWS/Supabase/Stripe status pages   |          |

### 2.2 Deployment Execution

| Step                     | Command                                       | Notes |
| ------------------------ | --------------------------------------------- | ----- |
| ☐ **Enable Maintenance** | (If required) Put up maintenance page         |       |
| ☐ **Deploy Artifacts**   | `bash scripts/deploy-production.sh`           |       |
| ☐ **Run Migrations**     | `supabase db push` or migration script        |       |
| ☐ **Clear Caches**       | Redis: `redis-cli FLUSHDB` / CDN invalidation |       |
| ☐ **Restart Services**   | `docker-compose restart` or k8s rollout       |       |

---

## Phase 3: Post-Deployment (Verification)

> **Goal:** Confirm the system is healthy and users are happy.

### 3.1 Immediate Verification (0-30 min)

| Check                     | Command/Action                           | Success Criteria       |
| ------------------------- | ---------------------------------------- | ---------------------- |
| ☐ **Smoke Test Prod**     | Manual: Login, Dashboard, critical flows | All working            |
| ☐ **Health Endpoint**     | `curl https://yourdomain.com/health`     | `{"status":"healthy"}` |
| ☐ **Monitor Logs**        | Check for 500 errors, exceptions         | None                   |
| ☐ **Check Metrics**       | Grafana: CPU, memory, latency            | Normal ranges          |
| ☐ **Validate Deployment** | `npm run deploy:validate`                | All checks pass        |

### 3.2 Cleanup & Review

| Check                     | Action                      | Sign-off |
| ------------------------- | --------------------------- | -------- |
| ☐ **Disable Maintenance** | Remove maintenance page     |          |
| ☐ **Monitor Support**     | Watch for user tickets      |          |
| ☐ **Close Feature Flags** | Document for next sprint    |          |
| ☐ **Post-Mortem**         | (If issues) Schedule review |          |

---

## ⚠️ "Oh No" Rollback Plan

> **CRITICAL:** Have these ready BEFORE you push.

### Immediate Rollback Commands

```bash
# 1. Application Rollback
kubectl rollout undo deployment/app -n production
# OR Docker:
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --no-deps app

# 2. Git Revert (if needed)
git revert HEAD --no-edit
git push origin main

# 3. Database Rollback
bash scripts/rollback-migration.sh <MIGRATION_ID>
```

### Rollback Decision Matrix

| Symptom                    | Action                                |
| -------------------------- | ------------------------------------- |
| 500 errors > 5%            | Rollback immediately                  |
| Performance degraded > 50% | Rollback + investigate                |
| Data corruption detected   | **STOP ALL TRAFFIC** + Restore backup |
| Single feature broken      | Feature flag off (if available)       |

### Emergency Contacts

| Role                 | Contact      | Access           |
| -------------------- | ------------ | ---------------- |
| **On-Call Engineer** | @oncall      | Application + DB |
| **DevOps Lead**      | @devops-lead | Infrastructure   |
| **DBA**              | @dba-team    | Database restore |
| **CTO**              | @cto         | Escalation       |

---

## Monitoring First 24 Hours

### Metrics to Watch

| Metric               | Normal Range | Alert Threshold |
| -------------------- | ------------ | --------------- |
| Error Rate           | < 0.1%       | > 1%            |
| Response Time (p95)  | < 200ms      | > 500ms         |
| Database Connections | < 80% pool   | > 90%           |
| Memory Usage         | < 70%        | > 85%           |
| CPU Usage            | < 60%        | > 80%           |

### Alert Channels

- **Slack:** #alerts-production
- **PagerDuty:** Production-Critical
- **Email:** devops@company.com

---

## Related Documentation

- [Pre-Production Checklist](./PRE_PRODUCTION_CHECKLIST.md) - Detailed security config
- [Production Runbook](./PRODUCTION_RUNBOOK.md) - Operations procedures
- [Go-Live Workflow](./GO_LIVE_WORKFLOW.md) - Full launch workflow
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md) - Phase-specific checklists

---

## Changelog

| Date       | Version | Change                         |
| ---------- | ------- | ------------------------------ |
| 2025-12-28 | 1.0.0   | Initial consolidated checklist |

---

**Maintained By:** DevOps Team  
**Next Review:** Monthly or after major incidents
