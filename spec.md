<<<<<<< HEAD
<<<<<<< HEAD
# Spec: Hardened Production Kubernetes Infrastructure

## Problem Statement

The existing Kubernetes manifests in `infra/k8s/` have partial implementations of HA features that are incomplete, inconsistent, or broken:

- **Blue-Green deployments** exist only for backend, contain duplicate label keys (`version` appears twice in template metadata), and aren't wired into `kustomization.yaml` or the service selector. No frontend blue-green exists.
- **PDB** exists for backend (`minAvailable: 1`) but isn't referenced in `kustomization.yaml`. No frontend PDB exists.
- **HPAs** are duplicated across `hpa.yaml` and `backend-hpa.yaml` with conflicting scaling behaviors.
- **Zero-trust network policies** in `infra/k8s/security/zero-trust-network-policies.yaml` target namespace `valueos` instead of `valynt`, and reference Istio components not present in the base ALB-based setup.
- **Merge conflicts** exist in `backend-deployment.yaml` (unresolved `<<<<<<< HEAD` markers).
- The production overlay uses deprecated `bases:` instead of `resources:`.

This work delivers production-ready HA manifests with blue-green deployments, PDBs, HPAs, and zero-trust network security for both `valynt-backend` and `valynt-frontend`.

## Decisions (from clarification)

| Decision | Choice |
|---|---|
| Production namespace | `valynt` |
| Blue-Green scope | Both backend and frontend |
| Blue-Green mechanism | Separate blue/green services + an `active` service patched during switch |
| Zero-trust approach | Hybrid: native K8s NetworkPolicies (L3/L4) + Istio AuthorizationPolicies (L7) |
| Fix existing issues | Only in files directly touched by this work |
| PDB strategy | Backend: `minAvailable: 2` (of 3 replicas), Frontend: `minAvailable: 1` (of 2 replicas) |

## Requirements

### R1: Fix `backend-deployment.yaml` merge conflicts

Resolve the `<<<<<<< HEAD` / `=======` / `>>>>>>>` markers in `infra/k8s/base/backend-deployment.yaml`. Keep the cost-tracking annotations and the properly indented container spec (the `>>>>>>>` side has correct 2-space nesting under `containers`).

### R2: Blue-Green Deployments for Backend

**Files to modify/create:**
- `infra/k8s/base/backend-blue-deployment.yaml` — fix duplicate `version` label in template metadata, add `slot: blue` label
- `infra/k8s/base/backend-green-deployment.yaml` — fix duplicate `version` label, add `slot: green` label, keep `replicas: 0`
- `infra/k8s/base/backend-service.yaml` — rename to `backend-active-service.yaml`, add `slot: blue` selector (blue is active by default)
- `infra/k8s/base/backend-blue-service.yaml` — new, selects `app: backend, slot: blue`
- `infra/k8s/base/backend-green-service.yaml` — new, selects `app: backend, slot: green`

**Blue-Green switch mechanism:**
- The `backend-active` service selector gets patched from `slot: blue` to `slot: green` (or vice versa) during deployment
- Blue and green services exist for direct testing of each slot before switching
- Both blue and green deployments share the same env vars, security context, probes, and resource config from the base `backend-deployment.yaml` pattern

### R3: Blue-Green Deployments for Frontend

**Files to create:**
- `infra/k8s/base/frontend-blue-deployment.yaml` — based on existing `frontend-deployment.yaml`, with `slot: blue` label, `replicas: 2`
- `infra/k8s/base/frontend-green-deployment.yaml` — same but `slot: green`, `replicas: 0`
- `infra/k8s/base/frontend-active-service.yaml` — replaces `frontend-service.yaml`, selects `app: frontend, slot: blue`
- `infra/k8s/base/frontend-blue-service.yaml` — selects `app: frontend, slot: blue`
- `infra/k8s/base/frontend-green-service.yaml` — selects `app: frontend, slot: green`

### R4: Pod Disruption Budgets

**Backend PDB** (`infra/k8s/base/backend-pdb.yaml` — modify existing):
- `minAvailable: 2` (ensures 2 of 3 production replicas stay up during voluntary disruptions)
- Selector: `app: backend` (covers both blue and green pods)

**Frontend PDB** (`infra/k8s/base/frontend-pdb.yaml` — new):
- `minAvailable: 1` (ensures 1 of 2 production replicas stays up)
- Selector: `app: frontend`

### R5: Horizontal Pod Autoscalers

Consolidate the duplicate HPA files. Remove `infra/k8s/base/backend-hpa.yaml` (the standalone one). Keep and update `infra/k8s/base/hpa.yaml` as the single source of truth containing both backend and frontend HPAs.

**Backend HPA** (targets `backend-blue` deployment — the active slot):
- `minReplicas: 2`, `maxReplicas: 10`
- CPU target: 70% utilization
- Memory target: 80% utilization
- Scale-down: stabilization 300s, max 10% per 60s
- Scale-up: stabilization 60s, max 50% or 2 pods per 60s

**Frontend HPA** (targets `frontend-blue` deployment):
- `minReplicas: 2`, `maxReplicas: 5`
- CPU target: 70% utilization
- Scale-down: stabilization 300s
- Scale-up: stabilization 0s

Note: HPAs target the blue deployments by default. During a blue-green switch, the HPA `scaleTargetRef` must be updated to point to the newly active deployment. This is a deployment-time concern, not a manifest concern — document it in a comment.

