# R4 — Recommendations & Roadmap

**Source:** Enterprise Agent Audit (`spec.md`), Production Readiness Spec (`spec-production-readiness.md`), B2B SaaS Repo Audit (`docs/assessments/repo-audit-b2b-saas-2026-03-06.md`)
**Date:** 2026-03-17
**Compliance targets:** SOC 2 Type II, GDPR
**Status:** Active — tracks remediation across three time horizons

---

## How to Read This Document

Each item includes:

| Field              | Description                             |
| ------------------ | --------------------------------------- |
| **What**           | Concise description of the change       |
| **Why**            | Risk or gap it closes                   |
| **Effort**         | S (< 1 day), M (1–3 days), L (> 3 days) |
| **Owner**          | Team or role responsible                |
| **Success Metric** | Observable, testable acceptance gate    |

---

## Tier 1 — Immediate (0–30 days) — P0/P1 Blockers

These items block any external demo, pilot, or security review. Each represents a confirmed vulnerability or missing control that would fail a SOC 2 or CISO assessment.

| #   | What                                                                                                                                                                          | Why                                                                                                                                                                                  | Effort | Owner        | Success Metric                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **SEC-001:** User-scoped Supabase clients in repositories — replace `createServerSupabaseClient` calls in `api/` routes with per-request user-scoped clients that respect RLS | RLS is bypassed on every user request when the server client (service_role) is used outside the allowlist; any authenticated user can read/write any tenant's data                   | M      | Backend      | `pnpm run test:rls` passes; no `createServerSupabaseClient` in `api/` outside allowlist (`AuthService`, tenant provisioning, cron jobs)   |
| 2   | **SEC-002:** Add `tenant_id` filter on opportunities query in customer portal                                                                                                 | Cross-tenant data exposure — the opportunities list endpoint returns rows from all tenants when `organization_id` is not included in the query predicate                             | S      | Backend      | Integration test: tenant B cannot read tenant A's opportunities; query includes `.eq("organization_id", orgId)`                           |
| 3   | **SEC-003:** Replace no-op rate limiters with enforced limits on artifact and conversation write endpoints                                                                    | Zero rate limiting on artifact/conversation writes allows abuse (resource exhaustion, cost amplification via LLM-backed endpoints)                                                   | S      | Backend      | 61st request within 1 min returns HTTP 429; rate limiter config is not a passthrough/no-op                                                |
| 4   | **SEC-004:** Add `tenant_id` column to `conversation_history` table and create RLS migration                                                                                  | Cross-tenant read risk — `conversation_history` has no tenant scoping column; any query against it leaks data across organizations                                                   | M      | Backend + DB | RLS test passes for `conversation_history` table; migration adds `tenant_id NOT NULL` with foreign key to `organizations`                 |
| 5   | **SEC-005:** Server-side audit log delivery — replace browser-only `navigator.sendBeacon` with server-side persistence                                                        | Security audit events silently drop when triggered from server-side code (SSR, API routes, background jobs) because `navigator` is undefined                                         | S      | Backend      | Unit test: `auditLogService.log()` is called and persists to `audit_logs` table; `navigator` is not accessed in any server-side code path |
| 6   | **SEC-006:** Enforce `requireMFA` middleware on billing mutation endpoints                                                                                                    | Payment method changes and subscription mutations are unprotected by MFA — a compromised session token can modify billing without step-up auth                                       | S      | Backend      | `POST /api/billing/subscription` without MFA header returns HTTP 403; middleware is applied to all billing mutation routes                |
| 7   | **SEC-007:** Add `tenantDbContextMiddleware` to `backHalfRouter`                                                                                                              | `req.db` is `undefined` in integrity, narrative, and realization route handlers because the middleware that sets tenant-scoped DB context is missing from the back-half router chain | S      | Backend      | Back-half integration tests pass without `req.db` errors; middleware is wired before route handlers in `backHalfRouter`                   |
| 8   | **SEC-008:** Set `DAST_FAIL_ON_HIGH=1` in CI pipeline configuration                                                                                                           | DAST gate never blocks on high-severity findings — the ZAP scan runs but the pipeline does not fail, allowing high-severity vulnerabilities to reach staging/production              | S      | DevOps       | Deploy pipeline fails on next high-severity ZAP finding; CI config contains `DAST_FAIL_ON_HIGH=1` or equivalent threshold                 |

### Cross-references

