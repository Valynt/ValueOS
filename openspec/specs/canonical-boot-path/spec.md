# canonical-boot-path Specification

## Purpose
This specification defines a single, canonical end-to-end boot and setup path for the repository so that a new engineer can reliably go from a fresh clone to a running system using the documented commands, environment configuration, database migrations, and preflight checks.
## Requirements
### Requirement: Single setup path

The repository SHALL document exactly one primary setup path. Alternative paths (local Docker Compose, bare-metal) MAY exist but SHALL be clearly marked as alternatives, not the default.

#### Scenario: New engineer follows the documented path

- GIVEN a fresh clone of the repository with no prior state
- WHEN the engineer follows the README quickstart exactly
- THEN the application starts and the health endpoint returns 200
- AND the frontend loads in the browser
- AND no undocumented steps were required

### Requirement: Correct commands in documentation

Every command shown in the README quickstart SHALL exist in `package.json` or be a documented CLI tool.

#### Scenario: README references a non-existent script

- GIVEN the README shows `pnpm run <command>`
- WHEN that command is run
- THEN it MUST NOT exit with "missing script" error

### Requirement: Env setup is one documented step

The env setup step SHALL reference `ops/env/README.md` as the single source of truth and SHALL provide the exact copy commands for cloud-dev mode.

#### Scenario: Engineer sets up env vars

- GIVEN `ops/env/.env.cloud-dev.example`, `.env.frontend.cloud-dev.example`, `.env.backend.cloud-dev.example` exist
- WHEN the engineer runs the documented copy commands and fills in credentials
- THEN `bash scripts/validate-cloud-dev-env.sh` exits 0

### Requirement: Migration command is documented and correct

The README SHALL show `pnpm run db:migrate` (not `db:push`) as the migration step.

#### Scenario: Engineer runs migrations

- GIVEN `DATABASE_URL` is set and the database is reachable
- WHEN `pnpm run db:migrate` is run
- THEN all migrations in `infra/supabase/supabase/migrations/` are applied without error

### Requirement: Preflight check is part of the flow

The setup path SHALL include `pnpm run dx:check` as a verification step before starting services.

#### Scenario: Doctor catches misconfiguration

- GIVEN an env var is missing or malformed
- WHEN `pnpm run dx:check` is run
- THEN it exits non-zero with a clear message identifying the missing var

