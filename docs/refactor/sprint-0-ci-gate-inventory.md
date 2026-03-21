# Sprint 0 — CI Gate Inventory and Classification

**Date:** Sprint 0, ValueOS Architectural Refactor  
**Source files:** `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`  
**Classification key:**
- **critical-invariant** — Protects a non-negotiable product or security property. Must survive the refactor.
- **nice-to-have** — Adds signal but is not blocking. Can be demoted to advisory or removed.
- **compensating-control** — Exists only because legacy code is messy. Remove after the underlying code is cleaned up.

---

## ci.yml — Job: `unit-component-schema`

| Gate | Classification | Rationale | Refactor Action |
|---|---|---|---|
| TS any ratchet | compensating-control | Exists because the codebase has 7,000+ TS errors. Ratchet prevents regression but is not a real quality gate. | Remove after TS debt is paid down in Sprints 3–6. |
| TS error package ratchet | compensating-control | Same as above — a ratchet on accumulated debt, not a quality invariant. | Remove after TS debt is resolved. |
| Debt policy ratchet | compensating-control | Tracks known debt items. Useful during cleanup but not a permanent invariant. | Remove after Sprint 10 cleanup is complete. |
| Enforce Valynt service freeze | compensating-control | Guards against adding to frozen service directories. Only needed while those directories exist. | Remove after `server/_core/` and `packages/agents/` are deleted in Sprint 2. |
| Enforce frozen backend duplicate tree | compensating-control | Guards against adding to the duplicated service tree. Only needed while duplication exists. | Remove after service migration is complete in Sprint 10. |
| Guard browser provider secrets | critical-invariant | Prevents LLM API keys from leaking into the frontend bundle. Security invariant. | Keep permanently. |
| Guard frontend bundle service-role identifiers | critical-invariant | Prevents Supabase `service_role` key from reaching the browser. Security invariant. | Keep permanently. |
| Check service duplicate filenames | compensating-control | Detects the 179-file duplication problem. Only needed while duplication exists. | Remove after service migration is complete in Sprint 10. |
| Check module boundaries | critical-invariant | Enforces that frontend does not import backend internals and vice versa. Architecture invariant. | Keep permanently. |
| Check runtime sentinels | critical-invariant | Ensures the correct runtime entry points are active. Becomes simpler after Sprint 1 unification. | Keep; simplify after Sprint 1. |
| Lint | critical-invariant | Code quality baseline. | Keep permanently. |
| Typecheck | critical-invariant | Type safety. Core quality gate. | Keep permanently. |
| Unit suite + schema guard | critical-invariant | Unit tests + migration hygiene. Core quality gate. | Keep permanently. |
| Docs integrity | nice-to-have | Checks that documentation files are internally consistent. Useful but not blocking. | Keep as advisory; demote to non-blocking after Sprint 10. |
| Threat model freshness gate | nice-to-have | Checks that the threat model document has been updated recently. Process gate, not a code invariant. | Demote to advisory. |
| Observability contract gate | nice-to-have | Checks that observability contracts are met. Useful but not a hard product invariant. | Keep as advisory. |
| Query fingerprint perf budget gate | nice-to-have | Checks query performance budgets against a snapshot. Useful but fragile (snapshot drift). | Demote to advisory; replace with real p95 measurement in Sprint 9. |
| Compose drift guard | compensating-control | Guards against Docker Compose config drift. Only needed while the legacy compose setup exists. | Remove after infra is unified in Sprint 1. |
| Compose DB binding guard | compensating-control | Guards against DB binding mismatches in Compose. Same as above. | Remove after infra is unified in Sprint 1. |
| Env/port drift guard | compensating-control | Guards against `.env` and port config drift across multiple competing configs. | Remove after runtime unification in Sprint 1. |
| Hardcoded port mismatch guard | compensating-control | Detects hardcoded ports that conflict across the three competing runtimes. | Remove after runtime unification in Sprint 1. |
| Security anti-pattern guard | critical-invariant | Detects dangerous code patterns (eval, service_role misuse, etc.). Security invariant. | Keep permanently. |
| LLM secrets hygiene guard | critical-invariant | Ensures LLM API keys are not logged or exposed. Security invariant. | Keep permanently. |
| LLM readiness contract guard | critical-invariant | Validates that LLM integration contracts are met (secureInvoke usage, Zod schemas). Enforces AGENTS.md Rule 2. | Keep permanently. |
| Supabase tenant controls guard | critical-invariant | Validates that all DB queries include `organization_id`. Enforces AGENTS.md Rule 1. | Keep permanently. |
| Security baseline verification | critical-invariant | Runs the security baseline check suite. | Keep permanently. |
| Verify secret rotation metadata age | nice-to-have | Checks that secrets have been rotated recently. Operational process gate. | Keep as advisory; move to a dedicated security workflow. |

