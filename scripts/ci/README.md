# Migration CI scripts

Purpose: lightweight guard and verification scripts for SQL migrations.

Files:

- `check-migrations.sh` — verifies migrations are append-only and that a matching rollback file exists for each new migration added under `supabase/migrations/`.
- `apply-and-rollback-migrations.sh` — applies all `supabase/migrations/*.sql` to a Postgres instance and then runs rollbacks from `supabase/rollbacks/` in reverse order to validate reversibility.

Local usage:

Run the append-only check against `main`:

```bash
git fetch origin main --depth=1
BASE_BRANCH=main bash scripts/ci/check-migrations.sh
```

Run apply+rollback against a local Postgres (defaults below):

```bash
# start Postgres (example using Docker)
docker run --rm --name vo-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:15

# then run
PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=postgres PGDATABASE=postgres \
  bash scripts/ci/apply-and-rollback-migrations.sh
```

CI integration:

- `.github/workflows/migrations-check.yml` runs the append-only + rollback-presence check on PRs and pushes that touch `supabase/migrations/**`.
- `.github/workflows/migrations-apply-rollback.yml` runs an ephemeral Postgres service, executes `check-migrations.sh`, then runs `apply-and-rollback-migrations.sh` to validate SQL execution and rollback behavior.

Notes & troubleshooting:

- Ensure rollback files are committed under `supabase/rollbacks/` with matching timestamp-prefixes.
- Scripts rely on `psql` in CI; the workflow installs `postgresql-client`.
- For more thorough validation (data-level checks, constraints), consider running integration tests that exercise migrations with realistic seed data.
- If CI time becomes a concern, run the full apply+rollback job only on PRs that add migrations and schedule nightly full runs.

Contact: Mention this README in migration PRs or ping the infra team for questions.

- `validate-secret-key-contract.mjs` — validates canonical secret key names across Kubernetes ExternalSecrets and environment/compose definitions; fails on deprecated aliases.

- `check-openapi-breaking-changes.mjs` — compares `scripts/openapi.yaml` in the current branch with the base branch and fails on removed operations or removed response codes (breaking contract signals for PRs).
- `check-infra-manifest-registry.mjs` — validates the active/deprecated manifest registry in `infra/README.md` and blocks references to deprecated paths.
- `check-k8s-architecture-conformance.mjs` — lints `infra/k8s/**` manifests for required platform labels, probes, security context, and autoscaling policy declarations.
- `validate-agent-autoscaling-manifests.py` — validates every autoscaling manifest under `infra/k8s/base/agents/` via duplicate-key-safe YAML parsing, per-file `kustomize build`, and autoscaling contract/schema checks for HPA and KEDA resources.
- `check-supabase-security-controls.mjs` — validates Supabase migration guardrails (RLS policy coverage for RLS-enabled tables, plaintext `credentials JSONB` columns, and tenant policies that rely on JWT claims without explicit `service_role` bypass) and emits `ci-artifacts/security-controls-summary.json` for artifact upload.
- `check-canonical-ci-entrypoint.mjs` — validates the root `package.json` CI contract (`typecheck:signal`, `ci:verify`, and `ci:governance:self-check`) and ensures `.github/workflows/ci.yml` still references either `pnpm run ci:verify` or `pnpm run typecheck:signal --verify`.
- `check-deploy-workflow-release-gate-consistency.mjs` — validates that `.github/workflows/deploy.yml` still routes `deploy-production` through the canonical `release-gate-contract` job (named `release-readiness`) declared in `scripts/ci/release-gate-manifest.json`, and that the contract evaluates gate status via `verify-release-gate-status.mjs`.
- `verify-release-gate-status.mjs` — polls GitHub check runs for the current SHA and blocks deploy promotion until every external check listed in `scripts/ci/release-gate-manifest.json` is green alongside the required local deploy gates.

- `check-migration-governance.mjs` — scans Supabase migrations/rollbacks for duplicate or near-duplicate migration intents, rollback files without forward migration pairs, and schema concerns that are active across multiple non-archived paths. Writes `ci-artifacts/migration-governance-report.json` (or `--report <path>`) for machine-readable CI artifacts and fails only when newly introduced duplicate intents are detected.
- `analyze-outdated-dependencies.mjs` — parses `pnpm outdated --format=json`, classifies patch/minor/major upgrades, applies configurable fail/warn policy, and writes markdown + JSON reports for CI artifacts.

- `docs-boundary-consistency-lint.mjs` — lightweight docs lint that checks canonical architecture docs for stale product names (`ValueCanvas`), invalid k8s path patterns (`infra/infra/k8s`), and legacy agent source paths (`apps/ValyntApp/src/lib/agent-fabric/agents`).

- `any-ratchet.mjs` — scans non-test TypeScript files for explicit `any` usage (`: any`, `as any`, `<any>`) and enforces non-increasing per-package baselines from `.github/any-ratchet-budgets.json`.
