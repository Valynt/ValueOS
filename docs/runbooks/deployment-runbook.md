---
title: Deployment Runbook
owner: team-platform
backstage_owner: team:platform-engineering
backstage_system: value-engineering-platform
canonical: ../../DEPLOY.md
note: "See also ops/STAGING_DEPLOY_CHECKLIST.md for the v1 deploy checklist."
escalation_path: "pagerduty://valueos-primary -> slack:#incident-response -> email:platform-leadership@valueos.com"
review_date: 2026-05-31
system: valueos-platform
ops_labels: deployment,release,legacy
status: deprecated
---

> [!WARNING]
> **DEPRECATED**: Use [`docs/operations/runbooks/deployment-runbook.md`](../operations/runbooks/deployment-runbook.md) as the authoritative deployment runbook.

# Deployment Runbook

**Last Updated**: 2026-02-08

**Consolidated from 1 source documents**

---

## Deployment Runbook

*Source: `runbooks/deployment.md`*

**Audience:** Release Captain (primary), On-Call SRE (secondary), Feature Owners (consulted).
**Goal:** Safely promote a release to production with clear ownership and ordering for app + database changes.

## Roles & Responsibilities
- **Release Captain:** Owns decision to deploy/rollback, coordinates comms, triggers pipelines.
- **On-Call SRE:** Monitors health/alerts, executes infrastructure commands, approves rollback if needed.
- **Feature Owners:** Validate smoke tests for their surface areas; provide sign-off on risky migrations.
- **Pre-Production Launch Gate Owners:**
  - **Release Engineering:** owns release-manifest integrity and staging verification artifact review.
  - **On-Call SRE:** owns deployed staging smoke evidence and rollout readiness review.
  - **Platform:** owns DAST, SLO, and error-budget gate outcomes before promotion.
  - **Platform Security:** owns secret-rotation verification evidence.

## Pre-Flight Checklist
1. Feature freeze announced in `#releases` (no new merges after cutoff).
2. Verify pipeline status is green on `main`: https://github.com/ValueCanvas/ValueCanvas/actions/workflows/deploy.yml
3. Confirm changelog and migration list with Feature Owners.
4. Ensure backup completed within last 24h (see `docs/backup-and-dr-playbook.md`).
5. Validate secrets and runtime config: `./scripts/verify-env.sh production`.
6. **Hard Go/No-Go**: `docs/security-compliance/threat-model.md` reviewed for this release (review record completed with security + engineering approvers).

## Runtime Source of Truth
- Production backend runtime is **only** `packages/backend`.
- Release artifact must be built from `infra/docker/Dockerfile.backend` with build arg `APP=@valueos/backend`.
- `apps/ValyntApp/src/services/**` is a frozen duplicate tree and is excluded from runtime ownership except `[migration-sync]` mirror commits.

## Deployment Policy (Workflow-Enforced)

## Canonical Production Release Gates

`deploy-production` is allowed to start only after the following upstream jobs/checks are green for the same commit SHA:

1. **`unit-component-schema`** (`.github/workflows/ci.yml`, check name `unit/component/schema`) — covers lint, typecheck, unit/integration suites, and workflow DAG validation.
2. **`tenant-isolation-gate`** (`.github/workflows/ci.yml`) — covers RLS, tenant-isolation, vector-memory boundary, and DSR suites.
3. **`security-gate`** (`.github/workflows/ci.yml`) — covers SAST, SCA, secret scanning, SBOM generation, and Trivy image/filesystem scans.
4. **`staging-deploy-release-gates`** (`.github/workflows/ci.yml`) — the canonical CI release aggregator that proves the upstream CI gate set is green.
5. **`codeql-analyze (js-ts)`** (`.github/workflows/codeql.yml`) — dedicated CodeQL analysis required by branch protection and release promotion.
6. **`dast-gate`** (`.github/workflows/deploy.yml`) — deploy-time OWASP ZAP baseline gate for the staging target.
7. **`release-manifest-gate`** (`.github/workflows/deploy.yml`) — downloads the `release.yml` manifest bundle for the target SHA, verifies its recorded upstream check conclusions, and exposes immutable image refs for deploy jobs.
8. **`release-gate-contract`** (`.github/workflows/deploy.yml`) — manifest-driven verifier that fails if any required deploy-local gate or recorded upstream release check is missing, skipped, pending past timeout, or unsuccessful.

After the canonical release gate contract is green, `deploy-production` still requires these direct upstream deploy jobs to finish successfully: `deploy-staging`, `staging-performance-benchmarks`, `preprod-slo-guard`, `preprod-launch-gate`, `release-manifest-gate`, `secret-rotation-gate`, `verify-supply-chain`, and `emergency-skip-audit`.

- **Production deployments require the canonical release gate contract to succeed.** `.github/workflows/deploy.yml` now routes production promotion through `release-gate-contract`, which evaluates `scripts/ci/release-gate-manifest.json` and blocks until every required upstream CI/security check for the target SHA is green.
- **Emergency bypass (`skip_tests`) is non-production only.** Use of `skip_tests=true` is blocked for production targets and remains available only for staging emergency recovery.
- **Production bypass requires break-glass workflow.** Any production exception to the canonical release gate set must be executed through a separate break-glass workflow with protected-environment reviewer approval and mandatory post-deploy evidence capture.