### R6: Zero-Trust Network Policies (L3/L4)

Update `infra/k8s/security/zero-trust-network-policies.yaml` to target namespace `valynt` instead of `valueos`. The file contains 6 policies:

1. **`zero-trust-default-deny`** — deny all ingress/egress by default (namespace-wide). Change namespace to `valynt`.
2. **`allow-ingress-from-gateway`** — allow ingress to `app.kubernetes.io/component: api` from Istio ingress gateway. Change namespace to `valynt`. Add a second ingress rule allowing traffic from the `ingress-nginx` namespace (for ALB compatibility).
3. **`tenant-isolation-policy`** — change namespace to `valynt`.
4. **`service-mesh-isolation`** — change namespace to `valynt`.
5. **`allow-dns-resolution`** — change namespace to `valynt`.
6. **`allow-monitoring-traffic`** — change namespace to `valynt`.

Additionally, add new L3/L4 policies for the blue-green setup:
- Allow the active service to reach blue and green pods on their respective ports
- Allow ingress controller to reach the active services (backend port 8000, frontend port 80)

### R7: Istio Authorization Policies (L7)

The existing Istio policies in `infra/k8s/security/istio-service-mesh.yaml` and `mesh-authentication.yaml` already target `valueos`. Update namespace references to `valynt` in these files since they are directly related to the zero-trust security posture being applied.

### R8: Update Kustomization

Update `infra/k8s/base/kustomization.yaml` to reference:
- Blue/green deployment files for both services (replacing the single deployment files)
- Active + blue + green service files for both services
- PDB files for both services
- The consolidated `hpa.yaml`
- Remove references to the old single deployment and service files
- Remove `backend-hpa.yaml` reference (consolidated into `hpa.yaml`)

Update `infra/k8s/overlays/production/kustomization.yaml`:
- Change `bases:` to `resources:` (fix deprecated syntax)
- Update replica references to target blue deployments (`backend-blue`, `frontend-blue`)
- Add the security policies as additional resources

### R9: Production Overlay Patches

Update `infra/k8s/overlays/production/deployment-patch.yaml` to target the blue deployment names (`backend-blue`, `frontend-blue`) instead of `backend` and `frontend`.

## Files Changed (Summary)

### Modified
| File | Change |
|---|---|
| `infra/k8s/base/backend-deployment.yaml` | Resolve merge conflicts |
| `infra/k8s/base/backend-blue-deployment.yaml` | Fix duplicate `version` label, add `slot: blue` |
| `infra/k8s/base/backend-green-deployment.yaml` | Fix duplicate `version` label, add `slot: green` |
| `infra/k8s/base/backend-pdb.yaml` | Change `minAvailable` from 1 to 2 |
| `infra/k8s/base/hpa.yaml` | Update scaleTargetRef to `backend-blue` and `frontend-blue`, add HPA comment about blue-green switching |
| `infra/k8s/base/kustomization.yaml` | Add all new resources, remove old single-deployment references |
| `infra/k8s/security/zero-trust-network-policies.yaml` | Change all namespaces from `valueos` to `valynt`, add ALB ingress rule |
| `infra/k8s/security/istio-service-mesh.yaml` | Change namespaces from `valueos` to `valynt` |
| `infra/k8s/security/mesh-authentication.yaml` | Already targets `valynt` — no change needed |
| `infra/k8s/overlays/production/kustomization.yaml` | Fix `bases:` to `resources:`, update replica targets |
| `infra/k8s/overlays/production/deployment-patch.yaml` | Target blue deployment names |

### Created
| File | Purpose |
|---|---|
| `infra/k8s/base/backend-active-service.yaml` | Active backend service with `slot: blue` selector |
| `infra/k8s/base/backend-blue-service.yaml` | Direct access to blue backend pods |
| `infra/k8s/base/backend-green-service.yaml` | Direct access to green backend pods |
| `infra/k8s/base/frontend-blue-deployment.yaml` | Blue frontend deployment |
| `infra/k8s/base/frontend-green-deployment.yaml` | Green frontend deployment |
| `infra/k8s/base/frontend-active-service.yaml` | Active frontend service with `slot: blue` selector |
| `infra/k8s/base/frontend-blue-service.yaml` | Direct access to blue frontend pods |
| `infra/k8s/base/frontend-green-service.yaml` | Direct access to green frontend pods |
| `infra/k8s/base/frontend-pdb.yaml` | Frontend PDB with `minAvailable: 1` |

### Deleted
| File | Reason |
|---|---|
| `infra/k8s/base/backend-hpa.yaml` | Consolidated into `hpa.yaml` |
| `infra/k8s/base/backend-service.yaml` | Replaced by `backend-active-service.yaml` |
| `infra/k8s/base/frontend-deployment.yaml` | Replaced by blue/green deployments |
| `infra/k8s/base/frontend-service.yaml` | Replaced by `frontend-active-service.yaml` |

## Out of Scope

- Updating CI/CD workflows (`deploy-to-k8s.yml`, `canary-deployment.yml`) to use the new blue-green mechanism — those reference `valuecanvas-*` namespaces and are a separate concern
- Creating a blue-green switch script/automation — the manifests define the mechanism; orchestration is a follow-up
- Fixing merge conflicts or issues in files not touched by this work
- Terraform changes
- Staging overlay updates (only production overlay is in scope per the request)

