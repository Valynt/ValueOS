# launch-readiness Specification

## Purpose
Define the minimum launch-readiness checklist and documentation standards that every repository MUST meet before being considered launchable, centered on a `docs/launch-readiness.md` file that clearly surfaces blockers, required commands, environment configuration, and post-deploy smoke tests.
## Requirements
### Requirement: Launch readiness document exists

`docs/launch-readiness.md` SHALL exist and SHALL contain the following sections: Scope, Blockers, Launch-safe known issues, Post-launch work, Commands, Environment variables, Smoke test.

#### Scenario: Engineer checks launch status

- GIVEN `docs/launch-readiness.md` exists
- WHEN an engineer reads it
- THEN they can determine in under 2 minutes whether the repo is launchable
- AND they can identify every open blocker by name

### Requirement: Blockers are classified

Every item in the Blockers section SHALL be one of: boot failure, broken test on critical path, unsafe migration, unclear required env var, auth/security gap, non-deterministic build, or undocumented deploy step.

#### Scenario: A blocker is resolved

- GIVEN a blocker item exists in `docs/launch-readiness.md`
- WHEN the fix is merged
- THEN the item is moved to the Resolved section with a reference to the PR or commit

### Requirement: Commands section is accurate

The Commands section SHALL list the exact commands for install, dev, test, build, migrate, and deploy — and each SHALL be verified to work from a clean environment.

#### Scenario: Engineer runs a command from the launch-readiness doc

- GIVEN the Commands section lists `pnpm run <command>`
- WHEN that command is run from the repo root
- THEN it exits 0 without a "missing script" error

### Requirement: Smoke test is executable

The Smoke test section SHALL list steps that can be run manually after a deploy to confirm the system is healthy. Each step SHALL be a concrete action with an expected outcome.

#### Scenario: Post-deploy smoke test

- GIVEN the app has been deployed
- WHEN each smoke test step is executed in order
- THEN every step produces its expected outcome
- AND no step requires tribal knowledge to interpret

