# Layer 3 Readiness Evidence Gate

This gate is an additive pre-promotion control in `.github/workflows/deploy.yml` and does **not** change production runtime behavior. It blocks promotion only when required Layer 3 evidence artifacts are missing or stale.

## Required evidence checks

The canonical machine-readable manifest is:

- `scripts/ci/layer3-release-readiness-manifest.json`

It requires these check artifacts:

1. workflow-state tests
2. drift primitive tests
3. migration-head check
4. schema-contract check
5. route compatibility check
6. tenant-isolation tests
7. tenant migration readiness checklist artifact

## Operator procedure

1. Ensure each Layer 3 check writes its output into the artifact path declared in `scripts/ci/layer3-release-readiness-manifest.json`.
2. Run the gate locally before promotion workflows:
   - `node scripts/ci/check-layer3-readiness-evidence.mjs`
3. Review the generated report:
   - `artifacts/ci/layer3-readiness-report.md`
4. If the gate fails, fix any missing or stale evidence listed under **Failed checks** and **Open risks**, then re-run the command.
5. In CI, download artifact `layer3-readiness-report-<run_id>` from the deploy workflow for audit traceability.

## Report sections per run

The gate report always includes:

- Passed checks
- Failed checks
- Changed controls
- Open risks
- Production-ready verdict


## Layer 3 tenant migration artifact requirement

For any deployment PR/release that includes Layer 3 graph tenant-field/index/constraint changes, attach:

- `artifacts/layer3/tenant-migration-readiness-checklist.md`

The artifact must include staging query outputs and logs proving:

- pre-migration inventory counts by label and tenant property state
- post-migration zero `tenantId` and zero missing `tenant_id` for scoped labels
- constraint/index existence for all `ENTITY_TYPES`

Use `docs/runbooks/layer3-tenant-migration-readiness.md` as the canonical checklist/runbook.