## Acceptance Criteria

1. **No merge conflicts**: `backend-deployment.yaml` has no `<<<<<<<` / `=======` / `>>>>>>>` markers
2. **Blue-Green backend**: `backend-blue-deployment.yaml` and `backend-green-deployment.yaml` exist with correct labels (`slot: blue`/`slot: green`), no duplicate label keys, and green starts at 0 replicas
3. **Blue-Green frontend**: `frontend-blue-deployment.yaml` and `frontend-green-deployment.yaml` exist with correct labels, green starts at 0 replicas
4. **Service switch mechanism**: For each service (backend, frontend), three Service resources exist: `*-active` (selects active slot), `*-blue`, `*-green`. Active services default to `slot: blue`
5. **Backend PDB**: `minAvailable: 2`, selector matches `app: backend`
6. **Frontend PDB**: `minAvailable: 1`, selector matches `app: frontend`
7. **HPAs**: Single `hpa.yaml` with backend HPA (2-10 replicas, CPU 70%, memory 80%) and frontend HPA (2-5 replicas, CPU 70%), both targeting blue deployments
8. **Zero-trust policies**: All policies in `zero-trust-network-policies.yaml` target namespace `valynt`. Default-deny is present. ALB ingress rule is added alongside Istio gateway rule.
9. **Istio L7 policies**: `istio-service-mesh.yaml` targets namespace `valynt`
10. **Kustomization**: `base/kustomization.yaml` references all new files. `backend-hpa.yaml` is removed. Production overlay uses `resources:` not `bases:`.
11. **YAML validity**: All manifests pass `kubectl apply --dry-run=client` syntax (validated via `kustomize build` on the base directory)
12. **Ingress**: `ingress.yaml` backend references `backend-active` service, frontend references `frontend-active` service

## Implementation Approach

### Phase 1: Fix existing issues in touched files
1. Resolve merge conflicts in `backend-deployment.yaml`
2. Fix duplicate `version` labels in blue/green backend deployments

### Phase 2: Blue-Green deployment manifests
3. Update `backend-blue-deployment.yaml` with `slot: blue` label
4. Update `backend-green-deployment.yaml` with `slot: green` label
5. Create `frontend-blue-deployment.yaml` from existing `frontend-deployment.yaml` + `slot: blue`
6. Create `frontend-green-deployment.yaml` with `slot: green`, `replicas: 0`

### Phase 3: Service switch mechanism
7. Create `backend-active-service.yaml`, `backend-blue-service.yaml`, `backend-green-service.yaml`
8. Create `frontend-active-service.yaml`, `frontend-blue-service.yaml`, `frontend-green-service.yaml`
9. Update `ingress.yaml` to reference active services

### Phase 4: PDBs and HPAs
10. Update `backend-pdb.yaml` to `minAvailable: 2`
11. Create `frontend-pdb.yaml` with `minAvailable: 1`
12. Consolidate HPAs into `hpa.yaml`, targeting blue deployments
13. Delete `backend-hpa.yaml`

### Phase 5: Zero-Trust Network Security
14. Update `zero-trust-network-policies.yaml` namespaces to `valynt`, add ALB ingress rule
15. Update `istio-service-mesh.yaml` namespaces to `valynt`

### Phase 6: Kustomization and Overlay updates
16. Update `base/kustomization.yaml` with all new resources
17. Update production overlay (`kustomization.yaml` and `deployment-patch.yaml`)
18. Delete replaced files (`backend-service.yaml`, `frontend-service.yaml`, `frontend-deployment.yaml`, `backend-hpa.yaml`)

### Phase 7: Validation
19. Run `kustomize build infra/k8s/base/` to verify base builds
20. Run `kustomize build infra/k8s/overlays/production/` to verify production overlay builds
21. Verify no YAML syntax errors across all modified/created files
=======
# Security Automation Pipeline — Spec

**Date:** 2026-02-09
**Epic:** Security Infrastructure
**Status:** Draft

---

## Problem Statement

The ValueOS CI/CD pipeline has security scanning spread across 7+ workflow files with significant tool overlap and inconsistent enforcement:

| Workflow | Tools | Overlap |
|---|---|---|
| `security-scan.yml` | CodeQL, Semgrep, Trivy (fs+image), TruffleHog, Checkov, npm audit | Trivy #1, TruffleHog #1, Checkov #1 |
| `secure-ci.yml` | git-secrets, TruffleHog, SBOM, Snyk, Trivy | Trivy #2, TruffleHog #2 |
| `security-gate.yml` | GitHub code scanning API, Dependabot API | — |
| `production-security.yml` | Trivy (fs+image), Hadolint | Trivy #3 |
| `terraform-security-scan.yml` | tfsec, Checkov, Trivy IaC | Checkov #2, Trivy #4 |
| `release-security-gate.yml` | SBOM, pnpm audit | SBOM #2 |
| `security-agent.yml` | Custom Node.js scanner (every 30 min) | — |

Additionally:
- Pre-commit hooks are disabled (`exit 0`), so secrets can reach the remote before CI catches them.
- The security gate blocks on P0/P1 code scanning alerts but does not enforce zero-tolerance on detected secrets.
- No rotation failure monitoring/alerting exists despite rotation infrastructure being in place.

## Scope

### In Scope

