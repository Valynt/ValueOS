# Production Sign-Off Gate Remediation Spec

## Problem Statement

A senior DevOps audit of ValueOS returned a **No-Ship / Confidence 1/5** verdict, identifying critical flaws across three domains:

1. **Tenant isolation** — the agent response cache can produce cross-tenant data leakage when `tenantId` is absent from the request context.
2. **Revenue integrity** — the Stripe webhook processing path contains a double-upsert race condition that allows duplicate event processing.
3. **Background job traceability** — `LLMJobData` carries no `tenant_id`, making failed jobs in the Dead Letter Queue untraceable and unrecoverable by tenant.

Additionally, the CI/CD pipeline has three structural gaps that undermine deployment safety: a missing Prometheus alert that a deployment gate depends on, a DAST gate hardcoded to never block, and the tenant-isolation test job silently skipping on fork PRs.

The E2E test suite uses Playwright route mocking (`page.route("**/api/**", ...)`) instead of a real backend, meaning critical user flows are not validated against actual system behavior.

---

## Requirements

### R1 — Agent Cache Tenant Isolation (Fail Closed)

**File:** `packages/backend/src/api/agents.ts`

The `_agentCacheKey` function currently falls back to the string `"unknown"` when neither `tenantId` nor `organization_id` is present in the context object:

```typescript
const tenantId = context["tenantId"] || context["organization_id"] || "unknown";
```

A cache key of `agentType:unknown:hash` is shared across any two requests that lack tenant context, enabling cross-tenant cache hits.

**Required behavior:**
- If `tenantId` and `organization_id` are both absent or falsy, `_agentCacheKey` must throw a typed error (`MissingTenantContextError`) rather than fall back to `"unknown"`.
- `agentCache.get` and `agentCache.set` must propagate this error to the caller.
- The route handler(s) that call `agentCache.get/set` must catch `MissingTenantContextError` and return HTTP 403 with error code `TENANT_CONTEXT_REQUIRED` — they must not proceed to agent execution.
- Add a unit test asserting that `_agentCacheKey` throws when context contains no tenant identifier.
- Add a unit test asserting that a cache key for tenant A never equals a cache key for tenant B, even when query and agent type are identical.

### R2 — Webhook Idempotency (Single Atomic Transaction)

**File:** `packages/backend/src/services/billing/WebhookService.ts`

The production path (`processWebhook` → `processEvent`) performs two sequential `upsert` calls with `ignoreDuplicates: true`. Because `ignoreDuplicates: true` returns `null` on conflict, both calls can independently conclude "not a duplicate" in a concurrent scenario, causing the event handler (`handlePaymentSucceeded`, `handleSubscriptionUpdated`, etc.) to execute twice.

Additionally, `processedWebhookIds` is an in-memory `Set` that is not shared across process instances, providing no cross-instance idempotency.

**Required behavior:**
- Collapse `processWebhook` and `processEvent` into a single flow with one idempotency check.
- The idempotency check must use a Postgres-level unique constraint on `stripe_event_id` (already exists) via a single `INSERT ... ON CONFLICT DO NOTHING RETURNING id` pattern (or equivalent Supabase upsert that reliably returns `null` only on genuine conflict, not on race).
- If the insert returns no row (conflict), return `{ isDuplicate: true, processed: false }` immediately — do not call any event handler.
- If the insert returns a row, execute the event handler, then call `markEventProcessed`.
- The `processedWebhookIds` in-memory `Set` must be removed from the production code path. It may remain in the test-only deprecated overload.
- Add a unit test that simulates two concurrent calls with the same `event.id` and asserts the event handler is invoked exactly once.
- Add a unit test asserting that `isDuplicate: true` is returned on the second call.

### R3 — Queue Tenant Context

**File:** `packages/backend/src/services/realtime/MessageQueue.ts`

