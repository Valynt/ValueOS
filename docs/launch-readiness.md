---
owner: team-platform
generated_at: 2026-04-08
source_commit: HEAD
status: active
---

# Launch Readiness

Canonical gate definition: [docs/go-no-go-criteria.md](./go-no-go-criteria.md).

This document is an evidence index only. Readiness claims must be backed by objective evidence links (workflow run URL, artifact path, and release SHA).

## Release metadata

| Field | Value |
|---|---|
| Release version | `vX.Y.Z` |
| Release SHA | `<RELEASE_SHA>` |
| Release decision issue | `https://github.com/<org>/<repo>/issues/<id>` |
| Last updated (UTC) | `2026-04-08T00:00:00Z` |

## Gate evidence matrix

| Gate | Status | Workflow run URL | Artifact / evidence path | Release SHA |
|---|---|---|---|---|
| G1 CI Pipeline Integrity | INCOMPLETE | https://github.com/<org>/<repo>/actions/runs/<run_id> | artifacts/ci-lanes/ | `<RELEASE_SHA>` |
| G2 Test Coverage | INCOMPLETE | https://github.com/<org>/<repo>/actions/runs/<run_id> | coverage/coverage-summary.json | `<RELEASE_SHA>` |
| G3 E2E Tests | INCOMPLETE | https://github.com/<org>/<repo>/actions/runs/<run_id> | playwright-report/ + artifacts/e2e/ | `<RELEASE_SHA>` |
| G4 Security | INCOMPLETE | https://github.com/<org>/<repo>/actions/runs/<run_id> | artifacts/security/ + .gitleaks.toml checks | `<RELEASE_SHA>` |
| G5 Schema & Data Integrity | INCOMPLETE | https://github.com/<org>/<repo>/actions/runs/<run_id> | artifacts/db/ + migration rollback evidence | `<RELEASE_SHA>` |
| G6 Infrastructure Readiness | INCOMPLETE | https://github.com/<org>/<repo>/actions/runs/<run_id> | infra/k8s/manifest-maturity-ledger.json + artifacts/infra/ | `<RELEASE_SHA>` |
| G7 Observability Readiness | INCOMPLETE | https://github.com/<org>/<repo>/actions/runs/<run_id> | artifacts/observability/ + runbook links | `<RELEASE_SHA>` |
| G8 Compliance | INCOMPLETE | https://github.com/<org>/<repo>/actions/runs/<run_id> | artifacts/compliance/ + docs/security-compliance/evidence-index.md | `<RELEASE_SHA>` |

## Go/No-Go sign-off table

> Rule: A gate must not be marked `COMPLETE` above unless its corresponding row here is checked.

| Gate / Role | Sign-off | Timestamp (UTC) | Release SHA | Evidence |
|---|---|---|---|---|
| G1 CI Pipeline Integrity (Platform Engineering) | [ ] |  |  |  |
| G2 Test Coverage (QA Lead) | [ ] |  |  |  |
| G3 E2E Tests (QA Lead) | [ ] |  |  |  |
| G4 Security (Security) | [ ] |  |  |  |
| G5 Schema & Data Integrity (Backend Lead + SRE) | [ ] |  |  |  |
| G6 Infrastructure Readiness (Platform Engineering + SRE) | [ ] |  |  |  |
| G7 Observability Readiness (SRE) | [ ] |  |  |  |
| G8 Compliance (Compliance + Security) | [ ] |  |  |  |
| Release Manager (final decision authority) | [ ] |  |  | https://github.com/<org>/<repo>/issues/<id> |

## Production deploy precondition

Production deploy is blocked unless all conditions below are true:

1. Every hard gate (G1–G8) in the Gate evidence matrix is `COMPLETE`.
2. Every corresponding sign-off row is checked.
3. Release Manager row is checked with:
   - UTC timestamp,
   - release SHA that matches the deployment commit,
   - link to the GO/NO-GO issue.

CI enforcement:

- `node scripts/ci/check-launch-readiness-signoff.mjs`
- `node scripts/ci/check-launch-readiness-signoff.mjs --require-release-manager --expected-sha "$GITHUB_SHA"`
