# Live User Experience QA Report (2026-03-27)

## Scope

Performed an in-depth QA pass focused on simulated end-user behavior and end-to-end confidence checks using Playwright-capable and Vitest integration/e2e tooling in this repository.

## Environment Preparation

1. Installed workspace dependencies with lockfile enforcement.
2. Verified Playwright CLI availability in `apps/ValyntApp` workspace.
3. Attempted browser binary install for Chromium.

## Test/Check Execution Summary

### 1) Dependency bootstrap
- Command: `pnpm install --frozen-lockfile`
- Result: ✅ Passed
- Notes: Full workspace dependencies installed successfully.

### 2) Playwright runtime validation
- Command: `pnpm --filter valynt-app exec playwright --version`
- Result: ✅ Passed
- Notes: Playwright 1.58.2 is available in the Valynt app workspace.

### 3) Browser provisioning for live-browser automation
- Command: `pnpm --filter valynt-app exec playwright install chromium`
- Result: ⚠️ Blocked by environment/network policy
- Notes: Download from `cdn.playwright.dev` failed with repeated `403 Domain forbidden` responses, preventing browser-backed Playwright sessions.

### 4) Repository e2e gate lane
- Command: `pnpm run test:e2e:gate`
- Result: ❌ Failed
- Findings:
  - Missing module paths for legacy e2e specs (`../../src/lib/agent-fabric/...`).
  - Missing packages in e2e lane context (`decimal.js`, `jsonwebtoken`).
  - Package export resolution issue for `@valueos/shared` in one suite.
- Impact: Current root e2e gate is not runnable as-is in this environment/revision.

### 5) Frontend integration lifecycle simulation (user-flow)
- Command: `pnpm vitest run apps/ValyntApp/src/tests/integration/case-lifecycle-e2e.test.tsx`
- Result: ✅ Passed (3/3 tests)
- Notes: Validated a full case lifecycle interaction flow in jsdom test runtime, including assembly-to-realization progression.

### 6) Backend broad regression sweep (attempted focused billing e2e invocation)
- Command: `pnpm --filter @valueos/backend test -- src/services/billing/__tests__/billing-flow-e2e.test.ts`
- Result: ⚠️ Partial run; command expanded to broad backend suite and surfaced mixed pass/fail before forced termination
- Findings observed during execution:
  - Large number of passing security, runtime, middleware, value-graph, and billing tests.
  - Multiple deterministic failures/timeouts in unrelated suites (e.g., `security-integration`, `AgentAPI`, `AgentChatService`, `WebhookService`) and missing env prerequisites (e.g., `supabaseKey is required`).
- Action: Stopped due runaway breadth and unrelated failures; this command is not currently scoped for isolated billing-e2e verification.

## Quality Assessment

- **Live-browser Playwright user simulation**: currently blocked by browser download policy (`403 Domain forbidden`).
- **Closest available user-experience simulation in this environment**: frontend integration lifecycle test passed and provides coverage of key user journey transitions.
- **Repository e2e lane health**: presently unstable due to broken imports/dependency resolution in root `tests/e2e` suites.

## Recommended Follow-ups

1. Allowlist Playwright CDN (or pre-bake Chromium into CI/dev image) so browser-based UX automation can run.
2. Repair root `tests/e2e` module paths and missing dependency declarations to restore `pnpm run test:e2e:gate`.
3. Add a truly scoped backend e2e command for billing flow (avoid invoking the full backend suite when passing a file arg).
4. Provide a minimal `.env.test` profile (including `SUPABASE_KEY`) for security integration tests.

