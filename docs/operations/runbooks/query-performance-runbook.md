---
title: Query Performance Runbook
owner: team-operations
review_date: 2026-06-30
status: active
---

# Query Performance Runbook

## Purpose

Operational steps for:

1. Extracting top query fingerprints by `total_exec_time`, `mean_exec_time`, and `calls`.
2. Alerting on fingerprint regressions tied to SLO dashboards.
3. Enforcing CI performance budgets for key fingerprints.
4. Capturing and reviewing tenant-critical `EXPLAIN (ANALYZE, BUFFERS)` baselines.
5. Maintaining index health and bloat remediation cadence.

## Scheduled extraction job

### Kubernetes CronJob

- Manifest: `infra/k8s/cronjobs/query-fingerprint-extract.yaml`
- Schedule: hourly at minute 15 (`15 * * * *`)
- Data source: `pg_stat_statements`
- Query definition: `infra/observability/sql/top-query-fingerprints.sql`

### Manual runbook step

```bash
DATABASE_URL=postgres://... scripts/ops/extract-top-query-fingerprints.sh
```

Outputs a timestamped CSV artifact to `artifacts/perf/`.

## Regression alerts + SLO dashboards

Alert rules are defined in `infra/k8s/observability/prometheus/alert-rules.yaml` under group `query-performance`:

- `QueryFingerprintP95Regression`
- `QueryFingerprintTotalExecTimeRegression`
- `QueryFingerprintCallVolumeSpike`

Each rule includes `slo_dashboard` metadata pointing to the corresponding Grafana dashboard for triage.

## CI performance gate

- Script: `scripts/ci/check-query-fingerprint-budgets.mjs`
- Inputs:
  - Budgets: `infra/observability/query-fingerprint-budgets.json`
  - Latest snapshot: `infra/observability/query-fingerprint-latest.json`
- CI workflow hook: `.github/workflows/pr-fast.yml` and `.github/workflows/main-verify.yml` (`Query fingerprint perf budget gate` step)

Failure criteria:

- Any fingerprint exceeds `max_mean_exec_time_ms`, `max_total_exec_time_ms`, or `max_calls`.
- Any required fingerprint is missing from snapshot input.

## Tenant-critical EXPLAIN snapshots

Use SQL template at `infra/observability/sql/tenant_critical_explain_snapshots.sql` with representative tenant IDs.

Record and review baselines in:

- `docs/operations/query-plan-baselines.md`

Cadence:

- Weekly during active feature development.
- Mandatory before/after schema migrations touching tenant-critical tables.

## Index maintenance playbook

Index strategy source of truth: `infra/optimized_indexing_manifest.md`.

Cadence:

- **Daily**: monitor bloat, dead tuples, and index scan effectiveness.
- **Weekly**: run non-blocking maintenance (`VACUUM (ANALYZE)` hot tables).
- **Monthly**: schedule `REINDEX CONCURRENTLY` for indexes with sustained bloat above threshold.

Bloat checks (example):

```sql
SELECT
  schemaname,
  relname,
  n_live_tup,
  n_dead_tup,
  ROUND((n_dead_tup::numeric / NULLIF(n_live_tup + n_dead_tup, 0)) * 100, 2) AS dead_tuple_pct
FROM pg_stat_user_tables
ORDER BY dead_tuple_pct DESC
LIMIT 25;
```

Escalate if:

- Dead tuple percentage > 20% for tenant-critical tables.
- Mean query latency regresses > 25% against baseline after vacuum/reindex.