- SEC-001 relates to `spec.md` non-negotiable rule 1 (tenant isolation) and rule 3 (service_role restrictions)
- SEC-002 relates to `spec.md` F-001 theme (data isolation gaps)
- SEC-004 relates to `spec.md` F-011 (DSR table completeness)
- SEC-005 relates to `spec.md` F-002 (AuditLogger stub)
- SEC-007 relates to `spec-production-readiness.md` TASK-007 (middleware wiring)

---

## Tier 2 — Near-term (1–3 months) — P1/P2 Hardening

These items close gaps that are acceptable for a controlled pilot but must be resolved before broad enterprise deployment or a SOC 2 Type II audit window.

| #   | What                                                                                                                                                  | Why                                                                                                                                                                                      | Effort | Owner              | Success Metric                                                                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **SEC-009–011:** Fix RBAC cache TTL (SEC-009), remove TCT default fallback in dev (SEC-010), add LLM input length validation (SEC-011)                | RBAC cache without TTL causes stale permissions; TCT default allows forged tokens in dev; missing input validation enables cost overrun via oversized prompts                            | S      | Backend            | Unit tests for each: RBAC cache expires after configured TTL; TCT rejects default secret; LLM gateway rejects prompts exceeding token limit                                |
| 2   | **GDPR-001–003:** Implement data subject request endpoints (GDPR-001), consent audit trail (GDPR-002), PII filter for all categories (GDPR-003)       | GDPR compliance completeness — current DSR endpoints miss agent output tables; consent changes are not audit-logged; PII filter does not cover all categories (passport, healthcare IDs) | M      | Security + Backend | All three endpoints tested end-to-end; PII filter covers SSN, CC, email, phone, passport, DOB, healthcare IDs; consent changes produce `audit_logs` rows                   |
| 3   | **SOC2-001–003:** Fill control matrix gaps (SOC2-001), implement WORM archive for audit logs (SOC2-002), automate quarterly access reviews (SOC2-003) | SOC 2 Type II evidence completeness — control matrix has unmapped CC6–CC9 controls; audit logs are mutable; access reviews are manual                                                    | M      | Security + DevOps  | Control matrix has no unmapped CC6–CC9 controls; audit log table has immutable storage policy; access review cron runs quarterly and produces evidence artifact            |
| 4   | **Reduce `as any` debt:** 1,522 to below 1,000                                                                                                        | Type safety erosion — 1,522 `as any` casts bypass TypeScript's type system, masking bugs and making refactors unsafe. Target aligns with existing debt tracking in `ts-any-dashboard.md` | L      | All teams          | `grep -rnE "as any" packages/ apps/ --include="*.ts" --include="*.tsx" \| grep -v "__tests__\|\.test\.\|\.spec\." \| wc -l` returns < 1,000; `ts-any-dashboard.md` updated |
| 5   | **Raise test coverage:** 75% lines to 80%, 70% branches to 75%                                                                                        | Enterprise bar is 85%/80% — current coverage is below the intermediate milestone needed to demonstrate progress to auditors                                                              | M      | All teams          | CI coverage thresholds updated to `lines: 80, branches: 75` and passing; coverage report attached to CI artifacts                                                          |
| 6   | **Accessibility:** Add `aria-label` to icon-only buttons; raise ARIA density baseline                                                                 | 33 ARIA attribute usages across 70 views is insufficient for WCAG 2.1 AA — icon-only buttons without labels are inaccessible to screen readers                                           | M      | Frontend           | `axe` moderate budget reduced from 10 to 5; all icon-only `<button>` elements have `aria-label`; accessibility CI gate passes                                              |
| 7   | **Forward `ErrorBoundary` errors to error tracking service**                                                                                          | React `ErrorBoundary` catches errors but does not report them to any external service — production errors are silently swallowed in the UI                                               | S      | Frontend           | Error tracking service (Sentry or equivalent) receives `ErrorBoundary` events; unit test mocks the tracking call and asserts it fires                                      |
| 8   | **SBOM upload to container registry + cosign signature**                                                                                              | Supply chain provenance incomplete — container images are built but lack an attached SBOM and cryptographic signature for verification                                                   | S      | DevOps             | SBOM attached to OCI image manifest; `cosign verify` passes against the published image; CI step added to release workflow                                                 |

### Cross-references

