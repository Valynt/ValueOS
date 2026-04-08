# CI/CD and Release Gating — Index

This directory contains the complete production release system for ValueOS.

| Document | Purpose |
|---|---|
| `PIPELINE.md` | Full pipeline architecture, workflow-by-workflow breakdown, hard gate table |
| `DEPLOYMENT_STRATEGY.md` | Blue/green mechanics, environment matrix, rollback procedure, secret management |
| `DATA_SAFETY.md` | Migration governance, rollback strategy, backup validation, tenant isolation guarantees |
| `RELEASE_CHECKLIST.md` | Step-by-step checklist for every production release (Phases 1–7) |
| `GO_NO_GO.md` | Binary GO/NO-GO criteria, automated gate table, confidence scoring, decision authority |

## Quick reference

### Where gates live

```
PR gate          → .github/workflows/pr-fast.yml
Main gate        → .github/workflows/main-verify.yml
Release build    → .github/workflows/release.yml
Deploy           → .github/workflows/deploy.yml
Migration        → .github/workflows/migration-chain-integrity.yml
RLS              → .github/workflows/rls-gate.yml
Secret scan      → .github/workflows/secret-scan.yml
SAST             → .github/workflows/codeql.yml
Nightly          → .github/workflows/nightly-governance.yml
DR validation    → .github/workflows/dr-validation.yml
```

### New scripts added by this design

```
scripts/ci/check-dependency-audit.mjs   → pnpm audit threshold enforcement
scripts/ci/check-trivy-thresholds.mjs   → Trivy CVE threshold enforcement
scripts/ci/check-e2e-results.mjs        → Playwright zero-failure enforcement
```

### Hard gate summary (zero tolerance)

- 0 secrets in any commit or PR diff
- 0 critical/high CVEs in container images (Trivy)
- 0 E2E test failures (Playwright)
- 0 high DAST findings (OWASP ZAP)
- 0 high/critical dependency CVEs (pnpm audit)
- 0 CodeQL high/critical findings
- 100% agent fabric test coverage
- RLS enabled on all tenant-scoped tables
- Every migration has a rollback file
- Reproducible builds (identical digests)
- Cosign signature on all production images

### Deployment strategy

Blue/green on Kubernetes. Active slot selected by Service label selector (`slot: blue|green`). Traffic swap is instant. Old slot kept at `replicas: 0` for 24h to enable instant rollback.

### Rollback

Automatic on smoke test failure. Manual via `workflow_dispatch`. Migration rollback via `.rollback.sql` files applied in reverse timestamp order. PITR restore available as last resort (RPO < 5 min, RTO < 15 min).
