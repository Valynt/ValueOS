# Security Overview

**Last Updated**: 2026-03-16

This document is the canonical security controls matrix for ValueOS. It maps each baseline control to implementation artifacts and CI enforcement so auditors and engineers can quickly verify coverage.

## Security Controls Matrix

| Control ID | Control | Implementation Files | CI / Verification Evidence |
| --- | --- | --- | --- |
| SEC-01 | HTTP security headers are enforced on API traffic. | `packages/backend/src/middleware/security/headers.ts` (headers middleware implementation), `packages/backend/src/middleware/security/index.ts` (combined security middleware), `packages/backend/src/server.ts` (middleware registration). | `scripts/ci/security-baseline-verification.mjs` validates middleware wiring and fails if missing; executed from `.github/workflows/ci.yml`. |
| SEC-02 | CORS is centrally controlled and origin-validated. | `packages/backend/src/middleware/security/cors.ts`, `packages/backend/src/middleware/security/config.ts`, `packages/backend/src/middleware/security/index.ts`. | Unit tests under `packages/backend/src/middleware/security/__tests__/cors.test.ts`; full test suite runs in `.github/workflows/ci.yml`. |
| SEC-03 | Semgrep SAST is required in CI. | `.github/workflows/ci.yml` (`security-gate` job), `scripts/ci/check-ci-security-control-matrix.mjs` (scanner-action drift guard). | Semgrep findings are emitted as `semgrep.sarif` and uploaded to GitHub Code Scanning via `github/codeql-action/upload-sarif@v4`. |
| SEC-04 | Secret scanning is required in CI. | `.github/workflows/ci.yml` (`security-gate` job using `gitleaks/gitleaks-action@v2`), `.gitleaks.toml`. | Gitleaks action failure blocks `security-gate` and therefore PR merge blockers. |
| SEC-05 | Dependency vulnerability scanning is required in CI. | `.github/workflows/ci.yml` (`pnpm audit --audit-level=high`). | High/critical dependency findings fail `security-gate`; report retained as `npm-audit-report.json` artifact (90-day retention). |
| SEC-06 | CodeQL analysis is required for JavaScript/TypeScript. | `.github/workflows/codeql.yml` (`github/codeql-action/init@v4` + `github/codeql-action/analyze@v4`). | `codeql-analyze (js-ts)` runs on PRs and pushes to `main`; intended as a required branch-protection check. |
| SEC-07 | Trivy filesystem and container image scans are enforced in CI. | `.github/workflows/ci.yml` (`aquasecurity/trivy-action@0.35.0` for `scan-type: fs` and `scan-type: image`). | HIGH/CRITICAL severities fail `security-gate`; SARIF artifacts (`trivy-fs.sarif`, `trivy-image.sarif`) are uploaded to code scanning and retained for 90 days. |
| SEC-08 | CI scanner control matrix drift is blocked automatically. | `scripts/ci/check-ci-security-control-matrix.mjs`, `.github/workflows/CI_CONTROL_MATRIX.md`. | `ci.yml` runs the guard and fails if required scanner action identifiers or matrix rows drift. |
| SEC-09 | Gateway CORS configuration forbids wildcard origins in production. | `config/kong.yml` (approved origin allowlists per environment), `scripts/ci/check-kong-cors-origins.mjs` (wildcard detection in production mode), `.github/workflows/ci.yml` (guard execution). | `pnpm check:kong-cors-origins` fails CI if any `origins: ["*"]`-style entries are present in gateway config. |

## Baseline Verification Entry Point

Run baseline verifiers locally:

```bash
node scripts/ci/security-baseline-verification.mjs
node scripts/ci/check-ci-security-control-matrix.mjs
pnpm check:kong-cors-origins
```

These checks are intentionally narrow and fast: they confirm core middleware wiring and verify scanner/control-matrix contracts in workflow configuration.