`LLMJobData` has no `tenant_id` field. Jobs that fail and move to BullMQ's failed-job store cannot be attributed to a tenant, making DLQ triage and replay impossible without manual Redis inspection.

**Required behavior:**
- Add `tenant_id: string` as a **required** field on the `LLMJobData` interface.
- Update `addJob` to validate that `tenant_id` is a non-empty string; throw if absent.
- Include `tenant_id` in all `logger.info/error/warn` calls within `processJob`, `storeResult`, and the worker event listeners (`completed`, `failed`, `stalled`).
- Include `tenant_id` in the `llm_job_results` insert payload (add the column if it does not exist — include the migration SQL).
- Update all call sites of `llmQueue.addJob(...)` to pass `tenant_id`.
- Add a unit test asserting that `addJob` throws when `tenant_id` is absent.
- Add a unit test asserting that `tenant_id` appears in the stored result and in log output on job failure.

### R4 — E2E Test Suite Rewrite (Real Backend)

**Directory:** `tests/e2e/`

The current Playwright E2E tests use `page.route(...)` to intercept and mock all API calls. They validate UI rendering against fabricated responses, not actual system behavior. Critical flows — auth, agent invocation, billing — are untested end-to-end.

**Required behavior:**
- Remove all `page.route(...)` API mocking from E2E specs. Tests must hit the real backend (Express on port 3001) and real Supabase test instance.
- The following flows must be covered with real requests:
  - **Auth flow:** sign-up → email confirmation → sign-in → session persistence → sign-out.
  - **Agent invocation flow:** authenticated POST to `/api/agents/:agentId/invoke` → poll for result → assert response shape matches Zod schema.
  - **Billing flow:** webhook delivery to `/api/billing/webhooks` → assert `webhook_events` row is created with `processed: true` → assert idempotent re-delivery returns `isDuplicate: true`.
  - **Tenant isolation flow:** two authenticated sessions from different tenants → assert agent cache returns distinct responses → assert one tenant cannot read the other's data via any API endpoint.
- Test environment setup must use a dedicated Supabase test project or local Supabase instance (not production). Credentials must come from environment variables (`E2E_SUPABASE_URL`, `E2E_SUPABASE_SERVICE_ROLE_KEY`, `E2E_TEST_TENANT_A_TOKEN`, `E2E_TEST_TENANT_B_TOKEN`).
- Playwright config must point `baseURL` at the real backend, not a mocked server.
- Existing `page.route` mocks may be retained only for third-party services that cannot be reached in CI (e.g., Stripe — use Stripe CLI webhook forwarding or a test webhook endpoint).

### R5 — Define Missing SLO Alert (`SLOBurnRateTooHigh`)

**File:** `infra/prometheus/alerts/slo-alerts.yml`

`deploy.yml` queries Alertmanager for active alerts matching `SLOBurnRateTooHigh` and uses the count as a deployment gate signal. No alert with this name exists in any file under `infra/prometheus/alerts/`. The gate always reads `0` active alerts regardless of system health.

**Required behavior:**
- Add a Prometheus alert rule named `SLOBurnRateTooHigh` to `infra/prometheus/alerts/slo-alerts.yml`.
- The alert must fire when the 5-minute error-budget burn rate exceeds a threshold that, if sustained, would exhaust the 30-day error budget within 1 hour (standard multi-window burn-rate approach).
- Suggested expression (adjust metric names to match existing instrumentation):
  ```yaml
  - alert: SLOBurnRateTooHigh
    expr: |
      (
        sum(rate(valuecanvas_http_requests_total{status_code=~"5.."}[5m]))
        / sum(rate(valuecanvas_http_requests_total[5m]))
      ) > (14.4 * 0.001)
    for: 2m
    labels:
      severity: critical
      slo: availability
    annotations:
      summary: "SLO burn rate too high"
      description: "Error-budget burn rate exceeds 14.4x; at this rate the 30-day budget exhausts in under 1 hour."
  ```
