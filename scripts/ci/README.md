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
- `check-supabase-security-controls.mjs` — validates Supabase migration guardrails (RLS policy coverage for RLS-enabled tables, plaintext `credentials JSONB` columns, and tenant policies that rely on JWT claims without explicit `service_role` bypass) and emits `ci-artifacts/security-controls-summary.json` for artifact upload.
