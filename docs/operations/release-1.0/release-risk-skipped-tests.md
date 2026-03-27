# Release 1.0 — Skipped/Focused Test Risk Artifact

## Sign-off linkage

This artifact is the Release 1.0 skipped-test exception register. It is referenced by CI guard `scripts/ci/check-critical-skip-only.mjs` and waiver source `config/release-risk/release-1.0-skip-waivers.json`.

## Inventory (`rg -n "\b(it|describe|test)\.(skip|only)\b"`)

| File:Line | Classification | Disposition |
|---|---|---|
| `scripts/synthetic-monitors/golden-path.spec.ts:311` | **Release-critical** | Waived as `R1-SKIP-001` (owner `@team/devops`, expires `2026-06-30`). |
| `docs/sprint-plan-24-27.md:191` | Non-critical | Documentation mention only; no executable test skip. |
| `tests/e2e/CrossComponentIntegration.test.ts:15` | Non-critical | Environment-gated integration suite (`describeMaybe`). |
| `tests/e2e/critical-user-flow.spec.ts:149` | **Resolved** | R1-SKIP-002 waiver lifted. Test implemented using Playwright `page.route()` API mocking (no external dependencies). |
| `tests/e2e/ValueJourney.test.ts:18` | Non-critical | Environment-gated integration suite (`describeMaybe`). |
| `tests/e2e/auth-complete-flow.spec.ts:259` | **Resolved** | `TEST-E2E-302` restored as deterministic OAuth wiring coverage (enabled/visible provider controls). |
| `tests/e2e/auth-complete-flow.spec.ts:408` | **Resolved** | `TEST-E2E-702` restored with deterministic session-expiry recovery assertion (no runtime skip). |
| `tests/e2e/auth-complete-flow.spec.ts:443` | **Resolved** | `TEST-E2E-802` restored with deterministic HTTPS guardrail validation for external auth links. |
| `tests/e2e/MultiUserWorkflow.test.ts:12` | Non-critical | Environment-gated integration suite (`describeMaybe`). |
| `tests/e2e/critical-preprod.test.ts:23` | Non-critical | Compatibility-layer gated preprod suite (`compatDescribe`). |
| `tests/e2e/llm-workflow.test.ts:16` | Non-critical | Environment-gated integration suite (`describeMaybe`). |
| `tests/test/performance/PerformanceBenchmarks.test.ts:18` | Non-critical | Perf suite disabled outside perf-enabled env. |
| `tests/test/performance/ConcurrentUserLoadTest.test.ts:16` | Non-critical | Perf suite disabled outside perf-enabled env. |
| `tests/test/performance/LoadTesting.test.ts:16` | Non-critical | Perf suite disabled outside perf-enabled env. |
| `tests/test/performance/ValueTreeStressTest.test.ts:13` | Non-critical | Perf suite disabled outside perf-enabled env. |
| `tests/test/performance/StressTesting.test.ts:15` | Non-critical | Perf suite disabled outside perf-enabled env. |
| `tests/test/performance/AgentInvocationBenchmark.test.ts:13` | Non-critical | Perf suite disabled outside perf-enabled env. |
| `tests/test/migrations/migrations.test.ts:30` | Non-critical | Conditional migration suite (run only when env allows). |
| `tests/test/contracts/crm-contract.test.ts:13` | Non-critical | Conditional contract suite (integration env requirement). |
| `tests/test/mcp-ground-truth/TEST_EXECUTION_GUIDE.md:546` | Non-critical | Documentation example only; no executable test skip. |
| `tests/test/playwright/workflow-orchestration.spec.ts:21` | **Resolved** | Critical workflow entry-point assertion now enforced directly (no conditional skip). |
| `tests/test/playwright/workflow-orchestration.spec.ts:39` | **Resolved** | Workflow start control assertion now enforced directly (no conditional skip). |
| `tests/test/playwright/critical-flows.spec.ts:43` | **Resolved** | New case trigger is now mandatory in smoke flow; test fails instead of skipping. |
| `tests/test/playwright/critical-flows.spec.ts:59` | **Resolved** | Upload Notes starter visibility now explicitly asserted. |
| `tests/test/playwright/critical-flows.spec.ts:76` | **Resolved** | CRM import starter visibility now explicitly asserted. |
| `tests/test/playwright/critical-flows.spec.ts:93` | **Resolved** | Case selection now uses required sidebar entry assertion. |
| `tests/test/playwright/critical-flows.spec.ts:97` | **Resolved** | Ask AI action visibility now explicitly asserted. |
| `tests/test/playwright/critical-flows.spec.ts:110` | **Resolved** | SDUI render indicator is now required and asserted deterministically. |
| `tests/test/playwright/circuit-breaker-cost-blocking.spec.ts:100` | Non-critical | Explicit integration-only test; outside release-critical paths. |
| `packages/backend/src/config/__tests__/validateEnv.test.ts:29` | Non-critical | Legacy provider validation tests intentionally retained as skipped placeholders. |
| `packages/backend/src/config/__tests__/validateEnv.test.ts:39` | Non-critical | Legacy provider validation tests intentionally retained as skipped placeholders. |
| `packages/backend/src/config/__tests__/validateEnv.test.ts:49` | Non-critical | Legacy provider validation tests intentionally retained as skipped placeholders. |
| `packages/backend/src/lib/agent-fabric/__tests__/SupabaseMemoryBackend.integration.test.ts:29` | Non-critical | Integration suite gated by Supabase availability. |

