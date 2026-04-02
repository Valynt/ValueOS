# Backend test stability recovery plan

_Last updated: 2026-04-02_

## 1) Failure taxonomy (current baseline) grouped by owning module

Source of truth: `.github/metrics/backend-test-stability-baseline.json`.

| Failure class | Owning module(s) | Baseline failing tests | Typical signature | Owner |
|---|---|---:|---|---|
| Mocking drift | `agent-fabric`, `services`, `workers` | 14 | Assertions diverge from runtime contracts after API/interface changes. | Backend Platform |
| Env bootstrap | `workers`, `services` | 9 | Tests depend on undeclared env vars or inconsistent process-level setup. | Backend Infra |
| Integration fixture issues | `services`, `api`, `memory` | 12 | Shared fixtures diverge from schema or expected tenant metadata. | Data + Backend |
| Flaky timing | `workers`, `agent-fabric`, `services` | 7 | Retries/race windows/timeouts produce non-deterministic pass/fail behavior. | Reliability |

## 2) CI split during stability recovery

## Mandatory launch gates (merge blocking)

1. Security and secret scanning (`secret-scan`, `codeql`).
2. Tenant isolation and compliance (`tenant-isolation-static-gate`, `tenant-isolation-gate`, `integration-supabase`).
3. Billing correctness (billing integration coverage in `integration-supabase`).
4. Critical workflows (`pr-fast` aggregate, staging deploy release gates).
5. Test stability baseline ratchet (`check-backend-test-stability-baseline.mjs`).

## Non-blocking suites (tracked until baseline restored)

- Long-tail integration fixtures outside launch-critical domains.
- Flaky timing suites under active quarantine with retry telemetry.
- Performance/load exploratory suites.

Promotion rule back to blocking: suite demonstrates <2% flake rate across 10 consecutive CI runs and no baseline regression in the same window.

## 3) Deterministic bootstrap utilities

Use shared utilities in `packages/backend/src/test/deterministicBootstrap.ts` to avoid duplicated ad hoc setup:

- `bootstrapDeterministicEnv(...)` for consistent env initialization.
- `createDeterministicDbClient()` for repeatable DB client behavior in unit tests.
- `createDeterministicQueue()` for queue setup without runtime timing drift.
- `createDeterministicAgentMocks()` for stable LLM/memory behavior in agent tests.

## 4) Incremental burn-down policy and merge-blocking rule

Burn-down targets are encoded in `.github/metrics/backend-test-stability-baseline.json`.

- Weekly failing-test ceilings are pre-declared in `burnDownPlan`.
- `scripts/ci/check-backend-test-stability-baseline.mjs` computes the active weekly ceiling.
- Merge policy: PR fails when measured failing-test count is above the active ceiling.
- Baseline ceiling may only move downward; increases require explicit incident-level exception review.