---

## ci.yml — Job: `tenant-isolation-gate`

| Gate | Classification | Rationale | Refactor Action |
|---|---|---|---|
| Tenant isolation + compliance tests (RLS, API, agent boundary, memory) | critical-invariant | Multi-tenant data isolation is a non-negotiable product invariant. These 6 test suites are the hard gate. | Keep permanently. This is one of the 2 critical invariants in the target CI. |
| DSR compliance tests | critical-invariant | Data Subject Request compliance is a legal requirement. | Keep permanently. |

---

## ci.yml — Job: `critical-workflows-gate`

| Gate | Classification | Rationale | Refactor Action |
|---|---|---|---|
| Critical workflow contracts (versioning contracts) | critical-invariant | Validates that the core value loop workflow contracts are met. This is one of the 3 critical product paths. | Keep; evolve to cover the 5 runtime services after Sprint 4. |
| Reload durability + chaos smoke | nice-to-have | Chaos smoke tests against the current orchestrator. Useful but tied to legacy infrastructure. | Replace with value-loop E2E test in Sprint 9. Remove chaos smoke against deprecated orchestrator after Sprint 10. |
| Multi-tenant chaos invariants | critical-invariant | Validates tenant isolation holds under chaos conditions. | Keep permanently. |

---

## ci.yml — Current Job: `accessibility-audit` (replaces the former standalone localization lane)

| Gate | Classification | Rationale | Refactor Action |
|---|---|---|---|
| Accessibility + localization checks (WCAG 2.2 AA, i18n key coverage, pseudo-localization, UX budgets) | critical-invariant | Current merge protection uses `accessibility-audit` as a blocking lane because it packages accessibility, localization evidence, and route-performance budgets together. | Keep blocking while these controls remain consolidated in the current lane. |
| Accessibility trend + severity budgets | critical-invariant | Trend/severity evidence is part of the current release gate contract and active CI control matrix. | Keep permanently unless replaced by an explicitly documented successor control. |

---

## ci.yml — Historical Mapping: former `migration-verification` responsibilities now run inside `unit-component-schema`

| Gate | Classification | Rationale | Refactor Action |
|---|---|---|---|
| Critical architecture migrations | critical-invariant | Migration hygiene, schema consistency, rollback validation, and critical migration verification are now step-level checks inside `unit-component-schema`. | Keep permanently inside the canonical CI lane. |

---

## ci.yml — Historical Mapping: former `nightly-node-chaos-replay` schedule-only lane

| Gate | Classification | Rationale | Refactor Action |
|---|---|---|---|
| Scheduled CI replay/chaos-style workload | nice-to-have | The current `ci.yml` still has a nightly schedule, but the historical standalone lane name is no longer current documentation. | Keep nightly/advisory scheduling only if the implementation remains valuable. |
| Security flows integration test | critical-invariant | Validates security flows end-to-end. | Keep permanently. |
| Message bus communication test | compensating-control | Tests the legacy MessageBus. Only relevant while the current messaging architecture exists. | Remove after MessageBus is replaced by the domain event bus in Sprint 8. |

---

## ci.yml — Aggregate Jobs

