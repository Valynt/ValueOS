---
owner: team-platform
generated_at: 2026-04-08
source_commit: HEAD
status: active
---

# Launch Readiness Dashboard

Normative GO/NO-GO criteria live only in [docs/go-no-go-criteria.md](./go-no-go-criteria.md). Operational control ownership, CI job mapping, thresholds, artifact paths, and waiver policy live in [docs/operations/launch-evidence/control-matrix.md](./operations/launch-evidence/control-matrix.md).

Requirements intent and traceability source: [openspec/specs/production-readiness/spec.md](../openspec/specs/production-readiness/spec.md).

## Release metadata

| Field | Value |
|---|---|
| Release version | `vX.Y.Z` |
| Release SHA | `<RELEASE_SHA>` |
| Release decision issue | `https://github.com/<org>/<repo>/issues/<id>` |
| Last updated (UTC) | `2026-04-08T00:00:00Z` |

## Gate status dashboard

| Gate ID | Status | Evidence run URL | Artifact bundle | Owner sign-off |
|---|---|---|---|---|
| G1 | INCOMPLETE | https://github.com/<org>/<repo>/actions/runs/<run_id> | artifacts/ci-lanes/ | [ ] |
| G2 | INCOMPLETE | https://github.com/<org>/<repo>/actions/runs/<run_id> | coverage/coverage-summary.json | [ ] |
| G3 | INCOMPLETE | https://github.com/<org>/<repo>/actions/runs/<run_id> | playwright-report/ + artifacts/e2e/ | [ ] |
| G4 | INCOMPLETE | https://github.com/<org>/<repo>/actions/runs/<run_id> | artifacts/security/ | [ ] |
| G5 | INCOMPLETE | https://github.com/<org>/<repo>/actions/runs/<run_id> | artifacts/db/ | [ ] |
| G6 | INCOMPLETE | https://github.com/<org>/<repo>/actions/runs/<run_id> | artifacts/infra/ | [ ] |
| G7 | INCOMPLETE | https://github.com/<org>/<repo>/actions/runs/<run_id> | artifacts/observability/ | [ ] |
| G8 | INCOMPLETE | https://github.com/<org>/<repo>/actions/runs/<run_id> | artifacts/compliance/ | [ ] |

## Decision precondition

Production deploy remains blocked until all gate statuses are `COMPLETE`, all owner sign-offs are checked, and the release manager final decision is recorded in the release decision issue for the same release SHA.


## Release manager decision

| Final GO/NO-GO sign-off | Timestamp (UTC) | Release SHA | Decision issue |
|---|---|---|---|
| [ ] |  |  | https://github.com/<org>/<repo>/issues/<id> |