- The alert name must exactly match the regex `SLOBurnRateTooHigh` used in `deploy.yml` line 957.

### R6 — Enforce DAST Gate

**File:** `.github/workflows/deploy.yml`

`DAST_FAIL_ON_HIGH` is hardcoded to `"0"`, meaning the DAST gate never blocks a deployment regardless of how many high-severity vulnerabilities ZAP finds.

**Required behavior:**
- Change `DAST_FAIL_ON_HIGH` from `"0"` to `"1"` — any high-severity finding blocks the deployment.
- Change `DAST_FAIL_ON_MEDIUM` from `"0"` to `"5"` — more than 5 medium-severity findings block the deployment (provides a reasonable threshold while avoiding noise from informational findings).
- Document the thresholds in a comment above the env block so future changes are intentional.
- If the current ZAP scan produces findings that would breach these thresholds, they must be triaged and either fixed or added to a ZAP false-positive suppression file (`.zap/false-positives.json` or equivalent) before this change ships.

### R7 — Remove Fork PR Skip from Tenant Isolation Gate

**File:** `.github/workflows/pr-fast.yml`

The `tenant-isolation-gate` job has a condition:
```yaml
if: github.event.pull_request.head.repo.full_name == github.repository
```
This causes the job to be skipped entirely on fork PRs. The PR gate summary treats `skipped` as equivalent to `success`, meaning fork PRs bypass tenant isolation testing.

**Required behavior:**
- Remove the `if:` condition from the `tenant-isolation-gate` job, or replace it with a condition that runs the job on all PRs but uses read-only credentials (no `id-token: write` permission) for fork PRs.
- The `pr-gate` summary job must treat `skipped` as a failure for the `tenant-isolation-gate` lane specifically.
- If the job requires secrets unavailable on fork PRs, use a mock/stub Supabase URL and anon key for the static analysis portions, and skip only the live-database portions with an explicit `if:` on those steps (not the whole job).

---

## Acceptance Criteria

| # | Criterion | Verified by |
|---|-----------|-------------|
| AC-1 | `_agentCacheKey` throws `MissingTenantContextError` when context has no `tenantId` or `organization_id` | Unit test |
| AC-2 | Cache key for tenant A never equals cache key for tenant B with identical query | Unit test |
| AC-3 | Agent route returns HTTP 403 `TENANT_CONTEXT_REQUIRED` when tenant context is absent | Unit test |
| AC-4 | Concurrent webhook delivery of the same `event.id` invokes the event handler exactly once | Unit test |
| AC-5 | Second webhook delivery of the same `event.id` returns `isDuplicate: true` | Unit test |
| AC-6 | `processedWebhookIds` in-memory Set is not used in the production code path | Code review |
| AC-7 | `LLMJobData.tenant_id` is a required string field | TypeScript compilation |
| AC-8 | `addJob` throws when `tenant_id` is absent or empty | Unit test |
| AC-9 | `tenant_id` appears in all log output for job lifecycle events | Unit test (log spy) |
| AC-10 | `tenant_id` is persisted in `llm_job_results` | Unit test + migration |
| AC-11 | E2E auth flow completes against real Supabase (no `page.route` mocking) | Playwright run |
| AC-12 | E2E agent invocation flow hits real Express backend and validates response schema | Playwright run |
| AC-13 | E2E billing webhook flow asserts DB state after delivery | Playwright run |
| AC-14 | E2E tenant isolation flow asserts cross-tenant data is inaccessible | Playwright run |
| AC-15 | `SLOBurnRateTooHigh` alert rule exists in `slo-alerts.yml` and passes `promtool check rules` | `promtool check rules` |
| AC-16 | `DAST_FAIL_ON_HIGH` is `"1"` in `deploy.yml`; pipeline blocks on high-severity ZAP findings | CI run |
| AC-17 | `tenant-isolation-gate` runs on fork PRs; `skipped` is treated as failure in gate summary | CI run |

---

## Implementation Approach

