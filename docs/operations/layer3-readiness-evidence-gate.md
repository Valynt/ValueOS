# Layer 3 Readiness Evidence Gate

This gate is an additive pre-promotion control in `.github/workflows/deploy.yml` and does **not** change production runtime behavior. It blocks promotion when required Layer 3 evidence artifacts are missing, stale, or semantically invalid.

## Required evidence checks

The canonical machine-readable manifest is:

- `scripts/ci/layer3-release-readiness-manifest.json`

Each check now declares a validator contract:

- `validator`: semantic validator type (`json-path-equals` or `text-markers`)
- `formatVersion`: expected artifact schema version (JSON checks)
- `successPath` + `expectedValue`: explicit success assertion (JSON checks)
- `requiredPaths`: required JSON fields (JSON checks)
- `successMarkers` + `failureMarkers`: required/forbidden strings (text/log checks)

It requires these check artifacts (with conditional enforcement where declared in the manifest):

1. workflow-state tests (JSON)
2. drift primitive tests (JSON)
3. migration-head check (log/text)
4. schema-contract check (JSON)
5. route compatibility check (JSON)
6. tenant-isolation tests (JSON)
7. tenant migration readiness checklist artifact (markdown/text)


## Conditional enforcement (tenant migration checklist)

`tenant-migration-readiness-checklist` is only required when Layer 3 tenant graph/migration scope is in the release diff.

Applicability resolution order:

1. `LAYER3_TENANT_MIGRATION_REQUIRED` CI env var override (`true`/`false`).
2. `LAYER3_RELEASE_DIFF_JSON.changedFiles` matching manifest `requiredWhen` prefixes/patterns.

When not applicable, the report records this check as `skipped (not applicable)` and does not fail the gate.
When applicable, artifact existence, freshness, and semantic validation remain mandatory.

## Semantic validation behavior

After existence and freshness validation, the gate parses artifact payloads and enforces validator-specific semantics:

- **JSON checks (`json-path-equals`)**
  - Parse JSON payload.
  - Require `formatVersion` in payload to exactly match manifest `formatVersion`.
  - Require every field listed in `requiredPaths`.
  - Assert `successPath` value strictly equals `expectedValue`.
- **Text/log checks (`text-markers`)**
  - Require all `successMarkers` strings to be present.
  - Require all `failureMarkers` strings to be absent.

The gate fails closed on:

- malformed JSON
- missing required manifest metadata for the validator
- missing required payload fields
- unknown validator type
- schema/format version mismatch

## Operator procedure

1. Ensure each Layer 3 check writes its output into the artifact path declared in `scripts/ci/layer3-release-readiness-manifest.json` and matches its validator contract.
2. Run the gate locally before promotion workflows:
   - `node scripts/ci/check-layer3-readiness-evidence.mjs`
3. Review the generated report:
   - `artifacts/ci/layer3-readiness-report.md`
4. If the gate fails, fix any missing/stale/invalid evidence listed under **Failed checks** and **Open risks**, then re-run the command.
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
