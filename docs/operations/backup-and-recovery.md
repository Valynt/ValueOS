# Backup and Recovery

## Database (Supabase / Postgres)

### Automated backups

Supabase Pro and above provides daily automated backups with a 7-day retention window. Point-in-time recovery (PITR) is available on Enterprise plans with a configurable retention period (default: 7 days).

Verify backup status: Supabase Dashboard → Project → Database → Backups.

### Manual backup

```bash
# Dump all tenant data (run from a machine with network access to the DB)
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="valueos-$(date +%Y%m%d-%H%M%S).dump"
```

Store dumps in an off-site location (e.g. S3 bucket with versioning enabled).

### Restore from dump

```bash
pg_restore \
  --dbname="$DATABASE_URL" \
  --no-owner \
  --no-acl \
  --verbose \
  valueos-<timestamp>.dump
```

### Point-in-time recovery (PITR)

1. Supabase Dashboard → Project → Database → Backups → Point in Time Recovery.
2. Select the target timestamp.
3. Supabase restores to a new project; update `DATABASE_URL` / `SUPABASE_URL` in the deployment environment.
4. Validate with the smoke test suite: `pnpm run test:rls`.

---

## Redis

Redis is used for rate limiting, BullMQ queues, and RBAC invalidation pub/sub. It is **not** the system of record — all durable state lives in Postgres.

Recovery: restart Redis and allow the application to repopulate caches from Postgres on demand. BullMQ jobs that were in-flight at the time of failure will be re-queued on worker restart (jobs are persisted in Redis; if Redis data is lost, in-flight jobs are lost and must be re-triggered manually).

---

## Application state

All durable application state is in Postgres. The backend and frontend are stateless — recovery is a redeploy.

```bash
# Redeploy backend
docker compose -f ops/compose/compose.yml up -d --force-recreate backend

# Redeploy frontend
docker compose -f ops/compose/compose.yml up -d --force-recreate frontend
```

---

## Recovery time objectives

| Component | RTO | RPO | Notes |
|---|---|---|---|
| Postgres (Supabase) | < 30 min | < 24 h (daily backup) / < 5 min (PITR) | PITR requires Enterprise plan |
| Redis | < 5 min | N/A (non-durable) | In-flight jobs may be lost |
| Backend | < 5 min | N/A (stateless) | Redeploy from image |
| Frontend | < 5 min | N/A (stateless) | Redeploy from image |

---

## Runbook: full environment restore

1. Provision a new Supabase project (or restore PITR on existing).
2. Run migrations: `pnpm run db:migrate`.
3. Update secrets in the deployment environment (`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.).
4. Restart Redis.
5. Redeploy backend and frontend via Docker Compose or Kubernetes.
6. Run smoke tests: `pnpm run test:rls && bash scripts/test-agent-security.sh`.
7. Verify health endpoint: `curl https://<host>/health`.
8. Log the recovery in `docs/operations/dr-drill-log.md`.
