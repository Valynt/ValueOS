---
description: Production deployment checklist and workflow
---

# Production Deployment Workflow

> ⚠️ **CRITICAL**: Follow the [Master Deployment Checklist](file:///workspaces/ValueOS/docs/deployment/MASTER_DEPLOYMENT_CHECKLIST.md) for full details.

## Quick Reference

### Phase 1: Pre-Flight (Staging)

// turbo

1. Run pre-deployment checklist:

```bash
bash scripts/pre-deployment-checklist.sh
```

2. Run all tests:

```bash
pnpm test
```

// turbo 3. Build and validate:

```bash
pnpm run build
```

// turbo 4. Security scan:

```bash
bash scripts/compliance-scan.sh
```

### Phase 2: Transition

5. **🔴 CRITICAL** Create database backup:

```bash
bash scripts/backup-database.sh
```

6. Verify backup:

```bash
bash scripts/verify-backup.sh
```

7. Notify team (Slack #deployments)

8. Deploy to production:

```bash
bash scripts/deploy-production.sh
```

### Phase 3: Post-Deployment

// turbo 9. Verify deployment health:

```bash
bash scripts/validate-deployment.sh
```

10. Run production smoke tests (manual)

11. Monitor logs and metrics for 30 min

## Rollback (if issues detected)

```bash
# Application rollback
kubectl rollout undo deployment/app -n production
# OR: docker-compose down && docker-compose up -d

# Database rollback
bash scripts/rollback-migration.sh <MIGRATION_ID>
```

## Full Checklist

See: [MASTER_DEPLOYMENT_CHECKLIST.md](docs/deployment/MASTER_DEPLOYMENT_CHECKLIST.md)
