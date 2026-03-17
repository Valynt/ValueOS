# env-contract Specification

## Purpose
TBD - created by archiving change canonical-boot-path. Update Purpose after archive.
## Requirements
### Requirement: Three-file env system is the only documented path

The repository SHALL document the `ops/env/` three-file system as the only supported env setup method. Root-level `.env.example` and `.env.local.example` SHALL be demoted to legacy/alternative references only.

#### Scenario: Engineer looks for env setup instructions

- GIVEN the README quickstart
- WHEN the engineer follows the env setup step
- THEN they are directed to `ops/env/README.md`
- AND they are NOT directed to copy root-level `.env.example` as a primary setup step

### Requirement: Required vars are validated at startup

The backend SHALL fail fast on startup if any required variable is missing, with a message that names the missing var and the fix command. The current required vars are `DATABASE_URL` and `SUPABASE_URL` as defined in `packages/backend/src/config/validateEnv.ts`.

#### Scenario: Missing DATABASE_URL at startup

- GIVEN `DATABASE_URL` is not set
- WHEN the backend starts
- THEN it exits immediately with a message identifying `DATABASE_URL` as missing
- AND it does NOT start accepting traffic

### Requirement: Secrets never appear in committed config

No file committed to the repository SHALL contain a real secret value. Committed env files SHALL contain only placeholder values or comments.

#### Scenario: CI scans for committed secrets

- GIVEN a commit is pushed
- WHEN CI runs
- THEN no real credential values are detected in committed env files

### Requirement: SUPABASE_KEY alias is documented

`SUPABASE_KEY` (alias for `SUPABASE_ANON_KEY`) SHALL be documented in `ops/env/README.md` and SHALL be set in all backend env templates alongside `SUPABASE_ANON_KEY`.

#### Scenario: Backend starts without SUPABASE_KEY

- GIVEN `SUPABASE_ANON_KEY` is set but `SUPABASE_KEY` is not
- WHEN the backend starts
- THEN it crashes with "supabaseKey is required"
- AND the fix is documented in `ops/env/README.md`

