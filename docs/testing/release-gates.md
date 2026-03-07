# Release Gates and Backlog Lanes

This document defines the CI lane model in `.github/workflows/ci.yml`, ownership expectations, and service level agreements (SLAs) for triage.

## Trigger Policy

| Trigger | Required lanes |
| --- | --- |
| Pull Requests | `unit/component/schema`, `tenant-isolation-gate`, `ui-truthfulness-gate`, `migration-verification` |
| Staging / Deploy (`push`, `release`, `v*` tags) | `critical-workflows-gate`, `migration-verification` |
| Nightly schedule | `nightly matrix/chaos/replay` |

## Lane Definitions, Ownership, and SLA

| Lane | Primary scope | Owner lane | SLA target |
| --- | --- | --- | --- |
| `unit/component/schema` | Lint, typecheck, unit tests, schema hygiene checks | App Platform | Investigate within 4 business hours |
| `tenant-isolation-gate` | RLS + tenant-boundary integration checks | Data Platform + Security | Investigate within 2 business hours |
| `critical-workflows-gate` | Claims verification, workflow contracts, reload durability via chaos smoke | Backend Agent Platform | Investigate within 2 business hours |
| `ui-truthfulness-gate` | i18n integrity, pseudo-localization, localization visual truthfulness | Frontend Platform | Investigate within 4 business hours |
| `migration-verification` | Migration hygiene + critical architecture migration policies | Data Platform | Investigate within 2 business hours |
| `nightly matrix/chaos/replay` | Multi-version matrix, chaos smoke, replay-oriented security flows | Reliability Engineering | Investigate before next business day |

## Artifacts and Failure Summaries

Each lane emits artifacts under lane-specific names (`lane-<lane-name>-<run_id>`) and writes a lane summary containing:

- workflow name
- workflow `run_id`
- `run_attempt`
- lane status
- upstream lane states for dependency-based lanes

These summaries are uploaded even when a lane fails (`if: always()`), so triage can start from the artifact payload without re-running CI.

## Dependency Graph (needs)

- `critical-workflows-gate` depends on `unit-component-schema` and `tenant-isolation-gate`.
- `migration-verification` depends on `unit-component-schema` and `tenant-isolation-gate`.
- PR blocking gate (`pr-fast-blocking-subsets`) depends on PR lanes and fails fast on first failed blocker.
- Staging/deploy gate (`staging-deploy-release-gates`) depends on release blockers and reports run identifiers in logs.

This structure guarantees release blockers are surfaced with explicit lane names and workflow IDs in a single enforcement job.
