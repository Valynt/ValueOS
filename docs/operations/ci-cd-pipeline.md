---
title: Ci Cd Pipeline
owner: team-platform
escalation_path: "pagerduty://valueos-primary -> slack:#incident-response -> email:platform-leadership@valueos.com"
review_date: 2026-05-31
status: active
## Authoritative Workflow Map

Treat the workflow documentation in `.github/workflows/` as the source of truth for lane ownership, trigger semantics, and required checks:

- [Workflow README](../../.github/workflows/README.md)
- [CI Control Matrix](../../.github/workflows/CI_CONTROL_MATRIX.md)

All CI documentation in `docs/operations/` and `docs/security-compliance/` must align to these two files when workflow names, lane names, or required-check contracts change.

---

# Ci Cd Pipeline

**Last Updated**: 2026-03-12

**Consolidated from 1 source documents**

## Authoritative Workflow Map

Treat the workflow documentation in `.github/workflows/` as the source of truth for lane ownership, trigger semantics, and required checks:

- [Workflow README](../../.github/workflows/README.md)
- [CI Control Matrix](../../.github/workflows/CI_CONTROL_MATRIX.md)

All CI documentation in `docs/operations/` and `docs/security-compliance/` must align to these two files when workflow names, lane names, or required-check contracts change.

---


## Compliance Evidence Checkpoints (Governance)

For regulated workloads (including HIPAA in-scope tenants), CI and governance checkpoints must preserve evidence required for periodic compliance reviews.

- **Per PR / Merge**:
  - Preserve lint/typecheck/test/build outputs from `pnpm run ci:verify`.
  - Preserve RLS and smoke-test artifacts (`test-results/`, `playwright-report/`) when present.
  - Preserve security artifacts from `security-gate` and `dast-gate`, including ZAP JSON/HTML/Markdown reports and DAST summary markdown.
  - Ensure audit-relevant change context is traceable to commit SHA and workflow run ID.
- **Monthly checkpoint**:
  - Export CI pass/fail trends, security scan summaries, and exception approvals for compliance review packets.
- **Quarterly checkpoint**:
  - Attach incident-response drill evidence, access-review attestations, and control-validation artifacts to governance records.
- **Annual checkpoint**:
  - Produce compliance evidence bundle covering policy review, control operation samples, and remediation closure tracking.

Suggested ownership:

- Engineering: CI evidence retention and reproducibility.
- Security/Compliance: control mapping review and attestation package assembly.
- Operations: incident drill records and disaster recovery evidence.

### Compliance Evidence Retention Policy

The `Compliance Evidence Export` workflow produces the canonical evidence bundle artifact for governance checkpoints.

- **Artifact name**: `compliance-evidence-bundle-<run_id>`
- **Workflow location**: `.github/workflows/compliance-evidence-export.yml`
- **Bundle contents**:
  - `evidence/security-scans/` (security scan outputs, including Semgrep and dependency audit output)
  - `evidence/privacy/` (DSR/privacy compliance test results)
  - `evidence/rls/` (RLS validation test results)
  - `evidence/metadata/` (immutable run metadata: commit SHA, run ID/attempt, ref, UTC export timestamp, and manifest)
- **Retention window**: 365 days in GitHub Actions artifact storage.
- **System of record**: GitHub Actions run artifacts for the workflow run, linked in quarterly compliance packets.
- **Quarterly archival requirement**: At quarter close, download the latest quarterly bundle and copy it to the compliance repository/archive controlled by Security & Compliance for long-term governance storage.

## CI Runbook: Test Execution & Best Practices

*Source: `operations/ci/ci-runbook.md`*

This runbook documents the CI testing process and introduces checks to keep test quality high.

CI pipeline entry point:


CI pipeline canonical lanes:

- `.github/workflows/pr-fast.yml` — canonical pull-request merge-blocking lane (`pr-fast`).
- `.github/workflows/main-verify.yml` — canonical post-merge verification lane on `main` (`staging-deploy-release-gates`).
- `.github/workflows/nightly-governance.yml` — canonical scheduled governance and diagnostic lane (`nightly-governance`).

- Standard workflow runs `pnpm run ci:verify`.
- The command executes checks in this order: lint → typecheck → test → build.
- Additional CI-only checks (legacy route validation, docs path linting, typecheck telemetry) are included inside `ci:verify`.

Detailed test stages (within or adjacent to `ci:verify`):

1. Lint: `pnpm run lint` — fail fast on style & console usage
2. Typecheck: `pnpm run typecheck:islands` + telemetry — TypeScript type correctness
3. Tests: `pnpm run test` — unit + integration through Turbo
4. Build: `pnpm run build` — production build validation
5. RLS: `pnpm run test:rls` — Supabase policy enforcement checks
6. E2E: `pnpm run test:smoke` — Playwright runs on the running app
7. Security gate lanes now split across `.github/workflows/pr-fast.yml`, `.github/workflows/main-verify.yml`, and `.github/workflows/deploy.yml`: `security-gate` remains a blocker for PR and main verification, while `dast-gate` stays in deploy-time promotion checks. Within `security-gate`, SBOM generation is a required merge check and the lane fails if `sbom.json` is missing or empty.
8. Deployment promotion checks in `.github/workflows/deploy.yml`: `dast-gate` must pass before `build-images`, is required by `preprod-launch-gate`, and is therefore a pre-production blocker before `deploy-production`.

Architecture & operational notes:

- Runs-on: `ubuntu-latest`
- Integration runner uses GitHub Actions services: Postgres 15 & Redis 7
- Use `$GITHUB_ENV` to set `DATABASE_URL` and `REDIS_URL`
- Cloud migration/deploy jobs must target linked hosted Supabase projects and must not require `infra/supabase/config.toml` or local stack state.
- Local Supabase stack usage in CI is optional and allowed only for explicitly scoped checks (for example RLS simulation jobs), with `LOCAL_SUPABASE_ONLY=1` set in that job.
- No production keys are required for local simulation jobs; the CLI can supply local anon/service keys when those optional jobs are enabled.
- Upload artifacts from integration & E2E runs into `test-results/` and `playwright-report/`
- Retention: 14–30 days based on artifact size and workflow cost

Failure handling:

- Unit tests failing blocks the PR immediately.
- Integration tests failing triggers log capture and supabase RLS command-run checks.
- E2E failing triggers application and environment logs capture.

Best practices:

- Keep unit tests fast and deterministic.
- Isolate integration tests with unique fixtures and cleanup.
- Use `supabase test db` when verifying RLS in migration slots.
- Run `npx playwright install --with-deps` before Playwright invocation.
- Limit the Playwright scope in PR pipelines, and use `.github/workflows/nightly-governance.yml` for scheduled accessibility trends and heavy diagnostics.

## Authoritative Workflow Map

Treat the workflow documentation in `.github/workflows/` as the source of truth for lane ownership, trigger semantics, and required checks:

- [Workflow README](../../.github/workflows/README.md)
- [CI Control Matrix](../../.github/workflows/CI_CONTROL_MATRIX.md)

All CI documentation in `docs/operations/` and `docs/security-compliance/` must align to these two files when workflow names, lane names, or required-check contracts change.

---