## Break-Glass Procedure (Production Only)
1. Open/confirm an active incident record and document scope, blast radius, and customer impact.
2. Trigger the dedicated production break-glass workflow (separate from standard `deploy.yml`) targeting the `production` protected environment.
3. Obtain mandatory approval from protected environment reviewers before rollout begins.
4. Capture and attach required evidence artifacts:
   - incident reference/ticket URL
   - explicit bypass justification
   - post-deploy validation checklist and completion timestamps
5. Execute production deploy and monitor the same smoke/SLO checks listed in this runbook.
6. Complete post-approval follow-up within one business day:
   - document why normal gates were bypassed
   - record remediation actions to restore normal gate compliance
   - file or link corrective backlog items

## Deployment Steps
1. **Tag and build**
   - Create release tag: `git tag -a v<version> -m "Release v<version>" && git push origin v<version>`
   - Trigger deploy workflow (GitHub Actions "Deploy"): https://github.com/ValueCanvas/ValueCanvas/actions/workflows/deploy.yml
2. **Database migrations (ordered)**
   - If migration requires duplicate-tree synchronization, use a dedicated commit containing `[migration-sync]` and mirrored path changes under both backend service trees before tagging release.
   - Apply backward-compatible migrations first:
     ```bash
     supabase db push --file supabase/migrations/2024*-add-columns.sql
     ```
   - Apply breaking migrations only after app pods are updated and read replicas are healthy:
     ```bash
     supabase db push --file supabase/migrations/2024*-drop-columns.sql
     ```
   - Verify schema versions:
     ```sql
     select version, inserted_at from schema_migrations order by inserted_at desc limit 5;
     ```
3. **Application rollout**
   - Confirm deploy workflow built backend artifact from `infra/docker/Dockerfile.backend` (`APP=@valueos/backend`).
   - Deploy via Helm/Kustomize: `kubectl apply -k infra/k8s/overlays/production`
   - Watch rollout status:
     ```bash
     kubectl rollout status deploy/api --timeout=5m
     kubectl rollout status deploy/web --timeout=5m
     kubectl rollout status deploy/worker --timeout=5m
     ```
   - Confirm backend image digest in Kubernetes matches the workflow-produced backend image digest for the release tag.
4. **Smoke tests**
   - API: `npm run test:smoke -- --env production`
   - UI: hit `https://app.valuecanvas.com/health` and confirm `200` + build hash.
   - Run policy checks: `npm run lint:policies` if applicable.
   - **Blocking launch chaos/smoke suite**: `node scripts/chaos/launch-chaos-smoke.mjs` (must pass all three mandatory checks and publish `launch-chaos-results.json`).
5. **Pre-production launch gate (blocking before production deploy)**
   - Workflow job: **Pre-Production Launch Gate** in `.github/workflows/deploy.yml`.
   - This gate runs after staging deploy + pre-prod SLO guard and is required by the production deploy job.
   - Required checks:
     - Staging operational verification artifact matches the release-manifest SHA and immutable image ref.
     - Staging smoke-test evidence has already been published by `deploy-staging`.
     - `dast-gate`, `preprod-slo-guard`, and `error-budget-policy-gate` are green for the deployed staging environment.
   - Ownership:
     - Release Engineering owns release-manifest and staging verification evidence review.
     - On-Call SRE owns smoke-test readiness review.
     - Platform owns DAST and SLO/error-budget outcomes.
     - Platform Security owns the separate `secret-rotation-gate` evidence required before production promotion.
6. **Post-deploy validation**
   - Check Grafana dashboard `00-Prod Overview` for error rates, latency, and queue depth.
   - Validate SLO panels and burn-rate alerts from `docs/operations/monitoring-observability.md#production-slo-framework`:
     - `prod-slo-overview:api-availability-by-segment`
     - `prod-slo-overview:api-p95-latency-by-segment`
     - `prod-slo-overview:api-error-rate-by-segment`
     - Alert UIDs `slo-api-fast-burn`, `slo-api-slow-burn`, and `slo-worker-burn`
   - Review the release-focused Loki error query and Tempo critical-path trace query defined in `docs/operations/monitoring-observability.md` before declaring success.
   - Review Supabase logs for RLS errors using `docs/operations/troubleshooting/rls-failures.md` queries.
   - Announce completion with a link to the workflow run and tag Feature Owners for final sign-off.

## Rollback Decision Signals (Release Captain)
- Treat the rollback signals in `docs/operations/monitoring-observability.md#rollback-signals-release-captain-decision-inputs` as the authoritative triggers.
- Roll back immediately if `alert-slo-burnrate-api-fast` is firing and either the Loki release-errors query or Tempo critical-path query confirms release-correlated failures.
- For tenant/region-localized incidents, halt rollout and roll back only affected region workloads when supported by deployment topology.
- Record rollback decision evidence (panel IDs, alert UIDs, Loki/Tempo query IDs, release hash) in incident timeline before closing the event.

## SLAs
- **P1 (customer-facing outage/security risk):** acknowledge in ≤5 minutes, mitigation/rollback in ≤30 minutes.
- **P2 (degraded feature or single-tenant impact):** acknowledge in ≤15 minutes, mitigation in ≤2 hours.

## Communication Templates
- **Start:** "Deploying v<version> to prod. Expected duration 30 minutes. Release Captain: <name>."
- **Rollback:** "Initiating rollback of v<version> due to <reason>. ETA to restore: 15 minutes."
- **Complete:** "v<version> deployed. Key smoke tests passed: <list>."

---
