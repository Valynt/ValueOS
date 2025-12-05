# Beta → GA Migration & Rollout Plan

This runbook protects tenant data, de-risks schema changes, and removes beta-only feature flags without service disruption. It is designed for a dry-run on a test tenant followed by GA rollout.

## Objectives
- Preserve all beta tenant data and case history.
- Verify schema migrations and feature flag transitions before touching production tenants.
- Provide a clear Go/No-Go checklist with owners.

## Database Migration Strategy
1. **Inventory & Diff**
   - Capture current schema from `supabase db dump` and compare to `supabase/migrations/20250101000000_baseline_schema.sql`.
   - Enumerate beta-only tables/columns (e.g., `feature_flags` entries with `beta_*` prefixes) and tenant-specific overrides.
2. **Backward-Compatible Migrations**
   - Additive changes only (new nullable columns, new indexes) for first deploy; avoid destructive changes until data parity is confirmed.
   - Wrap risky changes in transaction blocks with validation queries (row counts, foreign-key checks) before commit.
3. **Data Safeguards**
   - Pre-deploy backup: `supabase db dump --data-only` scoped to beta tenant IDs.
   - Post-migration verification queries:
     - Row counts match per table per tenant.
     - Critical aggregates (cases per status, workflow executions, survey responses) unchanged.
4. **Observability**
   - Enable statement logging during the dry-run window.
   - Capture migration timings and errors to `reports/migration-logs/<timestamp>.log` for auditability.

## Dry-Run on Test Tenant (Acceptance Gate)
- Clone a beta tenant into `tenant_ga_dryrun` via database copy or data export/import.
- Apply migrations and run validation queries above.
- Execute smoke tests:
  - Create/open cases, run orchestrated workflows, submit NPS/CSAT forms, and validate feature-flagged paths load as GA.
  - Confirm `launch_readiness_metrics` (if present) still aggregates for the cloned tenant.
- Exit criteria: zero data loss, no failed smoke tests, and parity on aggregate counts.

## Feature Flag Transition
1. **Audit**: List all `beta_*` flags in `feature_flags` table; map each to its GA equivalent (`ga_*`) or removal.
2. **Dual-Write Window**: For flags converting to GA, enable both `beta_*` and `ga_*` for one release so clients accept either key.
3. **Cutover**: After successful dry-run, update clients to read `ga_*` only and delete `beta_*` rows. Confirm tenant access roles still map correctly.
4. **Rollback**: If regressions appear, re-enable `beta_*` flags (kept in backup) and revert to previous client config. Backups enable point-in-time recovery.

## Communication Plan
- **Pre-announce**: Send "Thank you / Upgrade" email to beta users with timeline, expected downtime (if any), and changelog. Include GA feature flag mapping and support contacts.
- **In-App Banner**: 48 hours before cutover, show banner in the beta environment linking to release notes and support.
- **Go/No-Go Review**: Present Launch Readiness Dashboard to C-level stakeholders with the dry-run report attached.
- **Post-cutover**: Send confirmation that data was preserved and provide rollback window end-time.

## Rollout Steps
1. Schedule maintenance window and freeze non-essential changes.
2. Take tenant-scoped backup and snapshot feature flags.
3. Apply migrations in staging → run dry-run checklist on `tenant_ga_dryrun`.
4. If green, deploy migrations to production and execute feature flag cutover.
5. Validate metrics ingestion (adoption, NPS/CSAT, P0/P1 defects, p95 latency) and publish dashboard links.
6. Close the loop with stakeholders; document outcomes in the release log.

## Go/No-Go Checklist
- [ ] Dry-run completed with zero data loss and passing smoke tests.
- [ ] Feature flags transitioned (`beta_*` removed or mapped to `ga_*`).
- [ ] Backup stored and verified.
- [ ] Stakeholder communications sent (pre/post).
- [ ] Launch Readiness Dashboard reviewed and archived in the release packet.
