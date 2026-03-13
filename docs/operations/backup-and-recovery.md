---
title: Backup and Recovery
owner: team-platform
review_date: 2027-01-01
status: active
---

# Backup and Recovery

**RTO:** ≤ 4 hours  
**RPO:** ≤ 1 hour

---

## Backup Schedule

| Layer | Method | Frequency | Retention |
|---|---|---|---|
| Supabase Postgres (production) | Supabase managed PITR | Continuous WAL streaming | 7 days PITR + 30-day daily snapshots |
| Supabase Postgres (staging) | Supabase managed snapshots | Daily | 7 days |
| Redis | RDB snapshot (`save 900 1`) | Every 15 minutes | 48 hours on persistent volume |
| Application secrets | Vault / environment secrets manager | On change | Indefinite (versioned) |

## Point-in-Time Recovery (PITR)

Supabase Pro and Enterprise plans provide continuous WAL archiving. Recovery to any second within the retention window is available via the Supabase dashboard or API.

**PITR window:** 7 days (production).

To initiate a PITR restore:

1. Open the Supabase dashboard → **Database** → **Backups**.
2. Select **Point in Time Recovery**.
3. Choose the target timestamp (UTC).
4. Confirm — Supabase provisions a new database instance from the WAL archive.
5. Update `DATABASE_URL` in the environment secrets to point to the restored instance.
6. Run `pnpm run db:migrate` to verify schema is current.
7. Smoke-test with `pnpm run test:rls`.

## Restore Procedure

### Full restore from daily snapshot

1. In the Supabase dashboard, select the snapshot to restore.
2. Restore to a new project (do not overwrite production until verified).
3. Run the migration suite against the restored project: `pnpm run db:migrate`.
4. Validate RLS policies: `pnpm run test:rls`.
5. Promote the restored project by updating `DATABASE_URL` and `SUPABASE_URL`.
6. Restart backend pods: `kubectl rollout restart deployment/api -n valynt`.

### Redis recovery

Redis data is ephemeral cache and BullMQ queue state. On failure:

1. Start a fresh Redis instance.
2. BullMQ jobs that were in-flight at failure time will not auto-recover — check the dead-letter queue via `GET /api/admin/dlq` and retry as needed.
3. RBAC permission cache will rebuild on first request (cold-start latency expected for up to `RBAC_CACHE_TTL_SECONDS`).

## Verification

After any restore, run the following before promoting to production:

```bash
pnpm run test:rls          # Tenant isolation
pnpm run db:migrate        # Schema current
pnpm test -- --run         # Unit + integration suite
```

## Contacts

- Primary: platform on-call (PagerDuty: `valueos-primary`)
- Escalation: `#incident-response` Slack channel
- Supabase support: dashboard → **Support** (Pro/Enterprise SLA applies)