- Item 1 (SEC-009–011) relates to `spec-production-readiness.md` TASK-002 (MFA env var) and `spec.md` F-005 (auth fallback)
- Item 2 (GDPR-001–003) relates to `spec.md` F-011 (DSR erasure table list)
- Item 3 (SOC2-001–003) relates to `docs/security-compliance/control-traceability-matrix.md`
- Item 4 relates to `docs/debt/ts-any-dashboard.md` and existing debt tracking in `.ona/context/debt.md`

---

## Tier 3 — Long-term (3–12 months) — Enterprise Bar

These items represent the full enterprise-grade target. They are not blockers for pilot or early customers but are required for broad enterprise rollout, SOC 2 Type II certification renewal, and competitive positioning.

| #   | What                                                                  | Why                                                                                                                                                        | Effort | Owner     | Success Metric                                                                                                                           |
| --- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Reduce `as any` to below 100**                                      | Long-term target per `ts-any-dashboard.md` — reaching < 100 eliminates type safety as a risk category in security reviews                                  | L      | All teams | Dashboard shows < 100; strict zones in `config/debt-strict-zones.json` cover all packages                                                |
| 2   | **Raise test coverage to 85% lines / 80% branches**                   | Enterprise SaaS standard — required for SOC 2 Type II evidence and enterprise procurement questionnaires                                                   | L      | All teams | CI thresholds at `lines: 85, branches: 80` and passing; no test waivers without documented justification                                 |
| 3   | **Resolve Terraform/K8s IaC drift**                                   | Terraform ECS module in `infra/` is stale and does not match the active K8s deployment; creates confusion during incident response and onboarding          | M      | DevOps    | Either Terraform removed (with ADR documenting the decision) or kept in sync with K8s manifests; `infra/legacy/` archived or deleted     |
| 4   | **Expand OpenAPI spec to cover all routes**                           | Current OpenAPI spec covers only `/api/v1/projects` — all other endpoints are undocumented, blocking API-first integrations and automated contract testing | M      | Backend   | 100% of routes documented in `openapi.yaml`; CI gate validates spec completeness against Express router                                  |
| 5   | **Enable `DAST_FAIL_ON_MEDIUM` threshold after suppression baseline** | Medium-severity findings are currently advisory only — after establishing a suppression baseline, the pipeline should block on new medium findings         | M      | DevOps    | `DAST_FAIL_ON_MEDIUM=5` with suppression list; new medium findings above threshold fail the pipeline                                     |
| 6   | **Multi-region DR with documented RTO/RPO and quarterly drills**      | DR runbook exists but RTO/RPO targets are not tested — without evidence of tested recovery, SOC 2 A1.2 and enterprise procurement requirements are unmet   | L      | Platform  | Quarterly DR drill passes; RTO < 4h documented and tested; RPO < 1h documented and tested; drill results archived as compliance evidence |
| 7   | **Promote `conversation_history` to full RLS parity**                 | Currently lacks `tenant_id` column and RLS migration (Tier 1 item 4 adds the column; this item adds full parity with other tenant-scoped tables)           | M      | DB        | RLS test suite covers `conversation_history` with same rigor as `workflows`, `opportunities`, and `audit_logs` tables                    |

### Cross-references

- Item 1 continues Tier 2 item 4 (`as any` reduction)
- Item 2 continues Tier 2 item 5 (test coverage)
- Item 3 relates to `docs/assessments/repo-audit-b2b-saas-2026-03-06.md` finding on architecture drift
- Item 7 completes Tier 1 item 4 (SEC-004)

---

## Dependency Graph

```
Tier 1 SEC-001 ──┐
Tier 1 SEC-002 ──┤
Tier 1 SEC-004 ──┼── Tier 2 GDPR-001–003 ── Tier 3 conversation_history RLS parity
Tier 1 SEC-005 ──┘
Tier 1 SEC-007 ──── Tier 2 test coverage (back-half tests depend on req.db fix)
Tier 1 SEC-008 ──── Tier 3 DAST_FAIL_ON_MEDIUM (must establish high baseline first)
Tier 2 as-any ───── Tier 3 as-any < 100
Tier 2 coverage ─── Tier 3 coverage 85/80
```

---

## Tracking

Progress on these items should be tracked in:

- **Sprint plans:** `sprint-plan-*.md` files in repo root
- **Debt tracking:** `.ona/context/debt.md` and `docs/debt/ts-any-dashboard.md`
- **Security findings:** `docs/security-compliance/evidence-index.md`
- **Control matrix:** `docs/security-compliance/control-traceability-matrix.md`

When an item is completed, update this document by adding a completion date and linking to the PR or commit that resolved it.
