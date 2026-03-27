# Spec: Security Hardening — Release Gate

**Status:** Draft  
**Scope:** Release-critical security gaps + validation of claimed-implemented controls  
**Production promotion is blocked until all acceptance criteria in §3 are met.**

---

## 1. Problem Statement

The repository has a documented security posture with several controls marked "implemented." However:

1. **Claimed controls lack enforcement evidence.** RLS, audit logs, LLM safeguards, and cache isolation are described as implemented but have no CI gate that proves they work and cannot regress.
2. **Secret exposure state is unknown.** No authoritative full-history scan result exists. In a multi-tenant agentic system with LLM gateway keys and Supabase service-role credentials, unverified = potentially exposed.
3. **MFA defaults to disabled.** `MFA_ENABLED=false` in `.env.example` means a misconfigured production environment silently ships without MFA. There is no code-level, CI-level, or runtime-level enforcement.
4. **`child_process.exec` ships in production artifacts.** `packages/backend/src/routes/dev.ts` is runtime-gated but not build-time excluded. The code is present in production bundles, creating latent RCE risk if any gate fails.
5. **Compose and devcontainer configs contain `postgres:postgres` credential fallbacks.** These appear in `.devcontainer/docker-compose.devcontainer.yml` and template files. If a developer accidentally uses these configs against a non-local target, default credentials are used.
6. **No compliance evidence completeness gate.** The quarterly compliance export exists but there is no CI check that fails when required evidence artifacts are absent.

### What this spec explicitly excludes

- Controls already implemented **and** validated with passing CI evidence (gitleaks PR/history scan, PSP→PSA migration, CORS wildcard rejection, architecture drift gate, infra readiness contract, ValueFabricService tenant filters).
- Long-term roadmap items (chaos tests, maturity scorecards, ADR portal) — referenced in §6 as forward context only.
- Non-security improvements (performance, UX, dependency freshness).

---

## 2. Requirements

### R1 — Secret Exposure: Verify and Document

The secret exposure state must be resolved from "unknown" to "verified clean" or "remediated."

- Run a full-history scan (all branches, all tags) using gitleaks with the existing `.gitleaks.toml` config.
- Classify all findings into: true positive (active secret), revoked/expired, or false positive.
- True positives require: immediate rotation/revocation, `git filter-repo` history rewrite, access log audit.
- False positives require: documented justification + `.gitleaks.toml` allowlist entry.
- Scan results must be committed as evidence in `docs/security-compliance/secret-scan-evidence.md`.
- Production promotion is blocked until this document exists and contains no unresolved true positives.

### R2 — MFA: Secure-by-Default with Multi-Layer Enforcement

MFA must be enforced at three layers:

**Code layer:** `MFA_ENABLED` must default to `true` in `packages/backend/src/config/environment.ts`. Disabling requires an explicit `MFA_ENABLED=false` env var. The existing `mfaEnabled = process.env.MFA_ENABLED === "true"` logic must be inverted to `mfaEnabled = process.env.MFA_ENABLED !== "false"`.

**CI gate:** `pr-fast.yml` and `main-verify.yml` must include a check that fails if any production-targeted env file or Helm/K8s manifest sets `MFA_ENABLED=false` or omits `MFA_ENABLED` entirely.

**Runtime assertion:** On server startup in production (`NODE_ENV=production`), if `MFA_ENABLED` resolves to `false`, the process must log a security event and exit with a non-zero code. This is a fail-fast guard against config drift.

**Policy scope:** MFA must gate: admin actions, Trust Portal access, sensitive data exports, tenant configuration changes, and API token/integration setup.

### R3 — Dev Route Build-Time Exclusion

`packages/backend/src/routes/dev.ts` (which imports `child_process.exec`) must not be present in production build artifacts.

**Build-time:** The route registration in the server entry point must use a conditional import or separate entry that is excluded by the bundler when `NODE_ENV=production`. The `child_process` import must not appear in production bundle output.

**Startup assertion:** On production boot, assert that dev routes are not registered and `ENABLE_DEV_ROUTES` is not `true`. Fail fast if violated. This is belt-and-suspenders over the build-time exclusion.

**CI gate:** Add a build artifact check that greps the production bundle for `child_process` and fails if found.

### R4 — Compose Credential Fallbacks

`postgres:postgres` default credentials must not be usable as a silent fallback in any compose file that could target a non-local environment.

- `.devcontainer/docker-compose.devcontainer.yml`: Replace `POSTGRES_PASSWORD: ${PGPASSWORD:-postgres}` with `POSTGRES_PASSWORD: ${PGPASSWORD:?PGPASSWORD must be set — do not use default credentials}`.
- Add a startup script or compose healthcheck comment that makes the intent explicit.
- Update `.devcontainer/.env.template` to require `PGPASSWORD` to be set explicitly.
- Doc examples in `docs/getting-started/` that show `postgres:postgres` must be annotated as local-only and must not appear in any production-path documentation without a warning.

