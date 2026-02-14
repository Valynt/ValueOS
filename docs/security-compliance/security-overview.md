# Security Overview

**Last Updated**: 2026-02-14

This document is the canonical security controls matrix for ValueOS. It maps each baseline control to implementation artifacts and CI enforcement so auditors and engineers can quickly verify coverage.

## Security Controls Matrix

| Control ID | Control | Implementation Files | CI / Verification Evidence |
| --- | --- | --- | --- |
| SEC-01 | HTTP security headers are enforced on API traffic. | `packages/backend/src/middleware/security/headers.ts` (headers middleware implementation), `packages/backend/src/middleware/security/index.ts` (combined security middleware), `packages/backend/src/server.ts` (middleware registration). | `scripts/ci/security-baseline-verification.mjs` validates middleware wiring and fails if missing; executed from `.github/workflows/ci.yml`. |
| SEC-02 | CORS is centrally controlled and origin-validated. | `packages/backend/src/middleware/security/cors.ts`, `packages/backend/src/middleware/security/config.ts`, `packages/backend/src/middleware/security/index.ts`. | Unit tests under `packages/backend/src/middleware/security/__tests__/cors.test.ts`; full test suite runs in `.github/workflows/ci.yml`. |
| SEC-03 | Security static analysis (SAST) is required in CI. | `.github/workflows/ci.yml` (`sast` job with Semgrep), `scripts/ci/security-baseline-verification.mjs` (presence check). | `security-gate` job in `.github/workflows/ci.yml` requires `sast` success before merge. |
| SEC-04 | Software composition + license scanning (SCA) is required in CI. | `.github/workflows/ci.yml` (`sca-license` job with Trivy), `scripts/ci/security-baseline-verification.mjs` (presence check). | `security-gate` job in `.github/workflows/ci.yml` requires `sca-license` success before merge. |
| SEC-05 | CodeQL analysis is required for code scanning. | `.github/workflows/ci.yml` (`codeql` job). | `security-gate` job in `.github/workflows/ci.yml` requires `codeql` success before merge. |
| SEC-06 | Infrastructure as Code scanning is enforced. | `.github/workflows/ci.yml` (`iac` job with Checkov). | `security-gate` job in `.github/workflows/ci.yml` requires `iac` success before merge. |
| SEC-07 | Secrets and security anti-pattern checks run in CI baseline. | `scripts/ci/check-security-antipatterns.mjs`, `.github/workflows/ci.yml` (`Security anti-pattern guard` step). | Failing findings block the CI run in the `unit-tests` job. |

## Baseline Verification Entry Point

Run the lightweight baseline verifier locally:

```bash
node scripts/ci/security-baseline-verification.mjs
```

This check is intentionally narrow and fast: it confirms security headers middleware is wired and that SAST/SCA jobs are present in CI workflow configuration.
