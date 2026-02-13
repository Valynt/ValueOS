# Security Overview

This document is the canonical security controls matrix for ValueOS. It maps required security controls to implementation and verification points in the repository.

## Security Controls Matrix

| Control ID | Control | Implementation files | Verification files / jobs |
|---|---|---|---|
| SC-01 | HTTP security headers are enforced on backend responses. | `packages/backend/src/middleware/security/headers.ts`, `packages/backend/src/middleware/security/index.ts`, `packages/backend/src/server.ts` | `packages/backend/src/middleware/security/__tests__/headers.test.ts`, `scripts/ci/security-baseline-verification.mjs` |
| SC-02 | CORS restrictions are enforced with explicit origins and credentials policy. | `packages/backend/src/middleware/security/cors.ts`, `packages/backend/src/middleware/security/config.ts`, `packages/backend/src/server.ts` | `packages/backend/src/middleware/security/__tests__/cors.test.ts`, `scripts/ci/security-baseline-verification.mjs` |
| SC-03 | CSRF protections are applied for state-changing methods. | `packages/backend/src/middleware/securityMiddleware.ts`, `packages/backend/src/server.ts` | `packages/backend/src/api/__tests__/route-hardening.test.ts` |
| SC-04 | Request auditing and security-relevant events are logged. | `packages/backend/src/middleware/requestAuditMiddleware.ts`, `packages/backend/src/services/SecurityAuditService.ts` | `docs/security-compliance/audit-logging.md` |
| SC-05 | SAST scanning runs in CI. | `.github/workflows/ci.yml` (`sast` job, Semgrep action) | `scripts/ci/security-baseline-verification.mjs`, `.github/workflows/ci.yml` |
| SC-06 | SCA/license/security dependency scanning runs in CI. | `.github/workflows/ci.yml` (`sca-license` job, Trivy action) | `scripts/ci/security-baseline-verification.mjs`, `.github/workflows/ci.yml` |
| SC-07 | CodeQL analysis runs in CI and publishes security events. | `.github/workflows/ci.yml` (`codeql` job) | `.github/workflows/ci.yml` |
| SC-08 | IaC and container hardening scans run in CI. | `.github/workflows/ci.yml` (`iac`, `hadolint`, `sbom`) | `.github/workflows/ci.yml`, `security-gate` job |
| SC-09 | Security controls are gate-enforced before merge/release. | `.github/workflows/ci.yml` (`security-gate` job and `needs`) | `.github/workflows/ci.yml` |
| SC-10 | Coordinated vulnerability disclosure process is published. | `SECURITY.md` | `README.md`, `docs/security-compliance/README.md` |

## Baseline Verification

Automated baseline checks run through:

- `scripts/ci/security-baseline-verification.mjs`

The script validates:

1. Security headers middleware is enabled in backend server wiring.
2. CI workflow contains SAST and SCA jobs and their expected scanners.