Steps are ordered by risk and dependency. Complete each before starting the next.

1. **Fix `_agentCacheKey` (R1)**
   - Add `MissingTenantContextError` class to `packages/backend/src/api/agents.ts` (or a shared errors module).
   - Replace the `|| "unknown"` fallback with a throw.
   - Update `agentCache.get` and `agentCache.set` callers in the route handlers to catch and return 403.
   - Write unit tests (AC-1, AC-2, AC-3).
   - Run `pnpm test` to confirm no regressions.

2. **Fix webhook idempotency (R2)**
   - Refactor `WebhookService.processWebhook` to perform a single `INSERT ... ON CONFLICT DO NOTHING RETURNING id` and branch on the result.
   - Remove the call to `processEvent` from `processWebhook`; inline the event dispatch logic or call it only after a confirmed insert.
   - Remove `processedWebhookIds` from the production code path.
   - Write unit tests (AC-4, AC-5).
   - Run `pnpm test` to confirm billing tests pass.

3. **Add `tenant_id` to queue (R3)**
   - Update `LLMJobData` interface.
   - Update `addJob` validation.
   - Update `processJob`, `storeResult`, and event listener log calls.
   - Write migration SQL for `llm_job_results.tenant_id` column.
   - Update all `addJob` call sites.
   - Write unit tests (AC-7, AC-8, AC-9, AC-10).
   - Run `pnpm test` to confirm no regressions.

4. **Rewrite E2E tests (R4)**
   - Audit all files in `tests/e2e/` for `page.route(...)` calls; remove API mocks.
   - Update `playwright.config.ts` to set `baseURL` to the real backend URL (from `E2E_BASE_URL` env var).
   - Implement the four required flows (auth, agent, billing, tenant isolation) as described in R4.
   - Add required env vars to `.env.example` and CI secrets documentation.
   - Run `npx playwright test` against a local stack to confirm (AC-11 through AC-14).

5. **Add `SLOBurnRateTooHigh` alert (R5)**
   - Add the alert rule to `infra/prometheus/alerts/slo-alerts.yml`.
   - Validate with `promtool check rules infra/prometheus/alerts/slo-alerts.yml`.
   - Confirm the alert name matches the regex in `deploy.yml` line 957 (AC-15).

6. **Enforce DAST gate (R6)**
   - Update `DAST_FAIL_ON_HIGH` to `"1"` and `DAST_FAIL_ON_MEDIUM` to `"5"` in `deploy.yml`.
   - Add a comment block documenting the threshold rationale.
   - Triage any existing ZAP findings; add suppressions for confirmed false positives.
   - Confirm CI blocks on a synthetic high-severity finding in a test run (AC-16).

7. **Fix fork PR skip (R7)**
   - Remove or replace the `if:` condition on `tenant-isolation-gate` in `pr-fast.yml`.
   - Update the `pr-gate` summary job to treat `skipped` as failure for this lane.
   - Open a test fork PR to confirm the job runs (AC-17).

8. **Final verification**
   - Run `pnpm test` (full unit suite).
   - Run `pnpm run test:rls` (RLS policy validation).
   - Run `npx playwright test` (E2E suite against local stack).
   - Run `promtool check rules` on all alert files.
   - Confirm all 17 acceptance criteria are met.

---

## Out of Scope

- Chaos test rewrite (mocked chaos tests are a separate debt item; not a ship blocker per the user's prioritization).
- TypeScript error baseline reduction (7,500+ errors; tracked separately in `ts-debt-baseline.json`).
- ESLint warning baseline reduction (2,443 warnings; tracked separately in `quality-baselines.json`).
- OpenTelemetry tracing reliability (conditional load is a medium risk; not in the critical-3 set).
- Migration symlink investigation (the symlink at `infra/supabase/migrations` resolves correctly to `infra/supabase/supabase/migrations` — the audit report's claim of a broken symlink is inaccurate based on filesystem inspection).
