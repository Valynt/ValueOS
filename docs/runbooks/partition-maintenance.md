---
title: Partition Maintenance Runbook
owner: team-platform
system: valueos-platform
ops_labels: database,partitions,maintenance
---

# Partition Maintenance Runbook

## Purpose

Ensure monthly partitions remain pre-created for high-volume tables by validating the `pg_cron` scheduler and confirming successful execution of `public.create_next_monthly_partitions()`.

## Prerequisites

- Access to the Supabase SQL editor (or `psql`) for the target environment.
- `public.create_next_monthly_partitions()` already deployed.
- `pg_cron` extension available in the environment.

## Scheduler Verification

### 1) Confirm the monthly scheduler exists and is active

```sql
SELECT
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job
WHERE jobname = 'partition-monthly';
```

Expected:
- Exactly one row.
- `schedule = '0 0 1 * *'`.
- `command = 'SELECT public.create_next_monthly_partitions();'`.
- `active = true`.

### 2) Confirm the job has executed recently (last-run validation)

```sql
SELECT
  j.jobid,
  j.jobname,
  d.status,
  d.start_time,
  d.end_time,
  d.return_message
FROM cron.job j
LEFT JOIN LATERAL (
  SELECT *
  FROM cron.job_run_details d
  WHERE d.jobid = j.jobid
  ORDER BY d.start_time DESC
  LIMIT 1
) d ON true
WHERE j.jobname = 'partition-monthly';
```

Expected:
- `status = 'succeeded'` for the most recent run.
- `start_time` / `end_time` is present and within expected schedule windows.
- `return_message` does not contain SQL errors.

## Manual Trigger Verification

When validating new deployments or remediating failures, run the partition helper directly:

```sql
SELECT public.create_next_monthly_partitions();
```

Then verify expected next-month partition tables exist:

```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND (
    tablename LIKE 'usage_ledger_p_%'
    OR tablename LIKE 'rated_ledger_p_%'
    OR tablename LIKE 'saga_transitions_p_%'
    OR tablename LIKE 'value_loop_events_p_%'
  )
ORDER BY tablename DESC;
```

## Release Smoke Checks (Required)

Include the following in every release smoke-check checklist:

1. `cron.job` check confirms a single active `partition-monthly` job.
2. Last-run validation from `cron.job_run_details` shows a successful recent execution.
3. Manual trigger `SELECT public.create_next_monthly_partitions();` runs without errors in staging.
4. Post-trigger partition existence check confirms expected future monthly partitions are present.