## Approved waivers for release-critical entries

Source of truth: `config/release-risk/release-1.0-skip-waivers.json`.

Release-critical skips currently discovered by ripgrep are reduced to `R1-SKIP-001` only; all auth and workflow/playwright waivers were retired after restoring deterministic non-skipped coverage.

### Waiver-to-restored-coverage mapping

| Former waiver | Replacement coverage (non-skipped) | File |
|---|---|---|
| `R1-SKIP-003` | `TEST-E2E-302: OAuth redirect wiring is present` | `tests/e2e/auth-complete-flow.spec.ts` |
| `R1-SKIP-004` | `TEST-E2E-702: Session expiry handling shows auth recovery state` | `tests/e2e/auth-complete-flow.spec.ts` |
| `R1-SKIP-005` | `TEST-E2E-802: HTTPS enforcement guardrails for auth links` | `tests/e2e/auth-complete-flow.spec.ts` |
| `R1-SKIP-006` | `create case and start orchestration shows workflow status` (mandatory New Case assertion) | `tests/test/playwright/workflow-orchestration.spec.ts` |
| `R1-SKIP-007` | `create case and start orchestration shows workflow status` (mandatory Start Workflow assertion) | `tests/test/playwright/workflow-orchestration.spec.ts` |
| `R1-SKIP-008` | `new case creation via modal` (required trigger visibility) | `tests/test/playwright/critical-flows.spec.ts` |
| `R1-SKIP-009` | `upload notes modal preselects file after drop/upload` (required starter visibility) | `tests/test/playwright/critical-flows.spec.ts` |
| `R1-SKIP-010` | `CRM import modal enforces connection gating` (required starter visibility) | `tests/test/playwright/critical-flows.spec.ts` |
| `R1-SKIP-011` | `ask AI renders SDUI when a case is available` (required case selection visibility) | `tests/test/playwright/critical-flows.spec.ts` |
| `R1-SKIP-012` | `ask AI renders SDUI when a case is available` (required Ask AI visibility) | `tests/test/playwright/critical-flows.spec.ts` |
| `R1-SKIP-013` | `ask AI renders SDUI when a case is available` (required SDUI indicator assertion) | `tests/test/playwright/critical-flows.spec.ts` |

CI fails for:

1. Any new `.skip`/`.only` in critical paths without waiver.
2. Any expired waiver.