1. **Replace all 7 security workflows** with a single unified `security-pipeline.yml`.
2. **Enable pre-commit secret scanning** via gitleaks in `.husky/pre-commit`.
3. **Add rotation failure monitoring** — a GitHub Actions workflow that checks rotation health and alerts on failures.
4. **Remove the 7 replaced workflow files** from `.github/workflows/`.

### Out of Scope

- DAST scanning (deferred — no persistent scan target available).
- Building new rotation services (existing `RotationService.ts`, `SecretRotationScheduler.ts`, K8s CronJob, and `/api/security/rotate-keys` are sufficient).
- Changes to the `security-agent` code in `.github/security-agent/` (it will be removed along with its workflow).
- Changes to `pr-validation.yml` (it has its own TruffleHog step that will become redundant; noted for future cleanup but not in this scope to avoid breaking the PR validation summary job).

---

## Requirements

### R1: Unified Security Pipeline (`security-pipeline.yml`)

Replace all 7 existing security workflows with a single file containing these jobs:

#### R1.1: Secret Detection (PR-blocking, zero tolerance)
- **Tool:** TruffleHog (single instance, replaces 2 duplicates)
- **Trigger:** `pull_request` to `main`/`develop`, `push` to `main`/`develop`
- **Behavior:** Scan diff between base and head. Fail the job on any verified secret. This is a **hard block** — no `continue-on-error`.
- **SARIF:** Not applicable (TruffleHog uses `--fail` flag directly).

#### R1.2: SAST — CodeQL
- **Tool:** CodeQL (`github/codeql-action` v3)
- **Languages:** `javascript-typescript` (single matrix entry — the existing `python` entry is unnecessary since the repo has no Python application code; `check_errors.py` is a one-off script)
- **Queries:** `security-extended,security-and-quality`
- **Trigger:** `pull_request`, `push` to `main`/`develop`, weekly schedule
- **SARIF:** Upload to GitHub Security tab

#### R1.3: SAST — Semgrep
- **Tool:** Semgrep CI (`semgrep ci --config=auto`)
- **Trigger:** Same as CodeQL
- **SARIF:** Upload to GitHub Security tab

#### R1.4: Dependency Audit
- **Tool:** `pnpm audit --audit-level=high` + `actions/dependency-review-action` (on PRs)
- **Trigger:** `pull_request`, `push` to `main`/`develop`
- **Behavior:** `dependency-review-action` blocks on `moderate+` severity and denies `GPL-3.0`/`AGPL-3.0` licenses. `pnpm audit` runs as informational (non-blocking) since Dependabot handles remediation.
- **SBOM:** Generate CycloneDX SBOM via existing `pnpm run security:sbom` script. Upload as artifact.

#### R1.5: Container Vulnerability Scanning
- **Tool:** Trivy (single instance, replaces 4 duplicates)
- **Scans:**
  1. Filesystem scan (`scan-type: fs`) — catches vulnerabilities in source/config files
  2. Build + scan backend image (`infra/docker/Dockerfile.backend`)
  3. Build + scan frontend image (`infra/docker/Dockerfile.frontend`)
- **Trigger:** `pull_request`, `push` to `main`/`develop`
- **Severity:** `CRITICAL,HIGH` (block on critical for image scans, report high)
- **SARIF:** Upload all three scan results to GitHub Security tab with distinct categories

#### R1.6: Infrastructure as Code Scanning
- **Tool:** Checkov (single instance, replaces 2 duplicates)
- **Target:** `infra/terraform/`
- **Trigger:** `pull_request` (paths: `infra/terraform/**`), `push` to `main`/`develop` (paths: `infra/terraform/**`), weekly schedule
- **SARIF:** Upload to GitHub Security tab
- **Note:** tfsec is deprecated in favor of Trivy IaC scanning. Drop tfsec; use Checkov + Trivy IaC config scan instead.

#### R1.7: Dockerfile Linting
- **Tool:** Hadolint
- **Target:** `infra/docker/Dockerfile.backend`, `infra/docker/Dockerfile.frontend`
- **Trigger:** `pull_request`, `push` to `main`/`develop`

#### R1.8: Security Gate (summary job)
- **Depends on:** All above jobs
- **Behavior:**
  - **Hard fail** if: secret detection failed OR critical container vulnerabilities found
  - **Hard fail** if: CodeQL or Semgrep found critical/high severity findings (checked via GitHub code scanning API, same as current `security-gate.yml`)
  - **Warn** on: Dependabot high alerts, medium SAST findings
- **Output:** GitHub Step Summary with table of all scan results
- **PR Comment:** Post summary comment on PRs (using `actions/github-script`)

#### R1.9: Workflow Structure
- **Concurrency:** `group: security-${{ github.ref }}`, `cancel-in-progress: true` (for PRs)
- **Permissions:** Minimal per-job (`contents: read`, `security-events: write` only where needed)
- **Caching:** Single pnpm cache setup shared via a reusable setup step

### R2: Pre-commit Secret Scanning

#### R2.1: Gitleaks Pre-commit Hook
- **Tool:** gitleaks (lightweight, fast, works offline)
- **Install:** Add `gitleaks` binary check to `.husky/pre-commit`. If not installed, print install instructions and skip (don't block developers who haven't installed it).
- **Behavior:** Run `gitleaks protect --staged --no-banner` on staged files only.
- **Config:** Create `.gitleaks.toml` at repo root with:
  - Allowlist for `.env.example`, `.env.ports.example`, test fixtures
  - Rules for common secret patterns (AWS keys, JWT tokens, API keys with known prefixes like `sk_live_`, `whsec_`, `sk-`, `together_`)

