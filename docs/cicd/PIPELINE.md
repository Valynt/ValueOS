# CI/CD Pipeline Architecture

**Status:** Production-ready design  
**Runtime platform:** Kubernetes (blue/green)  
**Last reviewed:** 2026

---

## Pipeline overview

```
PR opened
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  pr-fast.yml  (cancel-in-progress, ~8 min target)               │
│  ├── secret-scan (gitleaks diff)                                 │
│  ├── typecheck + lint (per-package matrix)                       │
│  ├── build (valynt-app + backend)                                │
│  ├── unit/component/schema gates                                 │
│  ├── RLS gate (tenant isolation)                                 │
│  ├── migration chain integrity (if migrations touched)           │
│  ├── CodeQL SAST                                                 │
│  └── dependency audit (npm audit --audit-level=high)             │
└─────────────────────────────────────────────────────────────────┘
    │ PR merged to main
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  main-verify.yml  (no cancel-in-progress)                        │
│  ├── secret-scan full history                                    │
│  ├── lint matrix (backend / valynt-app / shared)                 │
│  ├── active-app quality gates (typecheck + build + browser-key)  │
│  ├── unit/component/schema (full suite + coverage thresholds)    │
│  ├── vitest package matrix                                       │
│  ├── RLS gate                                                    │
│  └── governance / compliance gates                               │
└─────────────────────────────────────────────────────────────────┘
    │ parallel
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  release.yml  (image build + sign + manifest)                    │
│  ├── reproducibility build (run-a + run-b, compare digests)      │
│  ├── SBOM generation (Syft)                                      │
│  ├── container signing (Cosign + OIDC)                           │
│  ├── Trivy vulnerability scan (HARD GATE: 0 critical/high)       │
│  ├── E2E gate (Playwright, HARD GATE: 0 failures)                │
│  └── release-manifest.json emission                              │
└─────────────────────────────────────────────────────────────────┘
    │ release-manifest validated
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  deploy.yml  (staging auto / production manual-approve)          │
│  ├── release-manifest-gate (manifest must exist for this SHA)    │
│  ├── DAST gate (OWASP ZAP, HARD GATE: 0 high, ≤5 medium)        │
│  ├── supply-chain verify (Cosign signature check)                │
│  ├── reliability-indicators-gate                                 │
│  ├── secret-rotation-evidence-gate                               │
│  ├── release-gate-contract (all gates must be green)             │
│  ├── migration apply (pre-deploy, with rollback on failure)      │
│  ├── blue/green slot swap                                        │
│  ├── smoke tests (post-deploy health + critical paths)           │
│  └── rollback trigger (automatic on smoke failure)               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Hard gates — zero tolerance

These checks cause an immediate pipeline failure. No bypass exists for production.

| Gate | Threshold | Enforced in |
|---|---|---|
| Secret scan | 0 secrets in diff or history | `pr-fast`, `main-verify`, `release` |
| TypeScript errors | 0 new errors (ratchet) | `pr-fast`, `main-verify` |
| Lint warnings | ≤ ratchet baseline per package | `pr-fast`, `main-verify` |
| Unit test coverage — lines | ≥ 75% overall, 100% agents, 95% security/billing | `main-verify` |
| Unit test coverage — functions | ≥ 70% | `main-verify` |
| Unit test coverage — branches | ≥ 70% | `main-verify` |
| RLS on all tenant-scoped tables | 100% | `rls-gate`, `migration-chain-integrity` |
| Migration clean-apply | Must apply from zero without error | `migration-chain-integrity` |
| Migration rollback files | Every forward migration must have a `.rollback.sql` | `check-migration-rollbacks` |
| E2E tests | 0 failures | `release` |
| Trivy — critical CVEs | 0 | `release` |
| Trivy — high CVEs | 0 | `release` |
| DAST — high findings | 0 | `deploy` |
| DAST — medium findings | ≤ 5 | `deploy` |
| CodeQL SAST | 0 new high/critical findings | `pr-fast`, `main-verify` |
| Dependency audit | 0 high/critical advisories | `pr-fast` |
| Reproducibility | Identical digests across two independent builds | `release` |
| Supply-chain signature | Cosign OIDC signature must verify | `deploy` |
| Schema drift | 0 unapplied migrations in staging before prod deploy | `deploy` |
| service_role boundary | No request handlers import service-role clients | `main-verify` |
| Direct LLM calls | 0 direct `llmGateway.complete()` calls in agent code | `main-verify` |
| Cross-tenant data | 0 queries without `organization_id`/`tenant_id` filter | `rls-gate` |

---

## Workflow files

### `pr-fast.yml` — PR gate (~8 min)

**Trigger:** `pull_request` → `main`, `develop`  
**Concurrency:** cancel-in-progress per branch

Key jobs (existing + additions):

```
secret-scan              ← existing, gitleaks diff
typecheck-lint           ← existing matrix (backend/valynt-app/shared)
build-check              ← existing active-app quality gates
unit-schema-gate         ← existing, coverage thresholds enforced
rls-gate                 ← existing
migration-integrity      ← existing (path-filtered to migrations/**)
codeql                   ← existing
dependency-audit         ← NEW: npm audit --audit-level=high
bundle-size-gate         ← existing check:bundle-size
```

**New job — `dependency-audit`:**

```yaml
dependency-audit:
  name: dependency-audit
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v6
    - uses: pnpm/action-setup@v5
      with:
        run_install: false
    - uses: actions/setup-node@v6
      with:
        node-version: 20.x
        cache: pnpm
    - name: Install dependencies
      run: pnpm install --frozen-lockfile
    - name: Audit for high/critical vulnerabilities
      run: |
        pnpm audit --audit-level=high --json > artifacts/audit/pnpm-audit.json || true
        node scripts/ci/check-dependency-audit.mjs \
          --report artifacts/audit/pnpm-audit.json \
          --fail-on high
    - name: Upload audit report
      if: always()
      uses: actions/upload-artifact@v7
      with:
        name: dependency-audit-${{ github.run_id }}
        path: artifacts/audit/
        retention-days: 30
```

---

### `release.yml` — Image build + security scan + E2E

**Trigger:** `push` → `main`, `workflow_dispatch`

Additions to the existing workflow:

**`trivy-scan` job** (runs after reproducibility-compare, before manifest emission):

```yaml
trivy-scan:
  name: trivy / container-scan
  runs-on: ubuntu-latest
  needs: [reproducibility-compare]
  strategy:
    matrix:
      image: [backend, frontend]
  steps:
    - uses: actions/checkout@v6

    - name: Download ${{ matrix.image }} image tar
      uses: actions/download-artifact@v8
      with:
        name: reproducibility-build-run-a
        path: reproducibility/run-a

    - name: Run Trivy on ${{ matrix.image }} image
      uses: aquasecurity/trivy-action@0.28.0
      with:
        input: reproducibility/run-a/${{ matrix.image }}-reproducibility-run-a.tar
        format: json
        output: artifacts/trivy/${{ matrix.image }}-trivy.json
        exit-code: "0"   # collect first, gate below
        vuln-type: os,library
        severity: CRITICAL,HIGH,MEDIUM,LOW

    - name: Enforce zero critical/high CVEs
      run: |
        node scripts/ci/check-trivy-thresholds.mjs \
          --report artifacts/trivy/${{ matrix.image }}-trivy.json \
          --fail-on-critical 0 \
          --fail-on-high 0 \
          --image ${{ matrix.image }}

    - name: Upload Trivy report
      if: always()
      uses: actions/upload-artifact@v7
      with:
        name: trivy-${{ matrix.image }}-${{ github.run_id }}
        path: artifacts/trivy/${{ matrix.image }}-trivy.json
        retention-days: 90
```

**`e2e-gate` job** (runs after images are built, against staging-like environment):

```yaml
e2e-gate:
  name: e2e / playwright
  runs-on: ubuntu-latest
  needs: [reproducibility-compare]
  env:
    NODE_ENV: test
    PLAYWRIGHT_BASE_URL: http://localhost:5174
  steps:
    - uses: actions/checkout@v6

    - uses: pnpm/action-setup@v5
      with:
        run_install: false

    - uses: actions/setup-node@v6
      with:
        node-version: 20.x
        cache: pnpm

    - name: Install dependencies
      run: pnpm install --frozen-lockfile

    - name: Install Playwright browsers
      run: pnpm exec playwright install --with-deps chromium

    - name: Start backend (test mode)
      run: |
        pnpm --filter @valueos/backend dev &
        npx wait-on http://localhost:3001/health/live --timeout 60000

    - name: Start frontend (test mode)
      run: |
        pnpm --filter valynt-app dev --port 5174 &
        npx wait-on http://localhost:5174 --timeout 60000

    - name: Run Playwright E2E suite
      run: |
        pnpm exec playwright test \
          --config playwright.config.ts \
          --reporter=json \
          --output=artifacts/e2e/results
      env:
        CI: true

    - name: Enforce zero E2E failures
      run: |
        node scripts/ci/check-e2e-results.mjs \
          --results artifacts/e2e/results/results.json \
          --fail-on-any-failure

    - name: Upload E2E artifacts
      if: always()
      uses: actions/upload-artifact@v7
      with:
        name: e2e-results-${{ github.run_id }}
        path: |
          artifacts/e2e/
          test-results/
        retention-days: 30
```

**`sbom-generate` job:**

```yaml
sbom-generate:
  name: sbom / generate
  runs-on: ubuntu-latest
  needs: [reproducibility-compare]
  steps:
    - uses: actions/checkout@v6

    - name: Generate SBOM (backend)
      uses: anchore/sbom-action@v0
      with:
        image: ${{ needs.build-and-push.outputs.backend_image_ref }}
        format: spdx-json
        output-file: artifacts/sbom/backend-sbom.spdx.json

    - name: Generate SBOM (frontend)
      uses: anchore/sbom-action@v0
      with:
        image: ${{ needs.build-and-push.outputs.frontend_image_ref }}
        format: spdx-json
        output-file: artifacts/sbom/frontend-sbom.spdx.json

    - name: Upload SBOMs
      uses: actions/upload-artifact@v7
      with:
        name: sbom-${{ github.sha }}
        path: artifacts/sbom/
        retention-days: 365
```

**Release manifest must include trivy + e2e gate results** before `deploy.yml` will proceed.

---

### `deploy.yml` — Kubernetes blue/green deploy

**Existing workflow is extended with:**

1. `trivy-gate` result required in `release-gate-contract`
2. `e2e-gate` result required in `release-gate-contract`
3. `migration-pre-deploy` job (see Data Safety section)
4. `smoke-test` job (post-deploy)
5. `rollback-on-failure` job

See `docs/cicd/DEPLOYMENT_STRATEGY.md` for the full blue/green procedure.

---

## Coverage thresholds (from `quality-baselines.json`)

| Scope | Lines | Functions | Branches | Statements |
|---|---|---|---|---|
| Overall | 75% (→ 86% by week 4) | 70% | 70% | 75% |
| Agent fabric | 100% | 100% | 100% | 100% |
| Security / billing | 95% (→ 97% by week 4) | 95% | 95% | 95% |

Enforced via `--coverage.thresholds.*` flags in `main-verify.yml` `unit-component-schema` job.

---

## Nightly jobs

| Workflow | Purpose |
|---|---|
| `nightly-governance.yml` | Full governance + compliance sweep |
| `migration-chain-integrity.yml` | Nightly clean-apply from zero |
| `dr-validation.yml` | Disaster recovery runbook validation |
| `dependency-outdated.yml` | Outdated dependency report |
| `secret-rotation-verification.yml` | Verify secrets rotated within policy window |
| `a11y-eslint-ratchet-weekly.yml` | Accessibility lint ratchet |
| `ts-error-ratchet.yml` | TypeScript error count trend |