### R5 — Claimed Control Validation (Proof Requirements)

Each of the following controls is claimed as implemented. The spec requires CI-enforced proof that they work and cannot silently regress.

#### R5a — RLS: No Cross-Tenant Reads

**Claim:** All queries include `organization_id` filters; RLS policies enforce tenant isolation.  
**Required proof:**
- `pnpm run test:rls` must pass with ≥10 test cases covering: read isolation, write isolation, cross-tenant query rejection, and service-role bypass prevention.
- `pr-fast.yml` already asserts ≥10 RLS tests — verify this gate is not bypassable by `describe.skip` or empty test files.
- Add at least one test that attempts a cross-tenant read with a valid JWT for a different org and asserts it returns zero rows.

#### R5b — Audit Logs: Completeness and Immutability

**Claim:** Multi-layered audit trail is implemented.  
**Required proof:**
- A test or CI script must verify that audit log entries are written for: login, logout, MFA challenge, tenant data access, admin action, and export.
- Audit log rows must be immutable (no `UPDATE`/`DELETE` permitted by RLS). Add a test that attempts to mutate an audit row with a non-service-role client and asserts it is rejected.
- Document the audit schema and retention policy in `docs/security-compliance/audit-log-evidence.md`.

#### R5c — LLM Safeguards: Prompt Injection Protection

**Claim:** `secureInvoke` in `BaseAgent.ts` enforces hallucination detection and safety controls.  
**Required proof:**
- Add tests to `packages/backend/src/lib/agent-fabric/agents/__tests__/` that verify `secureInvoke` rejects or flags: prompt injection patterns, outputs that assert false certainty without evidence, and outputs that bypass integrity checks.
- These tests must run in `main-verify.yml` and cannot be skipped.

#### R5d — LLM Cache: Tenant Isolation

**Claim:** `LLMCache.ts` scopes cache keys by `tenantId`.  
**Required proof:**
- `check-infra-readiness-contract.mjs` already verifies this statically. Add a runtime test that: creates a cache entry for tenant A, queries with tenant B's context, and asserts a cache miss.
- This test must run in the nightly governance suite.

#### R5e — Architecture Doc / Runtime Drift

**Claim:** `check-architecture-doc-drift.mjs` catches doc/code divergence.  
**Required proof:**
- Run the script locally and confirm it passes cleanly. Document the last-passing run SHA in `docs/security-compliance/drift-gate-evidence.md`.
- The script must be listed as a required check in `scripts/ci/release-gate-manifest.json`.

### R6 — Compliance Evidence Completeness Gate

The quarterly compliance export (`compliance-evidence-export.yml`) produces artifacts but there is no CI check that fails when required evidence files are absent.

- Add a `compliance-evidence-completeness` check to `main-verify.yml` that verifies the following files exist and are non-empty: `docs/security-compliance/secret-scan-evidence.md`, `docs/security-compliance/audit-log-evidence.md`, `docs/security-compliance/drift-gate-evidence.md`.
- This check must be listed in `scripts/ci/release-gate-manifest.json` as a required gate.

---

## 3. Acceptance Criteria

Production promotion is **blocked** until every item below is green.

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-1 | Full-history secret scan executed, results documented, no unresolved true positives | `docs/security-compliance/secret-scan-evidence.md` exists; CI `gitleaks-history` job passes |
| AC-2 | `MFA_ENABLED` defaults to `true` in code | Unit test: `getConfig()` with no env vars returns `mfaEnabled: true` |
| AC-3 | CI gate fails if production env sets `MFA_ENABLED=false` | `pr-fast.yml` check fails on a test fixture with `MFA_ENABLED=false` |
| AC-4 | Production startup fails if MFA is disabled | Integration test: server boot with `NODE_ENV=production` + `MFA_ENABLED=false` exits non-zero |
| AC-5 | `child_process` absent from production bundle | CI grep of production build output finds no `child_process` import |
| AC-6 | Startup assertion rejects dev routes in production | Test: `devRoutes` registration with `NODE_ENV=production` throws or exits |
| AC-7 | `postgres:postgres` fallback removed from devcontainer compose | `docker-compose.devcontainer.yml` contains no `:-postgres` password fallback |
| AC-8 | RLS cross-tenant isolation test passes | `pnpm run test:rls` passes; cross-tenant read test returns zero rows |
| AC-9 | Audit log immutability test passes | Test: non-service-role `UPDATE` on audit row is rejected by RLS |
| AC-10 | `secureInvoke` prompt injection tests pass | Agent fabric tests pass; injection patterns are flagged |
| AC-11 | LLM cache tenant isolation runtime test passes | Nightly suite: cross-tenant cache miss confirmed |
| AC-12 | Architecture drift gate passes and is in release manifest | `check-architecture-doc-drift.mjs` exits 0; listed in `release-gate-manifest.json` |
| AC-13 | Compliance evidence completeness gate passes | `main-verify.yml` completeness check passes; all three evidence docs exist |