#### R2.2: Pre-push Hook
- Update `.husky/pre-push` to run `gitleaks detect --no-banner --log-opts="origin/main..HEAD"` as a second layer.

### R3: Rotation Failure Monitoring

#### R3.1: Rotation Health Check Workflow
- **File:** `.github/workflows/rotation-monitor.yml`
- **Trigger:** `schedule` (daily at 06:00 UTC, after the K8s CronJob runs at 04:00 UTC)
- **Behavior:**
  1. Call the existing `/api/security/rotate-keys` GET endpoint (against staging/production URL) to retrieve rotation history
  2. Check that the most recent rotation for each provider occurred within the expected interval (90 days for API keys, 180 days for Supabase, per existing config)
  3. If any rotation is overdue or the last rotation failed: create a GitHub issue with label `security` and `rotation-failure`
  4. If a Slack webhook is configured (`vars.SLACK_WEBHOOK_URL`), send an alert
- **Secrets needed:** `ROTATION_HEALTH_CHECK_URL` (the base URL of the staging/production API)

### R4: Cleanup

Remove these workflow files (replaced by `security-pipeline.yml`):
1. `.github/workflows/security-scan.yml`
2. `.github/workflows/security-gate.yml`
3. `.github/workflows/secure-ci.yml`
4. `.github/workflows/production-security.yml`
5. `.github/workflows/terraform-security-scan.yml`
6. `.github/workflows/release-security-gate.yml`
7. `.github/workflows/security-agent.yml`

Remove the security-agent directory (its functionality is subsumed by the unified pipeline):
8. `.github/security-agent/` (entire directory)

Update references:
9. `.github/workflows/ci.yml` — change `security-gate` job to reference the new `security-pipeline.yml` instead of the deleted `security-gate.yml`

---

## Files Changed

| Action | File | Purpose |
|---|---|---|
| Create | `.github/workflows/security-pipeline.yml` | Unified security scanning pipeline |
| Create | `.github/workflows/rotation-monitor.yml` | Rotation health check + alerting |
| Create | `.gitleaks.toml` | Gitleaks configuration with allowlists |
| Modify | `.husky/pre-commit` | Enable gitleaks secret scanning on staged files |
| Modify | `.husky/pre-push` | Enable gitleaks detection on unpushed commits |
| Modify | `.github/workflows/ci.yml` | Update security-gate reference |
| Delete | `.github/workflows/security-scan.yml` | Replaced by security-pipeline.yml |
| Delete | `.github/workflows/security-gate.yml` | Replaced by security-pipeline.yml |
| Delete | `.github/workflows/secure-ci.yml` | Replaced by security-pipeline.yml |
| Delete | `.github/workflows/production-security.yml` | Replaced by security-pipeline.yml |
| Delete | `.github/workflows/terraform-security-scan.yml` | Replaced by security-pipeline.yml |
| Delete | `.github/workflows/release-security-gate.yml` | Replaced by security-pipeline.yml |
| Delete | `.github/workflows/security-agent.yml` | Replaced by security-pipeline.yml |
| Delete | `.github/security-agent/` | Custom scanner replaced by standard tools |

**Total: 4 created/modified, 8 deleted, 2 modified**

---
=======
# Spec: Operational Observability — PGLT Stack Deployment

## Problem Statement

The ValueOS codebase has partial, fragmented observability infrastructure:

- **Two competing docker-compose files** for observability (one Jaeger-based, one PGLT-based) — neither fully functional
- **Two metrics systems** (prom-client + OTel SDK) with metric name mismatches against alert rules
- **No log shipping** — Loki is configured but nothing sends logs to it
- **No OTel Collector** — referenced in compose but config file is missing; app exports directly to backends
- **No resource metrics** — Prometheus config references node-exporter but no container exists
- **Alertmanager disabled** — alert rules exist but have no receiver
- **No "Mission Control" dashboard** — existing dashboards cover individual concerns but no SLO overview
- **`lib/observability/index.ts` is all no-ops** — doesn't connect to prom-client or OTel

The goal is a working, end-to-end observability stack where: traces flow through Tempo, metrics are scraped by Prometheus, logs aggregate in Loki, and Grafana provides a unified Mission Control dashboard with SLO tracking and automated alerts.

## Design Decisions (Assumptions)

Since all clarifying questions were skipped, these defaults apply. Each can be revisited before implementation begins.

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Consolidate to PGLT — remove Jaeger** | Tempo is already configured, Jaeger is redundant. One tracing backend simplifies the stack. |
| 2 | **Add OTel Collector** | Central pipeline enables routing, sampling, batching. Decouples app from backend topology. Required for log shipping via OTLP. |
| 3 | **Unify metrics to prom-client** | prom-client already works with `/metrics` endpoint. Rename metrics to match SLO alert PromQL (`valuecanvas_http_*`). Use OTel only for tracing. Simpler than migrating everything to OTel metrics. |
| 4 | **Add Promtail for log shipping** | Lightweight, purpose-built for Loki. Scrapes Docker container logs via volume mount. No app-level changes needed. |
| 5 | **Single "Mission Control" dashboard** | One dashboard with rows: SLO overview, API latency, error rates, resource pressure. Links to existing detailed dashboards. |
| 6 | **Add node-exporter for resource metrics** | Provides CPU, memory, disk, network. Lightweight single container. cAdvisor adds complexity without proportional value for local dev. |
| 7 | **Use Grafana unified alerting** | Simpler than adding Alertmanager container. Grafana can evaluate Prometheus alert rules directly and show alerts in the UI. Sufficient for dev; Alertmanager can be added later for production routing. |
| 8 | **Canonical compose: `infra/docker/docker-compose.observability.yml`** | Consistent with other compose files in that directory. Delete the Jaeger-based `infra/docker-compose.observability.yml`. |

