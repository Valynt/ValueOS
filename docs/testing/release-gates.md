# Release Gates and CI Lane Ownership

This document defines the CI backlog lanes, trigger policy, ownership, and service-level expectations for release-blocking signals.

## Lane Overview

| Lane                          | Primary Owner           | Trigger Policy                                         | SLA           | Blocking Scope                         | Artifact Prefix                  |
| ----------------------------- | ----------------------- | ------------------------------------------------------ | ------------- | -------------------------------------- | -------------------------------- |
| `unit/component/schema`       | team-quality            | Pull request, push                                     | <= 15 minutes | PR fast blocking                       | `lane-unit-component-schema-*`   |
| `tenant-isolation-gate`       | team-security           | Pull request, push                                     | <= 20 minutes | PR fast blocking                       | `lane-tenant-isolation-gate-*`   |
| `ui-truthfulness-gate`        | team-product-ui         | Pull request, push                                     | <= 20 minutes | PR fast blocking                       | `lane-ui-truthfulness-gate-*`    |
| `migration-verification`      | team-platform           | Push, release, tags                                    | <= 15 minutes | Staging/deploy release gate            | `lane-migration-verification-*`  |
| `critical-workflows-gate`     | team-runtime            | Push, release, tags                                    | <= 30 minutes | Staging/deploy release gate            | `lane-critical-workflows-gate-*` |
| `nightly matrix/chaos/replay` | team-sre + team-runtime | Nightly schedule, manual dispatch (`run_nightly=true`) | <= 60 minutes | Nightly health signal (non-PR blocker) | `lane-nightly-<suite>-*`         |

## Trigger Policy

### Pull requests (fast blocking subsets)

The `pr-fast-blocking-subsets` gate depends on:

1. `unit/component/schema`
2. `tenant-isolation-gate`
3. `ui-truthfulness-gate`

Any non-success state in these lanes fails the PR gate.

### Staging/deploy gates

The `staging/deploy release gates` job depends on:

1. `migration-verification`
2. `critical-workflows-gate` (includes reload durability checks)

Any non-success state in these lanes fails release progression.

### Nightly heavy suites

The `nightly matrix/chaos/replay` lane runs as a matrix of:

- `matrix`
- `chaos`
- `replay`

Nightly runs emit per-suite artifacts and failure summaries for diagnostics and trend analysis.

## Artifact and Failure Summary Contract

Every lane MUST emit:

1. `summary.md` with workflow metadata (`workflow`, `run_id`, `run_attempt`, `workflow_run_url`, `sha`, status).
2. `failure-summary.md` when lane status is failed.
3. Lane-specific evidence (coverage reports, JUnit/XML, logs, or Playwright output).

This enables direct traceability from a failed lane artifact back to the exact workflow run.

## Dependency Graph (`needs`) Policy

- `critical-workflows-gate` depends on `migration-verification` so release blockers fail fast on migration issues.
- `pr-fast-blocking-subsets` depends on all PR blocker lanes and performs explicit status enforcement.
- `staging/deploy release gates` depends on all release blocker lanes and prints workflow IDs and run URLs.

## Operational Notes

- If a lane breaches SLA for 3 consecutive runs, owner team must open a stabilization issue in the same sprint.
- If nightly `chaos` or `replay` fails twice consecutively, team-sre and team-runtime must triage before next deploy window.
- Ownership updates must be reflected in this file and in `.github/workflows/CI_CONTROL_MATRIX.md`.
