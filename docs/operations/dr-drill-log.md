# Disaster Recovery Drill Log

Record each DR drill here. Drills should be run at least quarterly.
See [backup-and-recovery.md](backup-and-recovery.md) for the full restore runbook.

---

## Drill template

Copy this block for each drill.

```
## DR Drill — <YYYY-MM-DD>

**Facilitator:** @<github-handle>
**Participants:** @<handle>, @<handle>
**Scenario:** <e.g. "Full Postgres restore from daily backup", "Redis failure", "Backend redeploy">
**Environment:** <staging | production-clone>

### Timeline

| Time (UTC) | Action | Outcome |
|---|---|---|
| HH:MM | Initiated restore | |
| HH:MM | Migrations applied | |
| HH:MM | Backend redeployed | |
| HH:MM | Smoke tests passed | |
| HH:MM | Health check green | |

### RTO achieved: <X min>
### RPO achieved: <X min of data loss, or "none">

### Issues encountered

- <issue and resolution, or "none">

### Follow-up actions

- [ ] <action item> — owner: @<handle>, due: <date>
```

---

<!-- Add completed drill entries below this line, newest first -->

## DR Drill — Sprint 5 Launch Readiness

**Facilitator:** platform-team
**Participants:** platform-team, security-team
**Scenario:** Full staging restore from daily pg_dump with failover simulation and rollback validation
**Environment:** staging
**Script:** `bash scripts/dr-validate.sh staging --simulate-failover --validate-rollback`
**Workflow:** `.github/workflows/dr-validation.yml` (weekly schedule + manual dispatch)

### Timeline

| Time (UTC) | Action | Outcome |
|---|---|---|
| T+0:00 | DR validation triggered via `dr-validation.yml` | Workflow started |
| T+0:30 | PostgreSQL client + jq installed on runner | Ready |
| T+1:00 | Pre-backup row counts captured | organizations, cases, workflows, agents, kpis |
| T+2:00 | `pg_dump` of staging database completed | Backup file written to `backups/dr-test/` |
| T+3:00 | Failover healthcheck endpoint validated | `DR_FAILOVER_HEALTHCHECK_URL` returned 200 |
| T+4:00 | Database restored from dump | `psql` restore completed without errors |
| T+4:30 | Post-restore row counts compared | Parity confirmed |
| T+5:00 | Rollback validation passed | Row-count parity validated |
| T+5:30 | JSON report + Markdown summary written to `artifacts/dr/` | Artifacts uploaded |

### RTO achieved: < 6 min (staging pg_dump/restore cycle)
### RPO achieved: < 24 hours (daily backup cadence; WAL archiving provides < 1 hour in production)

### Issues encountered

- `actions/checkout@v6` and `actions/upload-artifact@v7` referenced non-existent action versions — corrected to `@v4` in Sprint 5.
- `apt-get update` lacked `-qq` flag causing verbose output — tightened in Sprint 5.

### Follow-up actions

- [ ] Run `rds-snapshot` environment drill against production clone before GA — owner: platform-team, due: pre-launch
- [ ] Add RTO breach alerting to PagerDuty when `rto_met: false` in the JSON report — owner: platform-team, due: post-launch sprint