## Requirements

### R1: Docker Compose — Unified PGLT Stack

**File:** `infra/docker/docker-compose.observability.yml`

Services to include:
- **Grafana** (10.2.x) — dashboards, alerting, datasource provisioning
- **Prometheus** (v2.47.x) — metrics scraping, alert rule evaluation
- **Loki** (2.9.x) — log aggregation
- **Tempo** (2.3.x) — distributed tracing
- **OTel Collector** (contrib 0.91.x) — central telemetry pipeline
- **Promtail** (2.9.x) — Docker log scraping → Loki
- **node-exporter** (1.7.x) — host/system resource metrics

Remove:
- Delete `infra/docker-compose.observability.yml` (Jaeger-based)
- Remove all Jaeger references from compose files

Networking:
- All services on a shared `observability-net` bridge network
- Backend app connects via `host.docker.internal` or shared network

### R2: OTel Collector Configuration

**File:** `infra/observability/otel-collector-config.yaml`

Pipeline:
- **Receivers:** OTLP (gRPC :4317, HTTP :4318)
- **Processors:** batch, memory_limiter
- **Exporters:**
  - Traces → Tempo (OTLP gRPC)
  - Metrics → Prometheus (prometheus exporter on :8889)
  - (Logs are handled by Promtail, not the collector)

### R3: Promtail Configuration

**File:** `infra/observability/promtail/promtail-config.yaml`

- Scrape Docker container logs via `/var/lib/docker/containers`
- Add labels: `container_name`, `service`, `compose_service`
- Pipeline stages: JSON parsing, timestamp extraction, label extraction for `level`, `component`, `trace_id`
- Ship to Loki at `http://loki:3100/loki/api/v1/push`

### R4: Metrics Unification

**Files:**
- `packages/backend/src/lib/metrics/httpMetrics.ts`
- `packages/backend/src/middleware/metricsMiddleware.ts`
- `packages/backend/src/lib/observability/index.ts`

Changes:
1. Rename prom-client histogram from `http_request_duration_seconds` → `valuecanvas_http_request_duration_ms` (milliseconds, matching SLO PromQL)
   - Update bucket boundaries accordingly (from seconds to ms: `[5, 10, 25, 50, 100, 200, 500, 1000, 2000, 5000]`)
2. Add prom-client counter `valuecanvas_http_requests_total` with labels `{method, route, status_code}`
3. Replace no-op implementations in `lib/observability/index.ts` with real prom-client wrappers that delegate to the shared registry
4. Ensure `/metrics` endpoint exposes all metrics from the unified registry

### R5: Backend OTel Tracing — Wire to Collector

**File:** `packages/backend/src/config/telemetry.ts`

Changes:
1. Update `OTLP_ENDPOINT` default from `http://localhost:4318` → `http://otel-collector:4318` (or keep localhost for non-Docker dev, configurable via env)
2. Remove OTel metric reader/exporter (metrics handled by prom-client)
3. Keep OTel tracing SDK with auto-instrumentation (HTTP, Express, PG, Redis)
4. Ensure `trace_id` is injected into structured log output (already partially done via `getTraceContextForLogging`)

### R6: Logger — Trace Correlation

**File:** `packages/backend/src/lib/logger.ts`

Changes:
1. Import `getTraceContextForLogging` from telemetry config
2. Automatically inject `trace_id` and `span_id` into every log entry
3. This enables Loki → Tempo correlation via the derived field already configured in Grafana datasources

### R7: Prometheus Configuration Update

**File:** `infra/observability/prometheus/prometheus.yml`

Changes:
1. Add scrape target for OTel Collector metrics exporter (`otel-collector:8889`)
2. Add scrape target for node-exporter (`node-exporter:9100`)
3. Update `valueos-app` target to point to backend's `/metrics` endpoint (correct host/port)
4. Enable `rule_files` to load alert rules
5. Remove kubernetes_sd_configs (not applicable for local dev compose)
6. Enable `--web.enable-remote-write-receiver` for Tempo's metrics_generator remote_write

### R8: Prometheus Alert Rules — Fix and Extend

**Files:**
- `infra/prometheus/alerts/slo-alerts.yml`
- `infra/prometheus/alerts/backend-api-alerts.yml`

Changes:
1. Verify metric names match R4 renames (all should use `valuecanvas_http_*`)
2. Add resource pressure alerts:
   - `HighCPUUsage`: `node_cpu_seconds_total` idle < 20% for 5m → warning
   - `HighMemoryUsage`: `node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes` < 10% for 5m → warning
   - `HighDiskUsage`: `node_filesystem_avail_bytes / node_filesystem_size_bytes` < 10% → warning
3. Copy alert rule files into the Prometheus container via volume mount in compose

