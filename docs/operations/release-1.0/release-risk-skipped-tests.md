# Release 1.0 — Skipped/Focused Test Risk Artifact

## Sign-off linkage

This artifact is the Release 1.0 skipped-test exception register. It is referenced by CI guard `scripts/ci/check-critical-skip-only.mjs` and waiver source `config/release-risk/release-1.0-skip-waivers.json`.

## Inventory (`rg -n "\b(it|describe|test)\.(skip|only)\b"`)

| File:Line | Classification | Disposition |
|---|---|---|
| `scripts/synthetic-monitors/golden-path.spec.ts:311` | **Release-critical** | Waived as `R1-SKIP-001` (owner `@team/devops`, expires `2026-06-30`). |
| `docs/sprint-plan-24-27.md:193` | Non-critical | Documentation mention only; no executable test skip. |
| `tests/e2e/CrossComponentIntegration.test.ts:15` | Non-critical | Environment-gated integration suite (`describeMaybe`). |
| `tests/e2e/critical-user-flow.spec.ts:149` | **Resolved** | R1-SKIP-002 waiver lifted. Test implemented using Playwright `page.route()` API mocking (no external dependencies). |
| `tests/e2e/ValueJourney.test.ts:18` | Non-critical | Environment-gated integration suite (`describeMaybe`). |
| `tests/e2e/auth-complete-flow.spec.ts:259` | **Release-critical** | Waived as `R1-SKIP-003` (owner `@team/security`, expires `2026-05-31`). |
| `tests/e2e/auth-complete-flow.spec.ts:404` | **Release-critical** | Waived as `R1-SKIP-004` (owner `@team/security`, expires `2026-05-31`). |
| `tests/e2e/auth-complete-flow.spec.ts:434` | **Release-critical** | Waived as `R1-SKIP-005` (owner `@team/security`, expires `2026-05-31`). |
| `tests/e2e/MultiUserWorkflow.test.ts:12` | Non-critical | Environment-gated integration suite (`describeMaybe`). |
| `tests/e2e/critical-preprod.test.ts:22` | Non-critical | Compatibility-layer gated preprod suite (`compatDescribe`). |
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
| `tests/test/playwright/workflow-orchestration.spec.ts:21` | **Release-critical** | Waived as `R1-SKIP-006` (owner `@team/frontend`, expires `2026-05-31`). |
| `tests/test/playwright/workflow-orchestration.spec.ts:40` | **Release-critical** | Waived as `R1-SKIP-007` (owner `@team/frontend`, expires `2026-05-31`). |
| `tests/test/playwright/critical-flows.spec.ts:43` | **Release-critical** | Waived as `R1-SKIP-008` (owner `@team/frontend`, expires `2026-05-31`). |
| `tests/test/playwright/critical-flows.spec.ts:59` | **Release-critical** | Waived as `R1-SKIP-009` (owner `@team/frontend`, expires `2026-05-31`). |
| `tests/test/playwright/critical-flows.spec.ts:76` | **Release-critical** | Waived as `R1-SKIP-010` (owner `@team/frontend`, expires `2026-05-31`). |
| `tests/test/playwright/critical-flows.spec.ts:93` | **Release-critical** | Waived as `R1-SKIP-011` (owner `@team/frontend`, expires `2026-05-31`). |
| `tests/test/playwright/critical-flows.spec.ts:97` | **Release-critical** | Waived as `R1-SKIP-012` (owner `@team/frontend`, expires `2026-05-31`). |
| `tests/test/playwright/critical-flows.spec.ts:110` | **Release-critical** | Waived as `R1-SKIP-013` (owner `@team/frontend`, expires `2026-05-31`). |
| `tests/test/playwright/circuit-breaker-cost-blocking.spec.ts:100` | Non-critical | Explicit integration-only test; outside release-critical paths. |
| `packages/backend/src/config/__tests__/validateEnv.test.ts:29` | Non-critical | Legacy provider validation tests intentionally retained as skipped placeholders. |
| `packages/backend/src/config/__tests__/validateEnv.test.ts:39` | Non-critical | Legacy provider validation tests intentionally retained as skipped placeholders. |
| `packages/backend/src/config/__tests__/validateEnv.test.ts:49` | Non-critical | Legacy provider validation tests intentionally retained as skipped placeholders. |
| `packages/backend/src/lib/agent-fabric/__tests__/SupabaseMemoryBackend.integration.test.ts:29` | Non-critical | Integration suite gated by Supabase availability. |
| `apps/VOSAcademy/tests/ai-chat.test.ts:39` | Non-critical | AI chat integration scenario currently non-blocking for Release 1.0. |
| `apps/VOSAcademy/tests/ai-chat.test.ts:55` | Non-critical | AI chat integration scenario currently non-blocking for Release 1.0. |

## Approved waivers for release-critical entries

Source of truth: `config/release-risk/release-1.0-skip-waivers.json`.

All release-critical skips currently discovered by ripgrep are covered by explicit waiver entries with owner + expiration. CI fails for:

1. Any new `.skip`/`.only` in critical paths without waiver.
2. Any expired waiver.
