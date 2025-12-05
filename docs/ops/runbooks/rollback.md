# Rollback Runbook

**Audience:** Release Captain (primary), On-Call SRE (executor), Database Owner (consulted).
**Goal:** Rapidly revert a bad deploy, including database rollback and backup restoration steps.

## Triggers
- P1 incident where error rate, latency, or auth failures exceed SLOs.
- Security exposure or data corruption suspected.
- Failed smoke tests immediately after deployment.

## Immediate Actions
1. Announce rollback in `#incidents` and `#releases` with issue link and version.
2. Pause ongoing deployments: disable auto-merge and cancel running workflows if necessary.
3. Capture timestamps for the first bad request and current backlog depth.

## Rollback Steps (Application)
1. **Select last known-good release**
   - Identify previous tag (e.g., `v<previous>`).
2. **Revert container image**
   ```bash
   # Update deployment to prior tag
   kubectl set image deploy/api api=ghcr.io/valuecanvas/app:v<previous>
   kubectl set image deploy/web web=ghcr.io/valuecanvas/web:v<previous>
   kubectl set image deploy/worker worker=ghcr.io/valuecanvas/worker:v<previous>
   kubectl rollout status deploy/api --timeout=5m
   kubectl rollout status deploy/web --timeout=5m
   kubectl rollout status deploy/worker --timeout=5m
   ```
3. **Verify traffic cutover**
   - Check that new pods are serving and error rates drop in Grafana `00-Prod Overview`.

## Database Rollback
1. **Determine migration scope**
   - Fetch the last applied migration:
     ```sql
     select version from schema_migrations order by inserted_at desc limit 1;
     ```
2. **Revert latest migration (if reversible)**
   ```bash
   supabase db rollback --to <previous_version>
   ```
   - If migration is not reversible, plan a forward-fix instead of destructive rollback.
3. **Restore from backup (critical only)**
   - Confirm backup location and timestamp (S3/Supabase storage).
   - Restore database into a new instance to validate:
     ```bash
     PGPASSWORD=$DB_PASSWORD pg_restore \
       --clean --no-owner --dbname=$DATABASE_URL \
       /backups/prod-<timestamp>.dump
     ```
   - Swap connection strings or promote the restored instance after verification.

## Post-Rollback Validation
- Run smoke tests: `npm run test:smoke -- --env production`
- Confirm queue health: `redis-cli -u "$REDIS_URL" LLEN agent:pending`
- Validate RLS/auth flows using `docs/ops/troubleshooting/rls-failures.md`.
- Update incident with time-to-detect and time-to-recover.

## SLAs
- **P1:** rollback decision within 10 minutes of detection; service restored in ≤30 minutes.
- **P2:** rollback or forward-fix within 2 hours.

## References
- Deployment pipeline: https://github.com/ValueCanvas/ValueCanvas/actions/workflows/deploy.yml
- Supabase backups: https://app.supabase.com/project/_/database/backups
- AWS container images: https://console.aws.amazon.com/ecr/repositories
