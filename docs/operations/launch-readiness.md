---
title: Launch Readiness
owner: team-operations
escalation_path: "pagerduty://valueos-primary -> slack:#incident-response -> email:platform-leadership@valueos.com"
review_date: 2026-05-31
status: active
---

# Launch Readiness

**Last Updated**: 2026-03-12

**Consolidated from 1 source documents**

---

## Beta → GA Migration & Rollout Plan

_Source: `operations/launch-readiness/migration-rollout-plan.md`_

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

- **Canonical enforcement:** `pnpm run check:release-signoff` is the automated control that enforces release-sign-off consistency before production promotion and during release automation. The deploy and release workflows must remain wired to this check; the checklist items below are evidence expectations that the gate validates, not a manual substitute.
- [ ] Pre-production launch gate passed in CI (`.github/workflows/deploy.yml` → `preprod-launch-gate` job).
- [ ] Gate owners reviewed and approved outcomes for billing/entitlements, localization, tenant/region toggles, and co-branding scope.
- [ ] Dry-run completed with zero data loss and passing smoke tests.
- [ ] Feature flags transitioned (`beta_*` removed or mapped to `ga_*`).
- [ ] Backup stored and verified.
- [ ] Stakeholder communications sent (pre/post).
- [ ] Launch Readiness Dashboard reviewed and archived in the release packet.
- [ ] GA release scope sign-off attached: `docs/operations/release-scope-ga-signoff.md` (Product/Engineering/Security approvals required for release tag `v1.0.0`; Design review may be attached as additional evidence only) with acceptance mapping `docs/operations/release-acceptance-mapping.md`.
- [ ] Threat model review record attached: `docs/security-compliance/threat-model.md` (Review and Approver Record for release tag `v1.0.0`, reviewed by the Security approver before sign-off).
- [ ] **Hard Go/No-Go**: Security approver reviewed `docs/security-compliance/threat-model.md` and the linked release evidence chain in `docs/security-compliance/evidence-index.md` for this release, and verified that the GA `v1.0.0` entry records Product/Engineering/Security approvers and dates before Product/Engineering/Security sign-off is accepted.
- [ ] Accessibility readiness metrics published (including WCAG severity budget compliance: critical/serious = 0).
- [ ] Localization readiness metrics published (coverage + key completeness dashboards for all release locales).
- [ ] Accessibility and localization dashboard trends reviewed in `docs/quality/ux-quality-scorecard.md`, with any regression assigned to the documented route owner before production sign-off.
- [ ] UX performance budgets validated in CI (bundle + route-level load targets) and attached to release checklist.
- [ ] **Blocking launch chaos/smoke suite passed** (`node scripts/chaos/launch-chaos-smoke.mjs`) with machine-readable evidence attached (`artifacts/chaos-launch/**/launch-chaos-results.json`).

### Automated release sign-off enforcement

The canonical release evidence gate is `scripts/ci/check-release-signoff.mjs`, exposed as:

```bash
pnpm run check:release-signoff
```

This check is blocking in both `.github/workflows/release.yml` and the production promotion path in `.github/workflows/deploy.yml`. It fails the workflow when any of the following drift conditions exist:

1. `docs/operations/release-scope-ga-signoff.md` is missing or does not declare the target release version.
2. Product, Engineering, or Security approvals are missing explicit signed timestamps.
3. `docs/security-compliance/threat-model.md` does not contain the matching Review and Approver Record row for the same release.
4. `docs/security-compliance/evidence-index.md` does not reference the same release evidence bundle chain.
5. The workflow’s target release version and the documented sign-off artifacts disagree.

Treat a failing automated release sign-off check as a hard **No-Go** for production promotion until the evidence chain is corrected in-repo.

## Release Notes & Versioning Evidence (Changesets)

ValueOS uses **Changesets** for release-note intake, version bumps, and changelog generation. The release automation in `.github/workflows/release.yml` runs the workspace-installed `@changesets/cli` with:

- `pnpm changeset version` to consume pending `.changeset/*.md` entries, update package versions, and generate/update changelog files in the versioning PR.
- `pnpm changeset tag` to create the package tags consumed by the GitHub Release step.