### R9: Grafana — Mission Control Dashboard

**File:** `infra/observability/grafana/dashboards/mission-control.json`

Dashboard structure (single dashboard, multiple rows):

**Row 1: SLO Overview**
- Stat panels: Current P95 latency (vs 200ms target), Error rate (vs 0.1% target), MTTR
- Gauge panels with thresholds (green/yellow/red)

**Row 2: API Latency**
- Time series: P50/P95/P99 latency over time by route
- Heatmap: Request duration distribution

**Row 3: Error Rates**
- Time series: 5xx rate over time
- Time series: Error rate by route
- Table: Top error routes (last 1h)

**Row 4: System Resource Pressure**
- Time series: CPU usage %
- Time series: Memory usage %
- Time series: Disk usage %
- Time series: Network I/O

**Row 5: Log Stream (Loki)**
- Logs panel: Recent error/warn logs from backend
- Link to Explore for full log search

Variables:
- `$interval` (auto, 1m, 5m, 15m, 1h)
- `$service` (valueos-backend, etc.)

### R10: Grafana Provisioning

**Files:**
- `infra/observability/grafana/datasources.yml` (already exists, verify correctness)
- `infra/observability/grafana/dashboards/dashboard-provider.yml` (new — tells Grafana to load JSON dashboards from disk)

Changes:
1. Create dashboard provider config that loads from `/var/lib/grafana/dashboards/`
2. Mount `infra/observability/grafana/dashboards/` into Grafana container
3. Mount datasources.yml into provisioning directory
4. Enable Grafana unified alerting via env var `GF_UNIFIED_ALERTING_ENABLED=true`

### R11: Update Scripts and Makefile

**Files:**
- `scripts/Makefile.observability` — update compose file path, add Promtail/node-exporter log targets
- `scripts/verify-observability.sh` — add health checks for OTel Collector, Promtail, node-exporter

### R12: Cleanup

- Delete `infra/docker-compose.observability.yml` (Jaeger-based, replaced by R1)
- Remove Jaeger port references from any documentation
- Update `docs/developer-experience/dev-environment.md` Jaeger UI reference → Grafana/Tempo

## Out of Scope

- Production deployment (Kubernetes, Terraform) — this is local dev stack only
- Alertmanager with external notification channels (Slack, PagerDuty)
- Frontend (browser) telemetry
- cAdvisor container metrics
- Custom business metric dashboards (agent perf, LLM, etc. already exist)
- CI workflow changes (existing `observability-tests.yml` will work once stack is correct)
>>>>>>> 1d940125 (feat(observability): consolidate observability stack to PGLT, add Promtail for log shipping, and unify metrics)

## Acceptance Criteria

All criteria must pass for the implementation to be considered complete.

<<<<<<< HEAD
### AC1: Unified Pipeline Exists and Is Syntactically Valid
- [ ] `.github/workflows/security-pipeline.yml` exists and passes `actionlint` (or manual YAML validation)
- [ ] Contains jobs: `secret-detection`, `codeql`, `semgrep`, `dependency-audit`, `container-scan`, `iac-scan`, `dockerfile-lint`, `security-gate`
- [ ] Triggers on: `pull_request` (main, develop), `push` (main, develop), `schedule` (weekly)

### AC2: Old Workflows Removed
- [ ] All 7 listed workflow files are deleted
- [ ] `.github/security-agent/` directory is deleted
- [ ] `.github/workflows/ci.yml` references `security-pipeline.yml` instead of `security-gate.yml`

### AC3: Secret Detection Is Zero-Tolerance
- [ ] TruffleHog job uses `--fail` flag and does NOT have `continue-on-error: true`
- [ ] The `security-gate` summary job hard-fails if `secret-detection` job failed

### AC4: SARIF Uploads Are Deduplicated
- [ ] Trivy uploads use distinct `category` values (`trivy-fs`, `trivy-backend-image`, `trivy-frontend-image`)
- [ ] CodeQL uploads use `category: /language:javascript-typescript`
- [ ] Semgrep uploads use a distinct category
- [ ] Checkov uploads use `category: checkov`
- [ ] No duplicate SARIF uploads across jobs

### AC5: Pre-commit Hook Scans for Secrets
- [ ] `.husky/pre-commit` runs `gitleaks protect --staged` when gitleaks is installed
- [ ] `.husky/pre-commit` prints install instructions and continues (does not block) when gitleaks is not installed
- [ ] `.gitleaks.toml` exists with allowlists for `.env.example`, `.env.ports.example`, and test fixtures

### AC6: Pre-push Hook Scans for Secrets
- [ ] `.husky/pre-push` runs `gitleaks detect` on commits not yet pushed to origin/main

### AC7: Rotation Monitor Exists
- [ ] `.github/workflows/rotation-monitor.yml` exists
- [ ] Runs on a daily schedule
- [ ] Checks rotation recency against configured intervals
- [ ] Creates a GitHub issue on failure (with `security` + `rotation-failure` labels)
- [ ] Optionally sends Slack alert if webhook is configured

### AC8: Blocking Policy Is Correct
- [ ] Secrets: zero tolerance (hard block)
- [ ] SAST critical/high: hard block (via code scanning API check)
- [ ] Container critical: hard block (Trivy `--exit-code 1`)
- [ ] Dependabot high: warning only
- [ ] Medium/low findings: informational only