| Gate | Classification | Rationale | Refactor Action |
|---|---|---|---|
| `pr-fast-blocking-subsets` (blocks PRs on: unit/schema, tenant isolation, security, accessibility) | critical-invariant | The current PR gate aggregator. It now reflects the active blocking set in `ci.yml`. | Keep and update whenever branch-protection requirements change. |
| `staging-deploy-release-gates` (blocks promotion on: tenant isolation, critical workflows, security, accessibility) | critical-invariant | The current staging/release aggregation gate in `ci.yml`. | Keep permanently. |

---

## deploy.yml — Key Jobs

| Gate | Classification | Rationale | Refactor Action |
|---|---|---|---|
| Emergency Test Bypass Authorization | compensating-control | Exists because the CI is complex enough to need emergency bypasses. | Remove after CI is simplified in Sprint 9–10. |
| Quality Gate (lint + typecheck + test) | critical-invariant | Baseline quality check before deploy. | Keep permanently. |
| Build Container Images + Supply Chain Verification (Cosign) | critical-invariant | Image signing and verification. Security invariant. | Keep permanently. |
| Stability Seal | nice-to-have | Runs a stability check before staging deploy. Useful but duplicates CI coverage. | Demote to advisory after Sprint 9 E2E value loop test is in place. |
| Deploy to Staging (migrations + blue-green + smoke) | critical-invariant | Core deployment pipeline. | Keep permanently. |
| Staging Performance Benchmarks (k6, p95 ≤ 200ms) | critical-invariant | Performance SLO enforcement. One of the 3 critical product paths. | Keep permanently. |
| Pre-Prod SLO Guard (burn-rate alerts) | critical-invariant | Prevents promotion when SLOs are burning. | Keep permanently. |
| Pre-Production Launch Gate (entitlements, billing, localization, tenant/region toggles, co-branding) | compensating-control | Broad checklist gate. Localization and co-branding checks are nice-to-have. Entitlements and billing are critical. | Split: keep entitlements + billing as critical-invariant; remove localization and co-branding checks. |
| Deploy to Production (migrations + blue-green + smoke) | critical-invariant | Core deployment pipeline. | Keep permanently. |
| Weekly Reliability Report | nice-to-have | Generates SLO and incident report. Operational reporting, not a gate. | Keep as scheduled report; not a blocking gate. |
| Rollback Production | critical-invariant | Blue-green rollback capability. | Keep permanently. |
| Create Deferred Validation Follow-up | nice-to-have | Creates a GitHub issue for deferred validations. Process automation. | Keep as nice-to-have. |

---

## Summary

| Classification | ci.yml count | deploy.yml count | Total |
|---|---|---|---|
| critical-invariant | 16 | 9 | 25 |
| nice-to-have | 7 | 4 | 11 |
| compensating-control | 10 | 3 | 13 |

**Gates to remove in Sprint 9–10 (compensating controls tied to legacy code):**
1. TS any ratchet
2. TS error package ratchet
3. Debt policy ratchet
4. Enforce Valynt service freeze
5. Enforce frozen backend duplicate tree
6. Check service duplicate filenames
7. Compose drift guard
8. Compose DB binding guard
9. Env/port drift guard
10. Hardcoded port mismatch guard
11. Message bus communication test (after Sprint 8 event bus migration)
12. Emergency Test Bypass Authorization (after CI simplification)
13. Pre-Production Launch Gate localization + co-branding checks

**Gates to demote to advisory (nice-to-have):**
1. Docs integrity
2. Threat model freshness gate
3. Query fingerprint perf budget gate (replace with real p95 in Sprint 9)
4. Localization checks + visual smoke (remove from PR blocking set)
5. Reload durability chaos smoke (replace with value-loop E2E in Sprint 9)
6. Stability Seal (after Sprint 9 E2E test is in place)

**Target CI state (post Sprint 10):**

3 critical product paths:
1. Value loop integrity (unit + integration + E2E value loop test)
2. Domain model consistency (typecheck + schema guard + migration verification)
3. Artifact accuracy (economic calculation determinism tests)

2 critical invariants:
1. No cross-tenant data access (tenant-isolation-gate)
2. No untyped writes to domain state (module boundaries + LLM readiness contract)