### Required release artifacts for sign-off

Before approving a launch, confirm these artifacts exist for the release candidate:

1. **Pending unreleased work** is described by one or more checked-in `.changeset/*.md` files before the Version Packages PR is created.
2. The **Version Packages** PR generated by Changesets contains the resulting package version bumps and changelog updates for the packages being released.
3. The post-merge workflow run creates a **GitHub Release** for each published package tag, which is the release-note artifact linked from the sign-off packet.

If any of those artifacts are missing, treat release-note evidence as incomplete and hold launch sign-off until the missing Changesets inputs or generated outputs are restored.

## Pre-Production Launch Gate (CI Blocking Control)

Production promotion is blocked unless the **Pre-Production Launch Gate** job succeeds in `.github/workflows/deploy.yml`.

### Gate checks

1. **Entitlements + billing regression tests**
   - Backend billing regression coverage must pass before production promotion.
   - Owner: **Revenue Platform**.
2. **Localization smoke checks**
   - Pseudo-localization smoke check must pass and emit an artifact for audit trail.
   - Owner: **Product Engineering**.
3. **Tenant/region feature-toggle validation**
   - Tenant isolation and feature-toggle behavior checks must pass.
   - Owner: **Platform**.
4. **Co-branding asset/render checks (if applicable)**
   - If co-branding assets are present for the release, branding asset/render verification must pass.
   - If no co-branding assets are present, this check is explicitly skipped with a log entry.
   - Owner: **Design Systems**.

### Operational ownership and escalation

- **Release Captain** confirms gate completion before requesting production environment approval.
- **On-Call SRE** validates the gate result in the workflow run and ensures artifacts are available.
- Failing gate checks are treated as **No-Go** until the owning team resolves issues or an incident-governed bypass process is invoked.

## Blocking Launch Chaos/Smoke Suite (Release Gate)

Related architecture decision: [ADR 0006 — Multi-Tenant Data Isolation and Sharding Strategy](../engineering/adr/0006-multi-tenant-isolation-and-sharding.md).

Before any production go-live, execute the unified suite:

```bash
node scripts/chaos/launch-chaos-smoke.mjs
```

Mandatory checks in this suite:

1. Cross-tenant access attempt must fail (tenant isolation invariant).
2. Billing bypass attempt must alert/block (plan enforcement middleware).
3. Autoscale stress to high replica count with clean downscale (k8s backend deployment + HPA topology).

Release sign-off is **No-Go** unless `launch-chaos-results.json` reports `"status": "pass"` and includes evidence pointers for each check. CI publishes this artifact as `launch-chaos-smoke-<run_id>`.

## Billing Sign-off: Early-Adopter `price_version_id` Audit

Run this check before launch approval to confirm every early-adopter tenant is pinned to a valid billing price version.

### Deterministic cohort definition

The cohort is defined in SQL and must remain deterministic for launch sign-off:

- `acme-corp`
- `techstart-inc`
- `demo-org`

Source of truth: `infra/supabase/audits/early_adopter_subscription_price_version_audit.sql`.

### Execution steps

1. Export a privileged database connection string:

   ```bash
   export DATABASE_URL="postgresql://<user>:<password>@<host>:5432/postgres"
   ```

2. Execute the audit wrapper:

   ```bash
   scripts/billing/audit-early-adopter-price-versions.sh
   ```

### Expected output for sign-off

- The query prints one row per target tenant with `audit_status = ok`.
- The script ends with:

  ```text
  PASS: early-adopter subscription price version audit completed.
  [audit-early-adopter-price-versions] Audit completed successfully.
  ```

### Failure conditions (No-Go)

The script exits non-zero and blocks sign-off if any target tenant is:

- missing from `organizations` (`missing_tenant`)
- missing all `subscriptions` (`missing_subscription`)
- using `subscriptions.price_version_id IS NULL` (`null_price_version_id`)
- using a `price_version_id` that does not resolve in `billing_price_versions` (`invalid_price_version_id`)

---