---

## 4. Implementation Approach

Tasks are ordered by dependency. Items within a phase can be parallelized.

### Phase 1 — Secret Scan and Evidence (unblocks everything)

1. Run `gitleaks detect --config=.gitleaks.toml --log-opts="" --redact` against full history on all branches.
2. Triage findings: rotate any true positives, document false positives with justification.
3. Rewrite history with `git filter-repo` if any true positives are found.
4. Commit `docs/security-compliance/secret-scan-evidence.md` with scan date, tool version, finding count, and resolution status.

### Phase 2 — MFA Enforcement

5. Invert `MFA_ENABLED` default in `packages/backend/src/config/environment.ts`: `process.env.MFA_ENABLED !== "false"`.
6. Add unit test: `getConfig()` with no env vars → `mfaEnabled: true`.
7. Add startup assertion in `packages/backend/src/server.ts` (or equivalent entry): if `isProduction() && !config.auth.mfaEnabled` → log security event + `process.exit(1)`.
8. Add CI check in `pr-fast.yml`: scan env fixture files for `MFA_ENABLED=false` in production context; fail if found.

### Phase 3 — Dev Route Hardening

9. Refactor server entry point to conditionally register dev routes only when `NODE_ENV !== "production"` using a dynamic import or build-time conditional.
10. Add CI step in `main-verify.yml`: build production bundle, grep output for `child_process`, fail if present.
11. Add startup invariant test: boot with `NODE_ENV=production` + `ENABLE_DEV_ROUTES=true` → assert process exits non-zero.

### Phase 4 — Compose Credential Hardening

12. Replace `${PGPASSWORD:-postgres}` with `${PGPASSWORD:?...}` in `.devcontainer/docker-compose.devcontainer.yml`.
13. Update `.devcontainer/.env.template` to require `PGPASSWORD` explicitly.
14. Annotate `postgres:postgres` occurrences in `docs/getting-started/` as local-only with a warning block.

### Phase 5 — Claimed Control Validation

15. Add cross-tenant RLS test to `packages/backend/src/__tests__/` (R5a).
16. Add audit log immutability test (R5b); create `docs/security-compliance/audit-log-evidence.md`.
17. Add `secureInvoke` prompt injection tests to agent fabric test suite (R5c).
18. Add LLM cache cross-tenant miss test to nightly suite (R5d).
19. Run `check-architecture-doc-drift.mjs`, confirm clean pass, create `docs/security-compliance/drift-gate-evidence.md` (R5e).
20. Add `check-architecture-doc-drift.mjs` to `scripts/ci/release-gate-manifest.json`.

### Phase 6 — Compliance Evidence Gate

21. Add `compliance-evidence-completeness` job to `main-verify.yml` that checks for the three evidence docs.
22. Add the completeness gate to `scripts/ci/release-gate-manifest.json`.

---

## 5. Files Affected

| File | Change |
|------|--------|
| `packages/backend/src/config/environment.ts` | Invert MFA default |
| `packages/backend/src/server.ts` (or entry) | Add MFA + dev-route startup assertions |
| `packages/backend/src/routes/dev.ts` | Conditional registration / build exclusion |
| `.devcontainer/docker-compose.devcontainer.yml` | Remove `:-postgres` fallback |
| `.devcontainer/.env.template` | Require `PGPASSWORD` explicitly |
| `.github/workflows/pr-fast.yml` | Add MFA production env check |
| `.github/workflows/main-verify.yml` | Add bundle grep + compliance completeness gate |
| `scripts/ci/release-gate-manifest.json` | Add drift gate + completeness gate |
| `docs/security-compliance/secret-scan-evidence.md` | New — scan results |
| `docs/security-compliance/audit-log-evidence.md` | New — audit schema + retention |
| `docs/security-compliance/drift-gate-evidence.md` | New — last-passing drift gate SHA |
| `packages/backend/src/__tests__/` | New RLS cross-tenant + audit immutability tests |
| `packages/backend/src/lib/agent-fabric/agents/__tests__/` | New secureInvoke injection tests |

---

## 6. Forward Roadmap Context (non-binding)

The following capabilities are not in scope for this release but inform the design of audit, policy, and identity systems being built now.

- **Tenant-isolation chaos tests** — will exercise the RLS and cache isolation controls validated here. Audit logs and test infrastructure built in this spec are prerequisites.
- **Platform maturity scorecards** — will consume compliance evidence artifacts produced by the completeness gate (AC-13). The evidence schema should be machine-readable.
- **ADR/decision portal** — will surface decision logs and agent reasoning traces. The audit log schema (R5b) should include a `decision_id` foreign key to support this linkage.

The system is designed to support these capabilities. They are not acceptance criteria for this release.