### AC9: No Functional Regression
- [ ] The `ci.yml` workflow still calls a security gate and the gate job name matches what branch protection rules expect
- [ ] SBOM generation still works (`pnpm run security:sbom`)
- [ ] All SARIF results still appear in the GitHub Security tab

---

## Implementation Approach

### Phase 1: Create new files (non-breaking)
1. Create `.gitleaks.toml` configuration
2. Create `.github/workflows/security-pipeline.yml` with all jobs
3. Create `.github/workflows/rotation-monitor.yml`

### Phase 2: Update hooks and references
4. Update `.husky/pre-commit` with gitleaks scanning
5. Update `.husky/pre-push` with gitleaks detection
6. Update `.github/workflows/ci.yml` to reference the new pipeline

### Phase 3: Remove old files
7. Delete the 7 old workflow files
8. Delete `.github/security-agent/` directory

### Validation
9. Run `yamllint` or equivalent on all new/modified YAML files
10. Verify the pre-commit hook works locally (with and without gitleaks installed)
11. Verify the workflow YAML is structurally valid

---

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Branch protection rules reference old workflow job names | `ci.yml` is updated to call the new pipeline; the gate job name is preserved as `security-gate` |
| Developers without gitleaks installed are blocked | Pre-commit gracefully skips with install instructions |
| Rotation monitor can't reach production API | Uses a configurable secret (`ROTATION_HEALTH_CHECK_URL`); fails gracefully with issue creation |
| Removing security-agent breaks something | The agent runs on a 30-min cron and posts to issues; the unified pipeline covers the same scanning on every PR/push, which is more timely |

---

## Completion Criteria (Ralph Loop)

The Ralph loop is done when:
1. All files listed in "Files Changed" are created, modified, or deleted as specified
2. All 9 acceptance criteria (AC1–AC9) are satisfied
3. YAML validation passes on all new/modified workflow files
4. The pre-commit hook is manually testable (runs gitleaks or prints instructions)
>>>>>>> dbcbcfd157e7b7ef8796374919b84cfcf917e6e8
=======
### AC1: Stack Boots Successfully
```bash
docker compose -f infra/docker/docker-compose.observability.yml up -d
# All 7 containers reach "healthy" status within 60 seconds:
# grafana, prometheus, loki, tempo, otel-collector, promtail, node-exporter
```

### AC2: Traces Flow End-to-End
1. Start the backend (`pnpm run dev` or equivalent)
2. Make an HTTP request to any API endpoint
3. Trace appears in Grafana → Explore → Tempo
4. Trace shows spans for HTTP handler, database query (if applicable), and Redis (if applicable)

### AC3: Metrics Are Scraped
1. `curl http://localhost:<backend-port>/metrics` returns Prometheus text format
2. Output includes `valuecanvas_http_request_duration_ms_bucket` and `valuecanvas_http_requests_total`
3. Prometheus targets page (`http://localhost:9090/targets`) shows `valueos-app`, `otel-collector`, `node-exporter` as UP

### AC4: Logs Aggregate in Loki
1. Backend produces structured JSON logs to stdout
2. Logs appear in Grafana → Explore → Loki within 30 seconds
3. Logs contain `trace_id` field
4. Clicking a `trace_id` in Loki navigates to the corresponding trace in Tempo

### AC5: Mission Control Dashboard Loads
1. Open Grafana → Dashboards → Mission Control
2. Dashboard renders without errors
3. All 5 rows display data (SLO overview, API latency, error rates, resource pressure, log stream)
4. SLO stat panels show current values with color-coded thresholds

### AC6: Alert Rules Evaluate
1. Prometheus → Alerts page shows all rules loaded (SLO + resource pressure)
2. Rules are in "inactive" state (not firing) under normal conditions
3. Metric names in rules match actual metric names from `/metrics`

### AC7: Resource Metrics Available
1. `node_cpu_seconds_total`, `node_memory_MemTotal_bytes`, `node_filesystem_size_bytes` metrics exist in Prometheus
2. Mission Control resource pressure row displays CPU/memory/disk charts

### AC8: No Jaeger References Remain
1. `grep -r "jaeger" infra/ scripts/ docs/` returns no results (case-insensitive)
2. No container named `*jaeger*` in any compose file

### AC9: Existing Functionality Preserved
1. `/health` endpoint still works
2. `/metrics` endpoint still works (with renamed metrics)
3. Backend starts without errors when `ENABLE_TELEMETRY=true`
4. Backend starts without errors when `ENABLE_TELEMETRY=false` (graceful degradation)
5. Existing Grafana dashboards in `infra/grafana/dashboards/` are not broken

## Implementation Order

1. R1: Docker Compose (foundation — everything depends on this)
2. R2: OTel Collector config
3. R3: Promtail config
4. R10: Grafana provisioning (datasources + dashboard provider)
5. R4: Metrics unification (prom-client renames)
6. R5: Backend OTel tracing update
7. R6: Logger trace correlation
8. R7: Prometheus config update
9. R8: Alert rules fix/extend
10. R9: Mission Control dashboard JSON
11. R11: Scripts/Makefile update
12. R12: Cleanup (Jaeger removal, doc updates)

Verification after each group: boot the stack, confirm the relevant AC.
>>>>>>> 1d940125 (feat(observability): consolidate observability stack to PGLT, add Promtail for log shipping, and unify metrics)
